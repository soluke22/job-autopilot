import { StructuredJobDetails } from "./automated/extractJobDescription";
import { ResumeVariant, SolomonEvidence, SolomonProfile } from "./solomonProfile";

export type JobFitBucket = "strong" | "good" | "possible" | "stretch" | "skip";
export type RemoteHybridOnsite = "remote" | "hybrid" | "onsite" | "unclear";
export type EmploymentType = "full-time" | "contract" | "contract-to-hire" | "part-time" | "internship" | "unclear";
export type SeniorityLevel = "entry" | "mid-level" | "senior" | "staff/principal" | "manager" | "unclear";
export type NextAction = "apply manually" | "research company" | "network first" | "skip" | "ask Solomon";
export type SalaryType = "annual" | "hourly" | "monthly" | "unknown";
export type SalaryConfidence = "high" | "medium" | "low";
export type ClearanceStatus = "not_mentioned" | "active_required" | "obtainable_after_hire" | "mentioned_unclear";
export type SponsorshipStatus = "not_mentioned" | "mentioned_review";
export type CompanyConfidence = "high" | "medium" | "low";

export type SalaryInfo = {
  rawText: string;
  parsedMin: number | null;
  parsedMax: number | null;
  salaryType: SalaryType;
  confidence: SalaryConfidence;
};

export type CompanyVerificationResult = {
  collectedCompany: string;
  extractedCompanyFromJd: string;
  applyUrlDomain: string;
  canonicalCompany: string;
  companyConfidence: CompanyConfidence;
  companyMismatchFlag: boolean;
};

export type JobFitResult = {
  score: number;
  bucket: JobFitBucket;
  matchedSkills: string[];
  missingSignals: string[];
  reasons: string[];
  whyItFits: string[];
  risksGaps: string[];
  recommendedResumeVariant: ResumeVariant;
  recommendedEvidenceBullets: string[];
  nextAction: NextAction;
  remoteHybridOnsite: RemoteHybridOnsite;
  employmentType: EmploymentType;
  seniorityLevel: SeniorityLevel;
  salary: string;
  salaryRawText: string;
  salaryParsedMin: number | null;
  salaryParsedMax: number | null;
  salaryType: SalaryType;
  salaryConfidence: SalaryConfidence;
  sponsorshipNotes: string;
  sponsorshipStatus: SponsorshipStatus;
  clearanceNotes: string;
  clearanceStatus: ClearanceStatus;
  companyVerification: CompanyVerificationResult;
  manualReviewFlags: string[];
  atsPlatform: string;
  canonicalApplyUrl: string;
  sourceUrl: string;
  dedupeKey: string;
};

type ScoreInput = StructuredJobDetails & {
  descriptionText?: string;
  fallbackTitle?: string;
  fallbackCompany?: string;
  fallbackLocation?: string;
  collectedCompany?: string;
  extractedCompanyFromJd?: string;
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  applyUrl?: string;
};

const FRONTEND_TITLE_SIGNALS = [
  "frontend",
  "front end",
  "front-end",
  "ui engineer",
  "software engineer",
  "react engineer",
  "typescript engineer",
  "product engineer",
  "design systems",
  "component library",
  "platform ui",
  "internal tools"
];

const BACKEND_HEAVY_SIGNALS = [
  "backend engineer",
  "back end engineer",
  "java backend",
  "spring boot",
  "distributed systems",
  "microservices architecture",
  "database internals",
  "api platform ownership"
];

const INFRA_HEAVY_SIGNALS = [
  "devops",
  "sre",
  "site reliability",
  "kubernetes",
  "terraform",
  "cloud infrastructure",
  "aws infrastructure",
  "platform infrastructure",
  "ml infrastructure"
];

const MOBILE_NATIVE_SIGNALS = ["native ios", "swift", "objective-c", "native android", "kotlin", "mobile-only"];
const ML_TRAINING_SIGNALS = ["ml model training", "machine learning model", "deep learning", "computer vision", "llm training"];
const TESTING_ACCESSIBILITY_SIGNALS = ["jest", "playwright", "react testing library", "testing", "accessibility", "a11y"];
const DESIGN_SYSTEM_SIGNALS = ["design system", "design systems", "component library", "storybook", "design token"];
const INTERNAL_TOOL_SIGNALS = ["internal tools", "admin tools", "workflow", "dashboard", "operations tool"];
const MEDIA_SPORTS_CONSUMER_SIGNALS = ["media", "sports", "consumer web", "streaming", "entertainment", "espn"];
const AI_ASSISTED_SIGNALS = ["ai-assisted", "ai assisted", "claude", "codex", "copilot", "cursor"];

function normalize(value: string) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeLoose(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCompanyForCompare(value: string) {
  return normalizeLoose(value)
    .replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|company|co|group|holdings|technologies|technology)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractDomain(rawUrl: string) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function looksLikeAtsDomain(domain: string) {
  return /\b(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|workdayjobs\.com|linkedin\.com|indeed\.com|simplify\.jobs|wellfound\.com)\b/i.test(
    domain
  );
}

function companyFromDomain(domain: string) {
  if (!domain || looksLikeAtsDomain(domain)) return "";
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function companyValuesAgree(left: string, right: string) {
  const a = normalizeCompanyForCompare(left);
  const b = normalizeCompanyForCompare(right);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

export function verifyCompany(input: {
  collectedCompany?: string;
  extractedCompanyFromJd?: string;
  applyUrl?: string;
  fallbackCompany?: string;
}): CompanyVerificationResult {
  const collectedCompany = (input.collectedCompany ?? input.fallbackCompany ?? "").trim();
  const extractedCompanyFromJd = (input.extractedCompanyFromJd ?? "").trim();
  const applyUrlDomain = extractDomain(input.applyUrl ?? "");
  const domainCompany = companyFromDomain(applyUrlDomain);

  const companyMismatchFlag =
    !!collectedCompany &&
    !!extractedCompanyFromJd &&
    !companyValuesAgree(collectedCompany, extractedCompanyFromJd);

  let canonicalCompany = "";
  if (companyMismatchFlag) {
    canonicalCompany = extractedCompanyFromJd || domainCompany || "unclear";
  } else {
    canonicalCompany = extractedCompanyFromJd || collectedCompany || domainCompany || "unclear";
  }

  let companyConfidence: CompanyConfidence = "low";
  if (companyMismatchFlag || canonicalCompany === "unclear") {
    companyConfidence = "low";
  } else if (
    collectedCompany &&
    extractedCompanyFromJd &&
    companyValuesAgree(collectedCompany, extractedCompanyFromJd)
  ) {
    companyConfidence = "high";
  } else if (canonicalCompany || domainCompany) {
    companyConfidence = "medium";
  }

  return {
    collectedCompany,
    extractedCompanyFromJd,
    applyUrlDomain,
    canonicalCompany,
    companyConfidence,
    companyMismatchFlag
  };
}

function includesAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value.toLowerCase()));
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function parseRequiredYears(text: string) {
  const rangeHits = [...text.matchAll(/(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years|yrs)/gi)].map((match) =>
    Number.parseInt(match[2] ?? "", 10)
  );
  const patterns = [
    /(\d+)\s*\+\s*(?:years|yrs)/gi,
    /(?:at least|minimum of|min\.?)\s*(\d+)\s*(?:years|yrs)/gi,
    /(\d+)\s*(?:or more)\s*(?:years|yrs)/gi,
    /(\d+)\s*(?:years|yrs)(?:\s+of\s+experience)?/gi
  ];
  const hits = patterns.flatMap((pattern) =>
    [...text.matchAll(pattern)].map((match) => Number.parseInt(match[1] ?? "", 10))
  );
  const numeric = [...rangeHits, ...hits].filter((value) => !Number.isNaN(value));
  return numeric.length > 0 ? Math.max(...numeric) : null;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0].trim();
  }
  return "";
}

export function canonicalizeJobUrl(raw: string) {
  const value = (raw ?? "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const removable = [
      "trk",
      "refId",
      "trackingId",
      "position",
      "pageNum",
      "origin",
      "originalSubdomain",
      "lipi",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content"
    ];
    for (const key of removable) {
      url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}

export function detectAtsPlatform(url: string) {
  const value = normalize(url);
  if (value.includes("greenhouse.io") || value.includes("boards.greenhouse")) return "greenhouse";
  if (value.includes("lever.co") || value.includes("jobs.lever")) return "lever";
  if (value.includes("ashbyhq.com") || value.includes("jobs.ashby")) return "ashby";
  if (value.includes("myworkdayjobs.com") || value.includes("workdayjobs")) return "workday";
  if (value.includes("linkedin.com/jobs")) return "linkedin";
  if (value.includes("simplify.jobs")) return "simplify";
  if (value.includes("wellfound.com")) return "wellfound";
  if (value.includes("ycombinator.com/companies")) return "yc";
  return value ? "company/public web" : "unknown";
}

export function buildDedupeKey(input: { company: string; title: string; location: string; applyUrl: string }) {
  return [
    normalizeLoose(input.company),
    normalizeLoose(input.title),
    normalizeLoose(input.location),
    canonicalizeJobUrl(input.applyUrl).toLowerCase()
  ].join("|");
}

function classifyRemoteHybridOnsite(text: string, location: string): RemoteHybridOnsite {
  if (/\b(hybrid|partially remote)\b/i.test(location)) return "hybrid";
  if (/\b(on[- ]?site|onsite|in office|office-based)\b/i.test(location)) return "onsite";
  if (/\b(remote|work from home)\b/i.test(location)) return "remote";

  const combined = `${text} ${location}`;
  if (/\b(hybrid|partially remote)\b/i.test(combined)) return "hybrid";
  if (/\b(on[- ]?site|in office|office-based)\b/i.test(combined)) return "onsite";
  if (/\b(remote|work from home|distributed team)\b/i.test(combined)) return "remote";
  return "unclear";
}

function classifyEmploymentType(text: string): EmploymentType {
  const sanitized = text.replace(/\binternship experience does not qualify\b/gi, "");
  if (/\b(contract[- ]to[- ]hire|contract to hire|c2h)\b/i.test(sanitized)) return "contract-to-hire";
  if (/\b(contract|1099|c2c|corp to corp|temporary)\b/i.test(sanitized)) return "contract";
  if (/\b(part[- ]time)\b/i.test(sanitized)) return "part-time";
  if (/\b(intern|internship)\b/i.test(sanitized)) return "internship";
  if (/\b(full[- ]time|permanent|regular employee)\b/i.test(sanitized)) return "full-time";
  return "unclear";
}

function classifySeniority(title: string, text: string, yearsRequired: number | null): SeniorityLevel {
  const roleIntro = `${title} ${text.slice(0, 2500)}`;
  const seniorRolePattern = /\b(?:lead|senior|sr\.?)\s+(?:front[- ]?end|frontend|software|ui|web|full[- ]?stack|application)?\s*(?:engineer|developer|architect)\b/i;
  const staffRolePattern = /\b(?:staff|principal)\s+(?:front[- ]?end|frontend|software|ui|web|full[- ]?stack|application)?\s*(?:engineer|developer|architect)\b/i;
  if (/\b(manager|director|head of|vp)\b/i.test(title)) return "manager";
  if (staffRolePattern.test(roleIntro)) return "staff/principal";
  if (/\b(staff|principal)\b/i.test(title)) return "staff/principal";
  if (seniorRolePattern.test(roleIntro) || /\b(senior|sr\.?|lead)\b/i.test(title) || (yearsRequired !== null && yearsRequired >= 7)) return "senior";
  if (/\b(entry|junior|jr\.?|new grad)\b/i.test(title) || (yearsRequired !== null && yearsRequired <= 2)) return "entry";
  if (/\b(mid[- ]level|software engineer ii|engineer ii|level 2|l2|l3|3\+ years|4\+ years|5\+ years|6\+ years)\b/i.test(text)) {
    return "mid-level";
  }
  return "unclear";
}

function isFeasibleHybrid(location: string, profile: SolomonProfile) {
  const normalizedLocation = normalize(location);
  return profile.preferences.locations.feasibleHybridRegions.some((region) => {
    const value = normalize(region);
    if (value.length <= 2) {
      return new RegExp(`\\b${value}\\b`, "i").test(normalizedLocation);
    }
    return normalizedLocation.includes(value);
  });
}

function isRareOnsiteOrRemoteFirst(text: string) {
  return /\b(remote[- ]first|mostly remote|primarily remote|no more than monthly|once a month|monthly onsite|quarterly|few times a year|as needed)\b/i.test(
    text
  );
}

function onsiteFrequencyIsClear(text: string) {
  return /\b(\d+\s*(?:days?|x)\s*(?:per|a)\s*(?:week|month|quarter)|once a month|monthly|quarterly|remote[- ]first|as needed)\b/i.test(
    text
  );
}

function commuteReviewFlags(locationRaw: string, combined: string, remoteHybridOnsite: RemoteHybridOnsite) {
  const location = normalize(`${locationRaw} ${combined.slice(0, 1200)}`);
  const flags: string[] = [];
  const hardSkips: string[] = [];
  const rareOrRemoteFirst = isRareOnsiteOrRemoteFirst(combined);

  if (remoteHybridOnsite === "hybrid" && !onsiteFrequencyIsClear(combined)) {
    flags.push("unclear_onsite_frequency");
  }

  if (remoteHybridOnsite === "remote" || rareOrRemoteFirst) {
    return { flags, hardSkips };
  }

  if (/\bbaltimore\b/i.test(location) && remoteHybridOnsite === "hybrid") {
    hardSkips.push("Baltimore hybrid without remote-first or monthly-or-less onsite");
  }
  if (/\bsparks glencoe\b/i.test(location)) {
    hardSkips.push("Sparks Glencoe commute unless remote-first");
  }
  if (/\b(annapolis junction|fort meade)\b/i.test(location)) {
    hardSkips.push("Annapolis Junction/Fort Meade commute unless remote-first");
  }
  if (/\b(washington,\s*dc|district of columbia|dc)\b/i.test(location) && remoteHybridOnsite === "hybrid") {
    flags.push("dc_commute_review");
  }
  if (/\b(northern virginia|arlington|alexandria|reston|mclean|tysons|fairfax|herndon)\b/i.test(location)) {
    flags.push("northern_virginia_commute_review");
  }
  if (/\b(germantown|gaithersburg|rockville|bethesda|silver spring)\b/i.test(location)) {
    flags.push("local_md_commute_review");
  }

  return { flags, hardSkips };
}

function parseMoneyValue(raw: string, salaryType: SalaryType) {
  const cleaned = raw.toLowerCase().replace(/[$,\s]/g, "");
  const numeric = Number.parseFloat(cleaned.replace(/k$/, ""));
  if (!Number.isFinite(numeric)) return null;
  if (cleaned.endsWith("k")) return Math.round(numeric * 1000);
  if (salaryType === "annual" && numeric >= 50 && numeric < 1000) return Math.round(numeric * 1000);
  return Math.round(numeric);
}

function salaryTypeFromContext(context: string): SalaryType {
  if (/\b(hourly|per hour|\/hr|\/hour|an hour)\b/i.test(context)) return "hourly";
  if (/\b(monthly|per month|\/mo|\/month)\b/i.test(context)) return "monthly";
  if (/\b(annual|annually|per year|\/year|\/yr|yearly|base salary|salary range|base pay|compensation range)\b/i.test(context)) {
    return "annual";
  }
  return "unknown";
}

function confidenceForSalary(rawText: string, salaryType: SalaryType, parsedMin: number | null, parsedMax: number | null): SalaryConfidence {
  if (!rawText || parsedMin === null) return "low";
  if (salaryType === "unknown") return "low";
  if (salaryType === "annual" && parsedMin < 1000) return "low";
  if (salaryType === "hourly" && parsedMin >= 10 && parsedMin <= 250) return "high";
  if (salaryType === "monthly" && parsedMin >= 1000) return "medium";
  if (salaryType === "annual" && parsedMin >= 40000 && (parsedMax === null || parsedMax <= 1000000)) return "high";
  return "medium";
}

export function parseSalaryInfo(text: string): SalaryInfo {
  const patterns = [
    /\$?\d{2,3}(?:,\d{3})?\s*[kK]?\s*(?:-|to|–|—)\s*\$?\d{2,3}(?:,\d{3})?\s*[kK]?\s*(?:per year|\/year|\/yr|annually|annual|yearly|base salary|salary range|base pay|compensation range)/i,
    /\$?\d{2,3}(?:,\d{3})?\s*[kK]?\s*(?:-|to|–|—)\s*\$?\d{2,3}(?:,\d{3})?\s*[kK]?\s*(?:per hour|\/hr|\/hour|hourly)/i,
    /\$?\d{1,3}(?:,\d{3})?\s*(?:-|to|–|—)\s*\$?\d{1,3}(?:,\d{3})?\s*(?:per month|\/mo|\/month|monthly)/i,
    /\$?\d{2,3}\s*[kK]\s*(?:-|to|–|—)\s*\$?\d{2,3}\s*[kK]/i,
    /\$?\d{2,3}(?:,\d{3})?\s*[kK]?\s*(?:per year|\/year|\/yr|annually|annual|yearly)/i,
    /\$?\d{2,3}(?:\.\d{1,2})?\s*(?:per hour|\/hr|\/hour|hourly)/i,
    /\$\d{1,3}(?:,\d{3})?(?:\.\d{1,2})?/i
  ];
  const rawText = firstMatch(text, patterns);
  if (!rawText) {
    return { rawText: "", parsedMin: null, parsedMax: null, salaryType: "unknown", confidence: "low" };
  }

  let salaryType = salaryTypeFromContext(rawText);
  if (salaryType === "unknown" && /\d\s*[kK]\b/.test(rawText)) {
    salaryType = "annual";
  }
  const moneyMatches = [...rawText.matchAll(/\$?\d{1,3}(?:,\d{3})?(?:\.\d{1,2})?\s*[kK]?/gi)].map((match) => match[0]);
  const parsed = moneyMatches
    .map((value) => parseMoneyValue(value, salaryType))
    .filter((value): value is number => value !== null);
  const parsedMin = parsed.length > 0 ? Math.min(...parsed) : null;
  const parsedMax = parsed.length > 1 ? Math.max(...parsed) : parsedMin;
  const confidence = confidenceForSalary(rawText, salaryType, parsedMin, parsedMax);

  return {
    rawText,
    parsedMin,
    parsedMax,
    salaryType,
    confidence
  };
}

function detectSponsorshipNotes(text: string) {
  if (!/\bsponsor|sponsorship|work authorization|visa\b/i.test(text)) {
    return "not mentioned";
  }
  return "mentioned; review manually, but not used as a Solomon filter";
}

function detectSponsorshipStatus(text: string): SponsorshipStatus {
  return /\bsponsor|sponsorship|work authorization|visa\b/i.test(text) ? "mentioned_review" : "not_mentioned";
}

function detectClearanceNotes(text: string) {
  if (!/\bclearance|secret|top secret|ts\/sci\b/i.test(text)) {
    return "not mentioned";
  }
  if (/\b(obtain|eligible to obtain|ability to obtain|can be obtained|after hire)\b/i.test(text)) {
    return "clearance mentioned; appears obtainable after hire";
  }
  if (/\b(active|current|must possess|required)\b.{0,40}\b(clearance|secret|top secret|ts\/sci)\b/i.test(text)) {
    return "active clearance appears required";
  }
  return "clearance mentioned; review manually";
}

function detectClearanceStatus(text: string): ClearanceStatus {
  if (!/\bclearance|secret|top secret|ts\/sci\b/i.test(text)) return "not_mentioned";
  if (/\b(obtain|eligible to obtain|ability to obtain|can be obtained|after hire)\b/i.test(text)) {
    return "obtainable_after_hire";
  }
  if (requiresActiveClearance(text)) return "active_required";
  return "mentioned_unclear";
}

function requiresActiveClearance(text: string) {
  if (!/\bclearance|secret|top secret|ts\/sci\b/i.test(text)) return false;
  if (/\b(obtain|eligible to obtain|ability to obtain|can be obtained|after hire)\b/i.test(text)) return false;
  return /\b(active|current|must possess|required)\b.{0,50}\b(clearance|secret|top secret|ts\/sci)\b/i.test(text);
}

function titleMatchesTarget(title: string, profile: SolomonProfile) {
  const targetTitles = profile.jobTargets.map(normalize);
  return [...targetTitles, ...FRONTEND_TITLE_SIGNALS].some((target) => {
    const shortTarget = target
      .replace("software engineer", "")
      .replace("engineer", "")
      .trim();
    return title.includes(target) || (!!shortTarget && title.includes(shortTarget));
  });
}

function selectResumeVariant(combined: string, bucket: JobFitBucket): ResumeVariant {
  if (bucket === "skip") return "skip/no resume variant";
  if (includesAny(combined, DESIGN_SYSTEM_SIGNALS)) return "ui-platform-design-systems";
  if (includesAny(combined, INTERNAL_TOOL_SIGNALS)) return "internal-tools-fullstack-frontend";
  if (includesAny(combined, ["production support", "on-call", "incident", "triage", "new relic", "observability"])) {
    return "production-support-frontend";
  }
  return "frontend-product-engineer";
}

function selectEvidence(profile: SolomonProfile, combined: string, variant: ResumeVariant) {
  const scored = profile.evidenceBank
    .map((item) => ({
      item,
      score:
        (item.resumeVariant === variant ? 4 : 0) +
        item.keywords.filter((keyword) => combined.includes(keyword.toLowerCase())).length
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);

  const primary = scored.length > 0 ? scored : profile.evidenceBank.filter((item) => item.resumeVariant === variant);
  return primary.slice(0, 3);
}

function formatEvidence(items: SolomonEvidence[]) {
  return items.map((item) => `${item.label}: ${item.summary}`);
}

function summarizeEvidenceMatch(items: SolomonEvidence[]) {
  return items.length > 0 ? `evidence match: ${items.map((item) => item.label).join("; ")}` : "";
}

export function summarizeFit(result: JobFitResult) {
  const reasons = [...result.reasons];
  if (result.matchedSkills.length > 0) reasons.push(`matched ${result.matchedSkills.slice(0, 6).join("/")}`);
  if (result.risksGaps.length > 0) reasons.push(`risks ${result.risksGaps.slice(0, 3).join("/")}`);
  return `fit=${result.score} ${result.bucket} | ${reasons.join(" | ")}`;
}

export function scoreJobFit(profile: SolomonProfile, input: ScoreInput): JobFitResult {
  const titleRaw = input.title || input.fallbackTitle || "";
  const companyRaw = input.company || input.fallbackCompany || "";
  const locationRaw = input.location || input.fallbackLocation || "";
  const sourceUrl = input.sourceUrl || input.applyUrl || "";
  const canonicalApplyUrl = canonicalizeJobUrl(input.applyUrl || input.sourceUrl || "");
  const atsPlatform = detectAtsPlatform(canonicalApplyUrl || sourceUrl);
  const companyVerification = verifyCompany({
    collectedCompany: input.collectedCompany ?? input.fallbackCompany ?? input.company,
    extractedCompanyFromJd: input.extractedCompanyFromJd ?? input.company,
    applyUrl: canonicalApplyUrl || sourceUrl,
    fallbackCompany: input.fallbackCompany
  });
  if (
    (input.sourceType === "aggregator" || input.sourceType === "remoteJobBoard") &&
    !companyVerification.extractedCompanyFromJd
  ) {
    companyVerification.canonicalCompany = "unclear";
    companyVerification.companyConfidence = "low";
  }

  const title = normalize(titleRaw);
  const description = normalize(input.descriptionText || "");
  const location = normalize(locationRaw);
  const requiredSkillsText = normalize(input.requiredSkills?.join(" ") || "");
  const combined = `${title}\n${companyRaw}\n${location}\n${description}\n${requiredSkillsText}`;

  const reasons: string[] = [];
  const whyItFits: string[] = [];
  const risksGaps: string[] = [];
  const missingSignals: string[] = [];
  const manualReviewFlags: string[] = [];
  const matchedSkills: string[] = [];
  const hardSkips: string[] = [];
  let score = 0;
  let stretch = false;

  const remoteHybridOnsite = classifyRemoteHybridOnsite(combined, locationRaw);
  const employmentType = classifyEmploymentType(combined);
  const salaryInfo = parseSalaryInfo(combined);
  const sponsorshipNotes = detectSponsorshipNotes(combined);
  const sponsorshipStatus = detectSponsorshipStatus(combined);
  const clearanceNotes = detectClearanceNotes(combined);
  const clearanceStatus = detectClearanceStatus(combined);
  const yearsRequired = parseRequiredYears(combined);
  const seniorityLevel = classifySeniority(title, combined, yearsRequired);
  const commuteReview = commuteReviewFlags(locationRaw, combined, remoteHybridOnsite);

  if (!salaryInfo.rawText) manualReviewFlags.push("missing_salary");
  if (salaryInfo.rawText && salaryInfo.confidence === "low") manualReviewFlags.push("salary_unclear");
  if (employmentType === "unclear") manualReviewFlags.push("unclear employment type");
  if (remoteHybridOnsite === "unclear") manualReviewFlags.push("unclear remote policy");
  if (seniorityLevel === "unclear") manualReviewFlags.push("unclear seniority");
  if (clearanceNotes === "clearance mentioned; review manually") manualReviewFlags.push("unclear clearance");
  manualReviewFlags.push(...commuteReview.flags);
  if (companyVerification.companyMismatchFlag) {
    manualReviewFlags.push("company_mismatch");
    risksGaps.push("Manual company verification required.");
  }
  if (companyVerification.canonicalCompany === "unclear") {
    manualReviewFlags.push("company_unclear");
  }

  if (employmentType === "contract" || employmentType === "contract-to-hire") hardSkips.push(`${employmentType} role`);
  if (employmentType === "internship") hardSkips.push("internship role");
  if (employmentType === "part-time") hardSkips.push("part-time role");
  if (/\b(relocation required|must relocate)\b/i.test(combined)) hardSkips.push("relocation required");
  if (/\b(onsite 5 days|on-site 5 days|5 days onsite|5 days in office)\b/i.test(combined)) hardSkips.push("frequent onsite requirement");
  if (remoteHybridOnsite === "onsite" && !isFeasibleHybrid(locationRaw, profile)) hardSkips.push("onsite outside feasible MD/DC/VA area");
  if (requiresActiveClearance(combined)) hardSkips.push("active clearance required");
  hardSkips.push(...commuteReview.hardSkips);
  if (seniorityLevel === "staff/principal" || seniorityLevel === "manager") hardSkips.push(`${seniorityLevel} scope`);
  if (includesAny(combined, MOBILE_NATIVE_SIGNALS)) hardSkips.push("mobile-native focus");
  if (includesAny(combined, ML_TRAINING_SIGNALS)) hardSkips.push("ML model training focus");

  if (titleMatchesTarget(title, profile)) {
    score += profile.scoringWeights.targetTitle ?? 22;
    reasons.push("title aligns with Solomon's frontend/product target");
  }
  if (/\b(frontend|front end|front-end|ui)\b/i.test(title)) {
    score += profile.scoringWeights.frontendTitle ?? 14;
    whyItFits.push("frontend/UI title aligns with Solomon's target role family");
  }

  const skillChecks: Array<[string, string, number]> = [
    ["React", "react", profile.scoringWeights.react ?? 15],
    ["TypeScript", "typescript", profile.scoringWeights.typescript ?? 15],
    ["JavaScript", "javascript", profile.scoringWeights.javascript ?? 8],
    ["GraphQL", "graphql", 5],
    ["Storybook", "storybook", 5],
    ["Jest", "jest", 4],
    ["Playwright", "playwright", 4],
    ["React Testing Library", "react testing library", 4],
    ["Figma", "figma", 3],
    ["accessibility", "accessibility", 4]
  ];

  for (const [label, needle, points] of skillChecks) {
    if (combined.includes(needle)) {
      score += points;
      matchedSkills.push(label);
    }
  }

  if (combined.includes("react") && combined.includes("typescript")) {
    score += 10;
    reasons.push("React plus TypeScript match is central to Solomon's positioning");
    whyItFits.push("uses the React/TypeScript production frontend stack Solomon has shipped in");
  }

  if (includesAny(combined, TESTING_ACCESSIBILITY_SIGNALS)) {
    score += profile.scoringWeights.testingOrAccessibility ?? 8;
    whyItFits.push("testing/accessibility expectations map to shipped ESPN and Disney component work");
  }
  if (includesAny(combined, DESIGN_SYSTEM_SIGNALS)) {
    score += profile.scoringWeights.designSystems ?? 12;
    whyItFits.push("design-system/component-library work maps to Disney crossover component experience");
  }
  if (includesAny(combined, INTERNAL_TOOL_SIGNALS)) {
    score += profile.scoringWeights.internalTools ?? 10;
    whyItFits.push("internal/admin tooling maps to espnadmin shipped workflow work");
  }
  if (includesAny(combined, MEDIA_SPORTS_CONSUMER_SIGNALS)) {
    score += profile.scoringWeights.mediaSportsConsumer ?? 8;
    whyItFits.push("media/sports/consumer UI domain maps to ESPN production work");
  }
  if (includesAny(combined, AI_ASSISTED_SIGNALS)) {
    score += profile.scoringWeights.aiAssistedFrontend ?? 6;
    whyItFits.push("AI-assisted development signal is relevant if responsible frontend ownership is the core job");
  }

  if (employmentType === "full-time") score += profile.scoringWeights.fullTime ?? 8;
  if (remoteHybridOnsite === "remote" || (remoteHybridOnsite === "hybrid" && isFeasibleHybrid(locationRaw, profile))) {
    score += profile.scoringWeights.remoteOrFeasibleHybrid ?? 10;
  }
  if (seniorityLevel === "mid-level") score += profile.scoringWeights.midLevel ?? 8;

  if (seniorityLevel === "senior") {
    score += profile.scoringWeights.seniorStretchPenalty ?? -12;
    stretch = true;
    risksGaps.push("senior scope may need referral or careful positioning");
  }
  if (yearsRequired !== null) {
    if (yearsRequired >= 10) {
      hardSkips.push(`${yearsRequired}+ years required`);
    } else if (yearsRequired >= profile.preferences.seniority.stretchYearsMin) {
      stretch = true;
      risksGaps.push(`${yearsRequired}+ years is above Solomon's 3-6 year target`);
    }
  }

  if (includesAny(combined, BACKEND_HEAVY_SIGNALS) && !/\b(frontend|front end|react|ui)\b/i.test(combined)) {
    score += profile.scoringWeights.backendHeavyPenalty ?? -24;
    risksGaps.push("backend ownership appears to be the main focus");
    manualReviewFlags.push("unclear frontend/backend split");
  }
  if (includesAny(combined, INFRA_HEAVY_SIGNALS) && !/\b(frontend|front end|react|ui)\b/i.test(combined)) {
    score += profile.scoringWeights.infrastructureHeavyPenalty ?? -30;
    risksGaps.push("infrastructure/DevOps emphasis appears too high");
  }
  if (!/\b(frontend|front end|front-end|react|typescript|javascript|ui|design system|component library)\b/i.test(combined)) {
    score += profile.scoringWeights.unclearPenalty ?? -5;
    risksGaps.push("frontend signal is weak or unclear");
    manualReviewFlags.push("unclear frontend/backend split");
  }

  if (!combined.includes("react")) missingSignals.push("React not explicit");
  if (!combined.includes("typescript")) missingSignals.push("TypeScript not explicit");
  if (remoteHybridOnsite === "onsite" && isFeasibleHybrid(locationRaw, profile)) {
    risksGaps.push("onsite/hybrid may be feasible but needs commute review");
  }
  if (sponsorshipNotes !== "not mentioned") {
    manualReviewFlags.push("sponsorship mentioned");
  }

  let bucket: JobFitBucket = score >= 78 ? "strong" : score >= 62 ? "good" : score >= 42 ? "possible" : "skip";
  if (stretch && bucket !== "skip") bucket = "stretch";
  if (hardSkips.length > 0) bucket = "skip";
  if ((companyVerification.companyMismatchFlag || companyVerification.canonicalCompany === "unclear") && bucket === "strong") {
    bucket = "good";
  }
  if (bucket === "strong" && (employmentType !== "full-time" || seniorityLevel !== "mid-level")) {
    bucket = "good";
    if (employmentType !== "full-time") risksGaps.push("full-time employment is not explicit");
    if (seniorityLevel !== "mid-level") risksGaps.push("mid-level seniority is not explicit");
  }

  const variant = selectResumeVariant(combined, bucket);
  const evidence = bucket === "skip" ? [] : selectEvidence(profile, combined, variant);
  const evidenceSummary = summarizeEvidenceMatch(evidence);
  if (evidenceSummary) reasons.push(evidenceSummary);

  if (bucket === "skip") {
    risksGaps.push(...hardSkips);
  } else if (whyItFits.length === 0) {
    whyItFits.push("adjacent software role with some overlap; needs manual review before spending application time");
  }

  const nextAction: NextAction =
    bucket === "skip"
      ? "skip"
      : bucket === "stretch"
        ? "network first"
        : bucket === "possible" || manualReviewFlags.includes("unclear frontend/backend split")
          ? "ask Solomon"
          : bucket === "good" &&
              (manualReviewFlags.length > 2 ||
                manualReviewFlags.includes("unclear employment type") ||
                manualReviewFlags.includes("unclear seniority") ||
                manualReviewFlags.includes("unclear clearance"))
            ? "research company"
            : "apply manually";

  const clampedScore = bucket === "skip" && hardSkips.length > 0 ? 0 : Math.max(0, Math.min(100, score));
  const dedupeKey = buildDedupeKey({
    company: companyVerification.canonicalCompany,
    title: titleRaw,
    location: locationRaw,
    applyUrl: canonicalApplyUrl || sourceUrl
  });

  return {
    score: clampedScore,
    bucket,
    matchedSkills: dedupe(matchedSkills).slice(0, 12),
    missingSignals: dedupe(missingSignals).slice(0, 8),
    reasons: dedupe(reasons).slice(0, 8),
    whyItFits: dedupe(whyItFits).slice(0, 6),
    risksGaps: dedupe(risksGaps).slice(0, 8),
    recommendedResumeVariant: variant,
    recommendedEvidenceBullets: formatEvidence(evidence),
    nextAction,
    remoteHybridOnsite,
    employmentType,
    seniorityLevel,
    salary: salaryInfo.rawText,
    salaryRawText: salaryInfo.rawText,
    salaryParsedMin: salaryInfo.parsedMin,
    salaryParsedMax: salaryInfo.parsedMax,
    salaryType: salaryInfo.salaryType,
    salaryConfidence: salaryInfo.confidence,
    sponsorshipNotes,
    sponsorshipStatus,
    clearanceNotes,
    clearanceStatus,
    companyVerification,
    manualReviewFlags: dedupe(manualReviewFlags),
    atsPlatform,
    canonicalApplyUrl,
    sourceUrl,
    dedupeKey
  };
}
