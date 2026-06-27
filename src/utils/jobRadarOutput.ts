import * as fs from "fs";
import * as path from "path";
import { CsvRow, writeCsv } from "./csv";
import { JobFitBucket, JobFitResult, SalaryType, SalaryConfidence, CompanyConfidence } from "./jobFit";
import { ResumeVariant, SolomonProfile } from "./solomonProfile";

export type ManualStatus = "unreviewed" | "apply_priority" | "research_first" | "network_first" | "skip_after_review";

export type JobRadarRecord = {
  id: string;
  jobId: string;
  source: string;
  sourceName: string;
  sourceType: string;
  title: string;
  company: string;
  canonicalCompany: string;
  collectedCompany: string;
  extractedCompanyFromJd: string;
  applyUrlDomain: string;
  companyConfidence: CompanyConfidence;
  companyMismatchFlag: boolean;
  location: string;
  locationRaw: string;
  remoteHybridOnsite: string;
  employmentType: string;
  seniorityLevel: string;
  seniority: string;
  applyUrl: string;
  sourceUrl: string;
  atsPlatform: string;
  dateFound: string;
  datePosted: string;
  salary: string;
  salaryRawText: string;
  salaryParsedMin: number | null;
  salaryParsedMax: number | null;
  salaryType: SalaryType;
  salaryConfidence: SalaryConfidence;
  sponsorshipNotes: string;
  sponsorshipStatus: string;
  clearanceNotes: string;
  clearanceStatus: string;
  sourceConfidence: "high" | "medium" | "low";
  extractionConfidence: "high" | "medium" | "low";
  fitBucket: JobFitBucket;
  scoringBucket: JobFitBucket;
  score: number;
  fitScore: number;
  whyItFits: string[];
  whyItFitsSolomon: string[];
  risksGaps: string[];
  recommendedResumeVariant: ResumeVariant;
  recommendedEvidenceBullets: string[];
  nextAction: string;
  manualStatus: ManualStatus;
  manualReviewFlags: string[];
  matchedSkills: string[];
  missingSignals: string[];
  dedupeKey: string;
  jobDescriptionText: string;
  jobDescriptionHash: string;
  jdTextPath: string;
  rawTextPath: string;
  rawHtmlPath?: string;
  duplicateCount?: number;
  duplicateSourceUrls?: string[];
};

export type JobLeadRecord = {
  leadId: string;
  company: string;
  signalSource: string;
  signalUrl: string;
  signalType: string;
  whyWorthWatching: string;
  whyWatch: string;
  likelyRoleFamily: string;
  suggestedSearchTerms: string[];
  suggestedNetworkingTarget: string;
  confidence: "high" | "medium" | "low";
  applyable: false;
  notes: string;
};

export type JobRadarOutputPayload = {
  generatedAt: string;
  profileName: string;
  sourceFile?: string;
  jobs: JobRadarRecord[];
  leads: JobLeadRecord[];
};

const CSV_HEADERS = [
  "jobId",
  "title",
  "canonicalCompany",
  "collectedCompany",
  "extractedCompanyFromJd",
  "companyConfidence",
  "companyMismatchFlag",
  "locationRaw",
  "remoteHybridOnsite",
  "employmentType",
  "seniority",
  "applyUrl",
  "applyUrlDomain",
  "sourceUrl",
  "sourceName",
  "sourceType",
  "atsPlatform",
  "dateFound",
  "datePosted",
  "salaryRawText",
  "salaryParsedMin",
  "salaryParsedMax",
  "salaryType",
  "salaryConfidence",
  "sponsorshipNotes",
  "sponsorshipStatus",
  "clearanceNotes",
  "clearanceStatus",
  "sourceConfidence",
  "extractionConfidence",
  "scoringBucket",
  "fitScore",
  "whyItFitsSolomon",
  "risksGaps",
  "recommendedResumeVariant",
  "recommendedEvidenceBullets",
  "nextAction",
  "manualStatus",
  "manualReviewFlags",
  "matchedSkills",
  "missingSignals",
  "dedupeKey",
  "jobDescriptionHash",
  "rawTextPath",
  "duplicateCount"
];

const BUCKET_FILES: Record<JobFitBucket, string> = {
  strong: "jobsStrong.csv",
  good: "jobsGood.csv",
  possible: "jobsPossible.csv",
  stretch: "jobsStretch.csv",
  skip: "jobsSkip.csv"
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function joinList(values: string[] | undefined) {
  return (values ?? []).join(" | ");
}

function toCsvRow(record: JobRadarRecord): CsvRow {
  return {
    jobId: record.jobId,
    title: record.title,
    canonicalCompany: record.canonicalCompany,
    collectedCompany: record.collectedCompany,
    extractedCompanyFromJd: record.extractedCompanyFromJd,
    companyConfidence: record.companyConfidence,
    companyMismatchFlag: String(record.companyMismatchFlag),
    locationRaw: record.locationRaw,
    remoteHybridOnsite: record.remoteHybridOnsite,
    employmentType: record.employmentType,
    seniority: record.seniority,
    applyUrl: record.applyUrl,
    applyUrlDomain: record.applyUrlDomain,
    sourceUrl: record.sourceUrl,
    sourceName: record.sourceName,
    sourceType: record.sourceType,
    atsPlatform: record.atsPlatform,
    dateFound: record.dateFound,
    datePosted: record.datePosted,
    salaryRawText: record.salaryRawText,
    salaryParsedMin: record.salaryParsedMin === null ? "" : String(record.salaryParsedMin),
    salaryParsedMax: record.salaryParsedMax === null ? "" : String(record.salaryParsedMax),
    salaryType: record.salaryType,
    salaryConfidence: record.salaryConfidence,
    sponsorshipNotes: record.sponsorshipNotes,
    sponsorshipStatus: record.sponsorshipStatus,
    clearanceNotes: record.clearanceNotes,
    clearanceStatus: record.clearanceStatus,
    sourceConfidence: record.sourceConfidence,
    extractionConfidence: record.extractionConfidence,
    scoringBucket: record.scoringBucket,
    fitScore: String(record.fitScore),
    whyItFitsSolomon: joinList(record.whyItFitsSolomon),
    risksGaps: joinList(record.risksGaps),
    recommendedResumeVariant: record.recommendedResumeVariant,
    recommendedEvidenceBullets: joinList(record.recommendedEvidenceBullets),
    nextAction: record.nextAction,
    manualStatus: record.manualStatus,
    manualReviewFlags: joinList(record.manualReviewFlags),
    matchedSkills: joinList(record.matchedSkills),
    missingSignals: joinList(record.missingSignals),
    dedupeKey: record.dedupeKey,
    jobDescriptionHash: record.jobDescriptionHash,
    rawTextPath: record.rawTextPath,
    duplicateCount: String(record.duplicateCount ?? 0)
  };
}

function byScore(left: JobRadarRecord, right: JobRadarRecord) {
  return right.score - left.score || left.company.localeCompare(right.company) || left.title.localeCompare(right.title);
}

function formatJobBlock(job: JobRadarRecord) {
  const lines = [
    `### ${job.title || "Unknown title"} - ${job.canonicalCompany || job.company || "Unknown company"}`,
    "",
    `- Job ID: ${job.jobId}`,
    `- Location: ${job.locationRaw || "Unknown"} (${job.remoteHybridOnsite})`,
    `- Employment: ${job.employmentType}; seniority: ${job.seniority}`,
    `- Score: ${job.fitScore}; next action: ${job.nextAction}; manual status: ${job.manualStatus}`,
    `- Company verification: collected="${job.collectedCompany || "unknown"}"; extracted="${job.extractedCompanyFromJd || "unknown"}"; domain="${job.applyUrlDomain || "unknown"}"; confidence=${job.companyConfidence}`,
    `- Apply URL: ${job.applyUrl || "Unknown"}`,
    `- Source URL: ${job.sourceUrl || "Unknown"}`,
    `- Source: ${job.sourceName || job.source} (${job.sourceType}); confidence=${job.sourceConfidence}; ATS/platform=${job.atsPlatform || "Unknown"}`,
    `- Date found: ${job.dateFound || "Unknown"}${job.datePosted ? `; date posted: ${job.datePosted}` : ""}`,
    `- Salary: ${job.salaryRawText || "Missing"} (${job.salaryType}; confidence=${job.salaryConfidence})`,
    `- Sponsorship: ${job.sponsorshipNotes || "not mentioned"} (${job.sponsorshipStatus})`,
    `- Clearance: ${job.clearanceNotes || "not mentioned"} (${job.clearanceStatus})`,
    `- Why it fits Solomon: ${joinList(job.whyItFitsSolomon) || "Needs manual review."}`,
    `- Risks/gaps: ${joinList(job.risksGaps) || "None obvious from extracted JD."}`,
    `- Resume variant: ${job.recommendedResumeVariant}`,
    `- Evidence bullets: ${joinList(job.recommendedEvidenceBullets) || "None recommended."}`,
    `- Manual review flags: ${joinList(job.manualReviewFlags) || "None"}`,
    `- Raw JD: ${job.rawTextPath || job.jdTextPath || "Not saved"}`
  ];

  if (job.companyMismatchFlag) {
    lines.splice(2, 0, "**Manual company verification required.**", "");
  }

  if ((job.duplicateCount ?? 0) > 0) {
    lines.push(`- Duplicate records merged: ${job.duplicateCount}`);
  }

  return lines.join("\n");
}

function formatDigest(payload: JobRadarOutputPayload, profile: SolomonProfile) {
  const lines: string[] = [
    `# Job Radar Digest - ${profile.candidate.name}`,
    "",
    `Generated: ${payload.generatedAt}`,
    `Profile: ${profile.candidate.targetRoleType}`,
    "",
    "This digest is discovery-only. Review each role manually before applying.",
    ""
  ];

  const sections: Array<{ label: string; bucket: JobFitBucket }> = [
    { label: "Strong Fit", bucket: "strong" },
    { label: "Good Fit", bucket: "good" },
    { label: "Possible Fit", bucket: "possible" },
    { label: "Stretch", bucket: "stretch" },
    { label: "Skip", bucket: "skip" }
  ];

  for (const section of sections) {
    const jobs = payload.jobs.filter((job) => job.fitBucket === section.bucket).sort(byScore);
    lines.push(`## ${section.label} (${jobs.length})`, "");
    if (jobs.length === 0) {
      lines.push("No roles in this bucket.", "");
      continue;
    }
    lines.push(...jobs.map(formatJobBlock), "");
  }

  return lines.join("\n");
}

function formatLeads(payload: JobRadarOutputPayload) {
  const lines = ["# Hidden-Market Leads", "", "Lead records are not applyable jobs unless a real JD and apply URL exist.", ""];
  if (payload.leads.length === 0) {
    lines.push("No hidden-market leads were found or imported in this run.", "");
    return lines.join("\n");
  }

  for (const lead of payload.leads) {
    lines.push(
      `## ${lead.company}`,
      "",
      `- Lead ID: ${lead.leadId}`,
      `- Signal source: ${lead.signalSource}`,
      `- Signal URL: ${lead.signalUrl}`,
      `- Signal type: ${lead.signalType}`,
      `- Why watch: ${lead.whyWorthWatching || lead.whyWatch}`,
      `- Likely role family: ${lead.likelyRoleFamily}`,
      `- Suggested search terms: ${lead.suggestedSearchTerms.join(", ")}`,
      `- Suggested networking target: ${lead.suggestedNetworkingTarget}`,
      `- Confidence: ${lead.confidence}`,
      "- Applyable: no",
      `- Notes: ${lead.notes || ""}`,
      ""
    );
  }

  return lines.join("\n");
}

function formatApplyPriority(payload: JobRadarOutputPayload) {
  const priorityJobs = payload.jobs.filter((job) => job.manualStatus === "apply_priority").sort(byScore);
  const lines = [
    "# Apply Priority",
    "",
    "This file is human-review only. Job Radar never sets apply_priority automatically.",
    ""
  ];

  if (priorityJobs.length === 0) {
    lines.push("No jobs have been manually marked apply_priority.", "");
    return lines.join("\n");
  }

  for (const job of priorityJobs) {
    lines.push(
      `## ${job.title} - ${job.canonicalCompany}`,
      "",
      `- Job ID: ${job.jobId}`,
      `- Score: ${job.fitScore}`,
      `- Apply URL: ${job.applyUrl}`,
      `- Source URL: ${job.sourceUrl}`,
      `- Manual review flags: ${joinList(job.manualReviewFlags) || "None"}`,
      ""
    );
  }

  return lines.join("\n");
}

export function writeJobRadarOutputs(payload: JobRadarOutputPayload, profile: SolomonProfile) {
  const analyzedDir = path.join(process.cwd(), "data", "jobs-analyzed");
  const digestDir = path.join(process.cwd(), "data", "job-digests");
  const leadsDir = path.join(process.cwd(), "data", "leads");
  ensureDir(analyzedDir);
  ensureDir(digestDir);
  ensureDir(leadsDir);

  const sortedJobs = [...payload.jobs].sort(byScore);
  for (const [bucket, fileName] of Object.entries(BUCKET_FILES) as Array<[JobFitBucket, string]>) {
    const rows = sortedJobs.filter((job) => job.fitBucket === bucket).map(toCsvRow);
    writeCsv(path.join(analyzedDir, fileName), rows, CSV_HEADERS);
  }

  fs.writeFileSync(
    path.join(analyzedDir, "all-jobs.json"),
    JSON.stringify({ ...payload, jobs: sortedJobs }, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(digestDir, "job-digest.md"), formatDigest({ ...payload, jobs: sortedJobs }, profile), "utf8");
  fs.writeFileSync(path.join(digestDir, "job-leads.md"), formatLeads(payload), "utf8");
  fs.writeFileSync(path.join(digestDir, "apply-priority.md"), formatApplyPriority({ ...payload, jobs: sortedJobs }), "utf8");
  fs.writeFileSync(path.join(leadsDir, "job-leads.json"), JSON.stringify(payload.leads, null, 2), "utf8");
}

export function buildRecordFromFit(input: {
  id: string;
  source: string;
  sourceType?: string;
  sourceName?: string;
  title: string;
  company?: string;
  collectedCompany?: string;
  extractedCompanyFromJd?: string;
  location?: string;
  locationRaw?: string;
  dateFound: string;
  datePosted?: string;
  jobDescriptionText?: string;
  jobDescriptionHash?: string;
  jdTextPath: string;
  sourceConfidence?: "high" | "medium" | "low";
  extractionConfidence?: "high" | "medium" | "low";
  manualStatus?: ManualStatus;
  fit: JobFitResult;
}): JobRadarRecord {
  const company = input.fit.companyVerification.canonicalCompany || input.company || "unclear";
  const location = input.locationRaw ?? input.location ?? "";
  const jobDescriptionText = input.jobDescriptionText ?? "";
  const jobDescriptionHash = input.jobDescriptionHash ?? "";
  const sourceName = input.sourceName ?? input.source;
  const sourceType = input.sourceType ?? input.source;
  return {
    id: input.id,
    jobId: input.id,
    source: sourceName,
    sourceName,
    sourceType,
    title: input.title,
    company,
    canonicalCompany: company,
    collectedCompany: input.fit.companyVerification.collectedCompany,
    extractedCompanyFromJd: input.fit.companyVerification.extractedCompanyFromJd,
    applyUrlDomain: input.fit.companyVerification.applyUrlDomain,
    companyConfidence: input.fit.companyVerification.companyConfidence,
    companyMismatchFlag: input.fit.companyVerification.companyMismatchFlag,
    location,
    locationRaw: location,
    remoteHybridOnsite: input.fit.remoteHybridOnsite,
    employmentType: input.fit.employmentType,
    seniorityLevel: input.fit.seniorityLevel,
    seniority: input.fit.seniorityLevel,
    applyUrl: input.fit.canonicalApplyUrl,
    sourceUrl: input.fit.sourceUrl,
    atsPlatform: input.fit.atsPlatform,
    dateFound: input.dateFound,
    datePosted: input.datePosted ?? "",
    salary: input.fit.salary,
    salaryRawText: input.fit.salaryRawText,
    salaryParsedMin: input.fit.salaryParsedMin,
    salaryParsedMax: input.fit.salaryParsedMax,
    salaryType: input.fit.salaryType,
    salaryConfidence: input.fit.salaryConfidence,
    sponsorshipNotes: input.fit.sponsorshipNotes,
    sponsorshipStatus: input.fit.sponsorshipStatus,
    clearanceNotes: input.fit.clearanceNotes,
    clearanceStatus: input.fit.clearanceStatus,
    sourceConfidence: input.sourceConfidence ?? "medium",
    extractionConfidence: input.extractionConfidence ?? (jobDescriptionText ? "high" : "low"),
    fitBucket: input.fit.bucket,
    scoringBucket: input.fit.bucket,
    score: input.fit.score,
    fitScore: input.fit.score,
    whyItFits: input.fit.whyItFits,
    whyItFitsSolomon: input.fit.whyItFits,
    risksGaps: input.fit.risksGaps,
    recommendedResumeVariant: input.fit.recommendedResumeVariant,
    recommendedEvidenceBullets: input.fit.recommendedEvidenceBullets,
    nextAction: input.fit.nextAction,
    manualStatus: input.manualStatus ?? "unreviewed",
    manualReviewFlags: input.fit.manualReviewFlags,
    matchedSkills: input.fit.matchedSkills,
    missingSignals: input.fit.missingSignals,
    dedupeKey: input.fit.dedupeKey,
    jobDescriptionText,
    jobDescriptionHash,
    jdTextPath: input.jdTextPath,
    rawTextPath: input.jdTextPath
  };
}
