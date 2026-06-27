import * as fs from "fs";
import * as path from "path";
import { readCsv, writeCsv, CsvRow } from "../utils/csv";
import { getSourceAdapter } from "./adapters";
import { loadJobSourcesConfig } from "./config";
import { CollectedJobSeed, HiddenMarketLead, JobSourceType } from "./types";

export const RAW_JOB_HEADERS = [
  "id",
  "source",
  "sourceName",
  "sourceType",
  "title",
  "company",
  "location",
  "link",
  "sourceUrl",
  "applyUrl",
  "dateFound",
  "sourceConfidence",
  "approved",
  "manualStatus",
  "notes"
];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function rawJobsPath() {
  return path.join(process.cwd(), "data", "jobs-raw", "jobs.csv");
}

function leadsPath() {
  return path.join(process.cwd(), "data", "leads", "job-leads.json");
}

function getNextId(rows: CsvRow[]) {
  return (
    rows.reduce((max, row) => {
      const value = Number.parseInt(row.id ?? "", 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0) + 1
  );
}

function loadExistingRows(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  return readCsv(filePath);
}

function loadExistingLeads(filePath: string): HiddenMarketLead[] {
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(parsed) ? (parsed as HiddenMarketLead[]) : [];
}

function stableLeadId(company: string, signalUrl: string) {
  return `lead-${Buffer.from(`${company}|${signalUrl}`).toString("base64url").slice(0, 12)}`;
}

function toCsvRow(seed: CollectedJobSeed, id: number): CsvRow {
  return {
    id: String(id),
    source: seed.sourceName,
    sourceName: seed.sourceName,
    sourceType: seed.sourceType,
    title: seed.title,
    company: seed.collectedCompany,
    location: seed.locationRaw,
    link: seed.applyUrl,
    sourceUrl: seed.sourceUrl,
    applyUrl: seed.applyUrl,
    dateFound: seed.dateFound,
    sourceConfidence: seed.sourceConfidence,
    approved: "false",
    manualStatus: "unreviewed",
    notes: seed.notes
  };
}

export function collectConfiguredSources(options: {
  sourceTypes?: JobSourceType[];
  includeDisabled?: boolean;
  limit?: number;
  dryRun?: boolean;
}) {
  const config = loadJobSourcesConfig();
  const today = new Date().toISOString().slice(0, 10);
  const jobs: CollectedJobSeed[] = [];
  const leads: HiddenMarketLead[] = [];

  for (const entry of config.sources) {
    if (!entry.enabled && !options.includeDisabled) continue;
    if (options.sourceTypes && !options.sourceTypes.includes(entry.sourceType)) continue;

    const adapter = getSourceAdapter(entry.sourceType);
    for (const job of entry.jobUrls ?? []) {
      if (options.limit && jobs.length >= options.limit) break;
      jobs.push(adapter.normalizeJob(entry, job.url, today));
    }

    for (const lead of entry.leadUrls ?? []) {
      leads.push({
        leadId: stableLeadId(lead.company, lead.signalUrl),
        company: lead.company,
        signalSource: entry.sourceName,
        signalUrl: lead.signalUrl,
        signalType: lead.signalType,
        likelyRoleFamily: lead.likelyRoleFamily ?? "frontend/product UI",
        whyWorthWatching: lead.whyWorthWatching,
        suggestedSearchTerms: lead.suggestedSearchTerms ?? ["frontend engineer", "react", "typescript"],
        suggestedNetworkingTarget: lead.suggestedNetworkingTarget ?? "frontend engineering manager or recruiter",
        confidence: lead.confidence ?? "medium",
        applyable: false,
        notes: lead.notes ?? entry.notes ?? ""
      });
    }
  }

  if (options.dryRun) {
    return { jobs, leads, jobsPath: rawJobsPath(), leadsPath: leadsPath(), wrote: false };
  }

  const outPath = rawJobsPath();
  const leadOutPath = leadsPath();
  ensureDir(path.dirname(outPath));
  ensureDir(path.dirname(leadOutPath));

  const existingRows = loadExistingRows(outPath);
  const existingLinks = new Set(existingRows.map((row) => row.link || row.sourceUrl || row.applyUrl).filter(Boolean));
  let nextId = getNextId(existingRows);
  const newRows = jobs
    .filter((job) => !existingLinks.has(job.applyUrl) && !existingLinks.has(job.sourceUrl))
    .map((job) => toCsvRow(job, nextId++));

  writeCsv(outPath, [...existingRows, ...newRows], RAW_JOB_HEADERS);

  const existingLeads = loadExistingLeads(leadOutPath);
  const existingLeadIds = new Set(existingLeads.map((lead) => lead.leadId));
  const mergedLeads = [...existingLeads, ...leads.filter((lead) => !existingLeadIds.has(lead.leadId))];
  fs.writeFileSync(leadOutPath, JSON.stringify(mergedLeads, null, 2), "utf8");

  return { jobs: newRows, leads, jobsPath: outPath, leadsPath: leadOutPath, wrote: true };
}
