import * as fs from "fs";
import * as path from "path";

export type ResumeVariant =
  | "frontend-product-engineer"
  | "ui-platform-design-systems"
  | "internal-tools-fullstack-frontend"
  | "production-support-frontend"
  | "skip/no resume variant";

export type SolomonEvidence = {
  id: string;
  label: string;
  resumeVariant: ResumeVariant;
  keywords: string[];
  summary: string;
};

export type SolomonProfile = {
  candidate: {
    name: string;
    targetRoleType: string;
    location: string;
    positioning: string;
  };
  jobTargets: string[];
  preferences: {
    employment: {
      preferred: string[];
      avoidUnlessApproved: string[];
    };
    locations: {
      preferred: string[];
      feasibleHybridRegions: string[];
      avoid: string[];
    };
    seniority: {
      targetYearsMin: number;
      targetYearsMax: number;
      stretchYearsMin: number;
      avoidTitles: string[];
    };
    clearance: {
      avoidActiveClearanceRequired: boolean;
      allowObtainAfterHire: boolean;
    };
    visaSponsorshipFiltering: boolean;
  };
  preferredKeywords: string[];
  cautionKeywords: string[];
  resumeVariants: ResumeVariant[];
  evidenceBank: SolomonEvidence[];
  unsupportedClaims: string[];
  scoringWeights: Record<string, number>;
  safety: {
    allowApplyAutomationDefault: boolean;
    allowGmailDraftsDefault: boolean;
    allowRecruiterMessagingDefault: boolean;
    requiredApplyFlag: string;
    requiredGmailDraftFlag: string;
    requiredRecruiterMessagingFlag: string;
  };
};

export function getSolomonProfilePath() {
  return path.join(process.cwd(), "config", "solomon-profile.json");
}

export function loadSolomonProfile(filePath = getSolomonProfilePath()): SolomonProfile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Solomon profile config not found at: ${filePath}`);
  }

  const profile = JSON.parse(fs.readFileSync(filePath, "utf8")) as SolomonProfile;
  if (!profile.candidate?.name || !Array.isArray(profile.evidenceBank) || profile.evidenceBank.length === 0) {
    throw new Error("Solomon profile config is missing candidate.name or evidenceBank.");
  }

  return profile;
}
