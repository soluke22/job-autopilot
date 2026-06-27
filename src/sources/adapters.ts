import { extractJobDescription } from "../utils/automated/extractJobDescription";
import { CollectedJobSeed, JobSourceConfigEntry, JobSourceType, SourceAdapter, SourceConfidence } from "./types";

const DEFAULT_RATE_LIMIT = { minDelayMs: 1500, maxRequestsPerMinute: 20 };

function sourceConfidenceForType(sourceType: JobSourceType): SourceConfidence {
  if (sourceType === "companyCareerPage" || sourceType === "greenhouse" || sourceType === "lever" || sourceType === "ashby") {
    return "high";
  }
  if (sourceType === "manualUrl" || sourceType === "linkedIn" || sourceType === "workday") {
    return "medium";
  }
  return "low";
}

function titleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const finalPart = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(finalPart).replace(/[-_]+/g, " ").trim();
  } catch {
    return "";
  }
}

function normalizeConfiguredUrl(entry: JobSourceConfigEntry, url: string, dateFound: string): CollectedJobSeed {
  const configured = entry.jobUrls?.find((job) => job.url === url);
  return {
    sourceName: entry.sourceName,
    sourceType: entry.sourceType,
    sourceUrl: url,
    applyUrl: url,
    title: configured?.title ?? titleFromUrl(url),
    collectedCompany: configured?.company ?? entry.targetCompanies?.[0] ?? "",
    locationRaw: configured?.location ?? "",
    dateFound,
    sourceConfidence: sourceConfidenceForType(entry.sourceType),
    notes: `${entry.sourceType} configured URL import; discovery-only`
  };
}

function adapterFor(sourceType: JobSourceType): SourceAdapter {
  return {
    sourceName: sourceType,
    sourceType,
    supportsSearch: sourceType !== "manualUrl" && sourceType !== "hiddenMarketLead",
    supportsUrlImport: sourceType !== "hiddenMarketLead",
    extractJobDescription,
    normalizeJob: normalizeConfiguredUrl,
    sourceConfidence: sourceConfidenceForType(sourceType),
    rateLimitConfig: DEFAULT_RATE_LIMIT
  };
}

export const SOURCE_ADAPTERS: Record<JobSourceType, SourceAdapter> = {
  linkedIn: adapterFor("linkedIn"),
  companyCareerPage: adapterFor("companyCareerPage"),
  greenhouse: adapterFor("greenhouse"),
  lever: adapterFor("lever"),
  ashby: adapterFor("ashby"),
  workday: adapterFor("workday"),
  remoteJobBoard: adapterFor("remoteJobBoard"),
  aggregator: adapterFor("aggregator"),
  manualUrl: adapterFor("manualUrl"),
  hiddenMarketLead: {
    ...adapterFor("hiddenMarketLead"),
    supportsSearch: false,
    supportsUrlImport: false
  }
};

export function getSourceAdapter(sourceType: JobSourceType) {
  return SOURCE_ADAPTERS[sourceType];
}
