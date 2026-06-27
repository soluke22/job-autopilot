import * as fs from "fs";
import * as path from "path";
import { JobRadarOutputPayload, JobRadarRecord } from "../utils/jobRadarOutput";
import { loadSolomonProfile } from "../utils/solomonProfile";

function getArg(name: string): string | null {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes("=")) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] ?? null;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown-job";
}

function findJob(payload: JobRadarOutputPayload, jobId: string) {
  return payload.jobs.find((job) => job.jobId === jobId || job.id === jobId);
}

function readCleanJd(job: JobRadarRecord, workspaceDir: string) {
  if (job.jobDescriptionText?.trim()) return job.jobDescriptionText.trim();
  const rawPath = job.rawTextPath || job.jdTextPath;
  if (!rawPath) return "";
  const absolute = path.isAbsolute(rawPath) ? rawPath : path.join(workspaceDir, rawPath);
  if (!fs.existsSync(absolute)) return "";
  const raw = fs.readFileSync(absolute, "utf8");
  const parts = raw.split(/\n\n/);
  return (parts.length > 1 ? parts.slice(1).join("\n\n") : raw).trim();
}

function salaryBlock(job: JobRadarRecord) {
  return {
    rawText: job.salaryRawText || job.salary || "",
    parsedMin: job.salaryParsedMin,
    parsedMax: job.salaryParsedMax,
    salaryType: job.salaryType,
    confidence: job.salaryConfidence
  };
}

function formatJobDescription(job: JobRadarRecord, jdText: string) {
  return [
    `# ${job.title} - ${job.canonicalCompany}`,
    "",
    `Job ID: ${job.jobId}`,
    `Source: ${job.sourceName}`,
    `Source URL: ${job.sourceUrl}`,
    `Apply URL: ${job.applyUrl}`,
    "",
    "## Job Description",
    "",
    jdText || "No clean JD text was available. Re-run analyzeJds for this job or review the source URL manually.",
    ""
  ].join("\n");
}

function formatSummary(job: JobRadarRecord) {
  return [
    `# Job Summary: ${job.title} - ${job.canonicalCompany}`,
    "",
    `- Job ID: ${job.jobId}`,
    `- Location: ${job.locationRaw} (${job.remoteHybridOnsite})`,
    `- Employment: ${job.employmentType}; seniority: ${job.seniority}`,
    `- Score: ${job.fitScore}; bucket: ${job.scoringBucket}`,
    `- Resume variant: ${job.recommendedResumeVariant}`,
    `- Next action: ${job.nextAction}; manual status: ${job.manualStatus}`,
    `- Company verification: collected="${job.collectedCompany || "unknown"}"; extracted="${job.extractedCompanyFromJd || "unknown"}"; domain="${job.applyUrlDomain || "unknown"}"; confidence=${job.companyConfidence}`,
    `- Manual review flags: ${job.manualReviewFlags.join(" | ") || "None"}`,
    "",
    "## Why It Fits Solomon",
    "",
    ...(job.whyItFitsSolomon.length > 0 ? job.whyItFitsSolomon.map((item) => `- ${item}`) : ["- Needs manual review."]),
    "",
    "## Risks / Gaps",
    "",
    ...(job.risksGaps.length > 0 ? job.risksGaps.map((item) => `- ${item}`) : ["- None obvious from extracted JD."]),
    ""
  ].join("\n");
}

function formatEvidence(job: JobRadarRecord, claimsToAvoid: string[]) {
  return [
    "# Recommended Evidence",
    "",
    ...(job.recommendedEvidenceBullets.length > 0
      ? job.recommendedEvidenceBullets.map((item) => `- ${item}`)
      : ["- No evidence-backed bullets were selected for this job."]),
    "",
    "## Claims To Avoid",
    "",
    ...claimsToAvoid.map((claim) => `- ${claim}`),
    ""
  ].join("\n");
}

export function exportForTailoringPackage(options: {
  jobId: string;
  targetRepo: string;
  importDir?: string;
  workspaceDir?: string;
}) {
  const workspaceDir = options.workspaceDir ?? process.cwd();
  const profile = loadSolomonProfile(path.join(workspaceDir, "config", "solomon-profile.json"));
  const targetRepo = options.targetRepo;

  const allJobsPath = path.join(workspaceDir, "data", "jobs-analyzed", "all-jobs.json");
  if (!fs.existsSync(allJobsPath)) {
    throw new Error(`Missing ${allJobsPath}. Run npm run analyzeJds first.`);
  }

  const payload = JSON.parse(fs.readFileSync(allJobsPath, "utf8")) as JobRadarOutputPayload;
  const job = findJob(payload, options.jobId);
  if (!job) {
    throw new Error(`Job ID not found in all-jobs.json: ${options.jobId}`);
  }

  const importDirSetting = options.importDir || "input";
  const importBase = path.isAbsolute(importDirSetting)
    ? importDirSetting
    : path.join(path.resolve(targetRepo), importDirSetting);
  const packageDir = path.join(importBase, `job-radar${sanitizePathPart(job.jobId)}`);
  ensureDir(packageDir);

  const jdText = readCleanJd(job, workspaceDir);
  const packageJson = {
    jobId: job.jobId,
    title: job.title,
    canonicalCompany: job.canonicalCompany,
    sourceName: job.sourceName,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    jobDescriptionText: jdText,
    locationRaw: job.locationRaw,
    remoteHybridOnsite: job.remoteHybridOnsite,
    employmentType: job.employmentType,
    seniority: job.seniority,
    salary: salaryBlock(job),
    clearanceStatus: job.clearanceStatus,
    sponsorshipStatus: job.sponsorshipStatus,
    scoringBucket: job.scoringBucket,
    fitScore: job.fitScore,
    recommendedResumeVariant: job.recommendedResumeVariant,
    whyItFitsSolomon: job.whyItFitsSolomon,
    risksGaps: job.risksGaps,
    manualReviewFlags: job.manualReviewFlags,
    recommendedEvidenceBullets: job.recommendedEvidenceBullets,
    claimsToAvoid: profile.unsupportedClaims,
    nextAction: job.nextAction
  };

  fs.writeFileSync(path.join(packageDir, "job-package.json"), JSON.stringify(packageJson, null, 2), "utf8");
  fs.writeFileSync(path.join(packageDir, "job-description.md"), formatJobDescription(job, jdText), "utf8");
  fs.writeFileSync(path.join(packageDir, "job-summary.md"), formatSummary(job), "utf8");
  fs.writeFileSync(path.join(packageDir, "recommended-evidence.md"), formatEvidence(job, profile.unsupportedClaims), "utf8");

  const localHandoffDir = path.join(workspaceDir, "data", "tailoring-handoff");
  ensureDir(localHandoffDir);
  const manifest = {
    exportedAt: new Date().toISOString(),
    jobId: job.jobId,
    targetRepo: path.resolve(targetRepo),
    packageDir,
    files: ["job-package.json", "job-description.md", "job-summary.md", "recommended-evidence.md"]
  };
  const manifestPath = path.join(localHandoffDir, `handoff-${sanitizePathPart(job.jobId)}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  return { ...manifest, manifestPath };
}

function main() {
  const jobId = getArg("jobId");
  if (!jobId) {
    throw new Error("Missing --jobId <jobId>.");
  }

  const targetRepo = getArg("targetRepo") || process.env.RESUME_TAILORING_REPO_DIR;
  if (!targetRepo) {
    throw new Error("Missing --targetRepo or RESUME_TAILORING_REPO_DIR.");
  }

  const manifest = exportForTailoringPackage({
    jobId,
    targetRepo,
    importDir: process.env.RESUME_TAILORING_IMPORT_DIR || "input"
  });
  console.log(`Exported tailoring handoff package: ${manifest.packageDir}`);
  console.log("Discovery-only export complete. No application, email, draft, upload, or message was created.");
}

if (require.main === module) {
  main();
}
