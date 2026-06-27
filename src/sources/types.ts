import { Page } from "playwright";
import { StructuredJobDetails } from "../utils/automated/extractJobDescription";

export type JobSourceType =
  | "linkedIn"
  | "companyCareerPage"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "remoteJobBoard"
  | "aggregator"
  | "manualUrl"
  | "hiddenMarketLead";

export type SourceConfidence = "high" | "medium" | "low";

export type RateLimitConfig = {
  minDelayMs: number;
  maxRequestsPerMinute?: number;
};

export type JobSourceConfigEntry = {
  sourceName: string;
  sourceType: JobSourceType;
  enabled: boolean;
  supportsSearch?: boolean;
  supportsUrlImport?: boolean;
  searchUrls?: string[];
  boardUrls?: string[];
  jobUrls?: Array<{
    url: string;
    title?: string;
    company?: string;
    location?: string;
  }>;
  leadUrls?: Array<{
    company: string;
    signalUrl: string;
    signalType: string;
    whyWorthWatching: string;
    likelyRoleFamily?: string;
    suggestedSearchTerms?: string[];
    suggestedNetworkingTarget?: string;
    confidence?: SourceConfidence;
    notes?: string;
  }>;
  targetCompanies?: string[];
  notes?: string;
  rateLimitConfig?: RateLimitConfig;
};

export type JobSourcesConfig = {
  version: number;
  defaultRateLimitConfig: RateLimitConfig;
  sources: JobSourceConfigEntry[];
};

export type CollectedJobSeed = {
  sourceName: string;
  sourceType: JobSourceType;
  sourceUrl: string;
  applyUrl: string;
  title: string;
  collectedCompany: string;
  locationRaw: string;
  dateFound: string;
  sourceConfidence: SourceConfidence;
  notes: string;
};

export type HiddenMarketLead = {
  leadId: string;
  company: string;
  signalSource: string;
  signalUrl: string;
  signalType: string;
  likelyRoleFamily: string;
  whyWorthWatching: string;
  suggestedSearchTerms: string[];
  suggestedNetworkingTarget: string;
  confidence: SourceConfidence;
  applyable: false;
  notes: string;
};

export type SourceAdapter = {
  sourceName: string;
  sourceType: JobSourceType;
  supportsSearch: boolean;
  supportsUrlImport: boolean;
  collectSearchResults?: (entry: JobSourceConfigEntry, limit: number) => Promise<CollectedJobSeed[]>;
  collectFromUrl?: (entry: JobSourceConfigEntry, url: string) => Promise<CollectedJobSeed | null>;
  extractJobDescription?: (page: Page) => Promise<StructuredJobDetails>;
  normalizeJob: (entry: JobSourceConfigEntry, url: string, dateFound: string) => CollectedJobSeed;
  sourceConfidence: SourceConfidence;
  rateLimitConfig: RateLimitConfig;
};
