import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";
import { readCsv, CsvRow } from "../utils/csv";
import { extractJobDescription, StructuredJobDetails } from "../utils/automated/extractJobDescription";
import { canonicalizeJobUrl, scoreJobFit, summarizeFit } from "../utils/jobFit";
import {
  JobLeadRecord,
  ManualStatus,
  JobRadarRecord,
  buildRecordFromFit,
  writeJobRadarOutputs
} from "../utils/jobRadarOutput";
import { loadSolomonProfile } from "../utils/solomonProfile";
import { JobSourceType } from "../sources/types";

function getArg(name: string): string | null {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes("=")) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] ?? null;
}

function sanitizeLinkedInJobUrl(raw: string) {
  const trimmed = (raw ?? "").trim();
  const match = trimmed.match(/https:\/\/www\.linkedin\.com\/jobs\/view\/[^,\s]+\/?/i);
  return match ? match[0] : trimmed;
}

function preferredJobsPath() {
  const csvArg = getArg("csv");
  if (csvArg) return path.resolve(process.cwd(), csvArg);

  const rawJobsPath = path.join(process.cwd(), "data", "jobs-raw", "jobs.csv");
  if (fs.existsSync(rawJobsPath)) return rawJobsPath;

  return path.join(process.cwd(), "data", "jobs.csv");
}

function getStoragePath() {
  const combinedPath = path.join(process.cwd(), "storage", "combined.json");
  if (fs.existsSync(combinedPath)) return combinedPath;
  return path.join(process.cwd(), "storage", "linkedin.json");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(value: string) {
  return (value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function shortHash(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function fullHash(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function writeRawJobDescription(input: {
  company: string;
  title: string;
  url: string;
  descriptionText: string;
  generatedAt: string;
}) {
  const jdDir = path.join(process.cwd(), "data", "jd-text");
  ensureDir(jdDir);
  const fileName = `${slugify(`${input.company}-${input.title}`)}-${shortHash(input.url || input.descriptionText)}.txt`;
  const filePath = path.join(jdDir, fileName);
  const body = [
    `Company: ${input.company || "Unknown company"}`,
    `Role: ${input.title || "Unknown title"}`,
    `URL: ${input.url || ""}`,
    `Collected: ${input.generatedAt}`,
    "",
    input.descriptionText || ""
  ].join("\n");
  fs.writeFileSync(filePath, body, "utf8");
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function fallbackDetails(row: CsvRow): StructuredJobDetails {
  return {
    title: row.title ?? "",
    company: row.company ?? "",
    location: row.location ?? "",
    descriptionText: row.notes ?? "",
    requiredSkills: [],
    preferredSkills: [],
    coreResponsibilities: [],
    seniority: "",
    domainKeywords: []
  };
}

function readManualLeads(): JobLeadRecord[] {
  const leadsPath = path.join(process.cwd(), "data", "leads", "job-leads.json");
  const legacyPath = path.join(process.cwd(), "data", "jobs-raw", "manual-leads.json");
  const targetPath = fs.existsSync(leadsPath) ? leadsPath : legacyPath;
  if (!fs.existsSync(targetPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((lead) => lead && typeof lead.company === "string")
    .map((lead, index) => ({
      leadId: lead.leadId ?? `lead-${index + 1}`,
      company: lead.company,
      signalSource: lead.signalSource ?? "manual-public-url",
      signalUrl: lead.signalUrl ?? lead.signalSource ?? "",
      signalType: lead.signalType ?? "manual_signal",
      whyWorthWatching: lead.whyWorthWatching ?? lead.whyWatch ?? "",
      whyWatch: lead.whyWatch ?? lead.whyWorthWatching ?? "",
      likelyRoleFamily: lead.likelyRoleFamily ?? "frontend/product UI",
      suggestedSearchTerms: lead.suggestedSearchTerms ?? ["frontend engineer", "react", "typescript"],
      suggestedNetworkingTarget: lead.suggestedNetworkingTarget ?? "frontend engineering manager or recruiter",
      confidence: lead.confidence ?? "medium",
      applyable: false,
      notes: lead.notes ?? ""
    })) as JobLeadRecord[];
}

function getSourceType(row: CsvRow): JobSourceType {
  const sourceType = row.sourceType as JobSourceType | undefined;
  if (sourceType) return sourceType;
  const source = (row.source || "").toLowerCase();
  if (source.includes("linkedin")) return "linkedIn";
  if (source.includes("greenhouse")) return "greenhouse";
  if (source.includes("lever")) return "lever";
  if (source.includes("ashby")) return "ashby";
  if (source.includes("workday")) return "workday";
  if (source.includes("manual")) return "manualUrl";
  return "aggregator";
}

function getSourceConfidence(row: CsvRow): "high" | "medium" | "low" {
  if (row.sourceConfidence === "high" || row.sourceConfidence === "medium" || row.sourceConfidence === "low") {
    return row.sourceConfidence;
  }
  const sourceType = getSourceType(row);
  if (sourceType === "greenhouse" || sourceType === "lever" || sourceType === "ashby" || sourceType === "companyCareerPage") {
    return "high";
  }
  if (sourceType === "aggregator" || sourceType === "remoteJobBoard") return "low";
  return "medium";
}

function getManualStatus(row: CsvRow): ManualStatus {
  const value = row.manualStatus as ManualStatus | undefined;
  const allowed: ManualStatus[] = ["unreviewed", "apply_priority", "research_first", "network_first", "skip_after_review"];
  return value && allowed.includes(value) ? value : "unreviewed";
}

function dedupeRecords(records: JobRadarRecord[]) {
  const byKey = new Map<string, JobRadarRecord>();
  for (const record of records) {
    const key = record.dedupeKey || `record:${record.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...record, duplicateCount: 0, duplicateSourceUrls: [] });
      continue;
    }

    const duplicateUrls = [
      ...(existing.duplicateSourceUrls ?? []),
      record.sourceUrl,
      record.applyUrl
    ].filter(Boolean);
    const duplicateCount = (existing.duplicateCount ?? 0) + 1;
    const winner = record.score > existing.score ? record : existing;
    byKey.set(key, {
      ...winner,
      duplicateCount,
      duplicateSourceUrls: Array.from(new Set(duplicateUrls))
    });
  }
  return [...byKey.values()];
}

async function main() {
  const profile = loadSolomonProfile();
  const jobsPath = preferredJobsPath();
  const generatedAt = new Date().toISOString();

  if (!fs.existsSync(jobsPath)) {
    throw new Error(`Missing jobs CSV: ${jobsPath}. Run npm run collectJobs first, or pass --csv=path/to/jobs.csv.`);
  }

  const requestedLimit = Math.max(0, Number.parseInt(getArg("limit") ?? getArg("count") ?? "0", 10) || 0);
  const rows = requestedLimit > 0 ? readCsv(jobsPath).slice(0, requestedLimit) : readCsv(jobsPath);
  if (rows.length === 0) {
    writeJobRadarOutputs(
      {
        generatedAt,
        profileName: profile.candidate.name,
        sourceFile: jobsPath,
        jobs: [],
        leads: readManualLeads()
      },
      profile
    );
    console.log("No jobs found. Empty radar outputs were written.");
    return;
  }

  const storagePath = getStoragePath();
  const browser = await chromium.launch({ headless: true });
  const contextOptions = fs.existsSync(storagePath) ? { storageState: storagePath } : {};
  if (!fs.existsSync(storagePath)) {
    console.log("No LinkedIn storage state found. Public ATS URLs can still be analyzed; LinkedIn URLs may require auth.");
  }
  const context = await browser.newContext(contextOptions);
  const records: JobRadarRecord[] = [];

  console.log(`Analyzing ${rows.length} job(s) for ${profile.candidate.name}.`);
  console.log("Read-only mode: pages are opened for text extraction only; no apply buttons, forms, uploads, or messages.\n");

  for (const [index, row] of rows.entries()) {
    const page = await context.newPage();
    const sourceUrl = sanitizeLinkedInJobUrl(row.sourceUrl || row.link || row.applyUrl || "");
    const applyUrl = canonicalizeJobUrl(row.applyUrl || row.link || sourceUrl);
    const sourceName = row.sourceName || row.source || "manual";
    const sourceType = getSourceType(row);
    const sourceConfidence = getSourceConfidence(row);
    const dateFound = row.dateFound || generatedAt.slice(0, 10);
    const manualStatus = getManualStatus(row);

    try {
      console.log(`[${index + 1}/${rows.length}] ${row.title || "Unknown title"} @ ${row.company || "Unknown company"}`);
      console.log(` -> opening ${sourceUrl}`);
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1500);

      const details = await extractJobDescription(page);
      const title = details.title || row.title || "";
      const collectedCompany = row.company || "";
      const extractedCompanyFromJd = details.company || "";
      const location = details.location || row.location || "";
      const fit = scoreJobFit(profile, {
        ...details,
        fallbackTitle: row.title,
        fallbackCompany: row.company,
        fallbackLocation: row.location,
        collectedCompany,
        extractedCompanyFromJd,
        source: sourceName,
        sourceType,
        sourceUrl,
        applyUrl
      });
      const jdTextPath = writeRawJobDescription({
        company: fit.companyVerification.canonicalCompany,
        title,
        url: sourceUrl,
        descriptionText: details.descriptionText,
        generatedAt
      });
      const jobDescriptionHash = fullHash(details.descriptionText || sourceUrl || `${row.title}|${row.company}`);

      records.push(
        buildRecordFromFit({
          id: row.id || String(index + 1),
          source: sourceName,
          sourceName,
          sourceType,
          title,
          company: fit.companyVerification.canonicalCompany,
          collectedCompany,
          extractedCompanyFromJd,
          location,
          locationRaw: location,
          dateFound,
          datePosted: row.datePosted || "",
          jobDescriptionText: details.descriptionText,
          jobDescriptionHash,
          jdTextPath,
          sourceConfidence,
          extractionConfidence: details.descriptionText ? "high" : "medium",
          manualStatus,
          fit
        })
      );

      console.log(` -> ${fit.bucket.toUpperCase()} (${fit.score}) ${summarizeFit(fit)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(` -> extraction issue, scoring from collected row only: ${message}`);
      const details = fallbackDetails(row);
      const fit = scoreJobFit(profile, {
        ...details,
        fallbackTitle: row.title,
        fallbackCompany: row.company,
        fallbackLocation: row.location,
        collectedCompany: row.company,
        extractedCompanyFromJd: "",
        source: sourceName,
        sourceType,
        sourceUrl,
        applyUrl
      });
      fit.risksGaps = [...fit.risksGaps, `extraction issue: ${message}`];
      fit.manualReviewFlags = [...fit.manualReviewFlags, "JD extraction failed"];
      const jdTextPath = writeRawJobDescription({
        company: row.company || "",
        title: row.title || "",
        url: sourceUrl,
        descriptionText: `JD extraction failed: ${message}`,
        generatedAt
      });
      records.push(
        buildRecordFromFit({
          id: row.id || String(index + 1),
          source: sourceName,
          sourceName,
          sourceType,
          title: row.title || "",
          company: fit.companyVerification.canonicalCompany,
          collectedCompany: row.company || "",
          extractedCompanyFromJd: "",
          location: row.location || "",
          locationRaw: row.location || "",
          dateFound,
          datePosted: row.datePosted || "",
          jobDescriptionText: `JD extraction failed: ${message}`,
          jobDescriptionHash: fullHash(`${sourceUrl}|${message}`),
          jdTextPath,
          sourceConfidence,
          extractionConfidence: "low",
          manualStatus,
          fit
        })
      );
    } finally {
      await page.close().catch(() => {});
    }
  }

  await browser.close();

  const deduped = dedupeRecords(records);
  writeJobRadarOutputs(
    {
      generatedAt,
      profileName: profile.candidate.name,
      sourceFile: jobsPath,
      jobs: deduped,
      leads: readManualLeads()
    },
    profile
  );

  const counts = deduped.reduce<Record<string, number>>((acc, job) => {
    acc[job.fitBucket] = (acc[job.fitBucket] ?? 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log(`Analyzed rows: ${records.length}`);
  console.log(`Deduped jobs: ${deduped.length}`);
  console.log(`Strong: ${counts.strong ?? 0}`);
  console.log(`Good: ${counts.good ?? 0}`);
  console.log(`Possible: ${counts.possible ?? 0}`);
  console.log(`Stretch: ${counts.stretch ?? 0}`);
  console.log(`Skip: ${counts.skip ?? 0}`);
  console.log("Outputs written under data/jobs-analyzed, data/job-digests, and data/jd-text.");
}

main().catch((error) => {
  console.error("analyzeJobs failed:", error);
  process.exit(1);
});
