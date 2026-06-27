import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { scoreJobFit } from "../utils/jobFit";
import { loadSolomonProfile } from "../utils/solomonProfile";
import { buildRecordFromFit, JobRadarOutputPayload } from "../utils/jobRadarOutput";
import {
  APPLY_FLAG,
  GMAIL_DRAFT_FLAG,
  RECRUITER_MESSAGE_FLAG,
  assertApplyAutomationAllowed,
  assertGmailDraftsAllowed,
  assertRecruiterMessagingAllowed
} from "../utils/safety";
import { exportForTailoringPackage } from "../cli/exportForTailoring";

const profile = loadSolomonProfile();

function score(overrides: Partial<Parameters<typeof scoreJobFit>[1]> = {}) {
  return scoreJobFit(profile, {
    title: "Frontend Software Engineer II",
    company: "Example Co",
    location: "Remote",
    descriptionText:
      "Full-time React TypeScript frontend UI role. Build consumer web product features with Storybook, Jest, React Testing Library, accessibility, Figma, GraphQL, and production support. 4+ years of experience. Salary range $110k - $145k annually.",
    requiredSkills: ["React", "TypeScript", "JavaScript"],
    preferredSkills: [],
    coreResponsibilities: ["Build and ship frontend product UI"],
    seniority: "mid-level",
    domainKeywords: ["consumer"],
    collectedCompany: "Example Co",
    extractedCompanyFromJd: "Example Co",
    source: "greenhouse",
    sourceType: "greenhouse",
    sourceUrl: "https://boards.greenhouse.io/example/jobs/123",
    applyUrl: "https://boards.greenhouse.io/example/jobs/123",
    ...overrides
  });
}

const strong = score();
assert.equal(strong.bucket, "strong");
assert.equal(strong.recommendedResumeVariant, "ui-platform-design-systems");
assert.equal(strong.nextAction, "apply manually");
assert.equal(strong.salaryType, "annual");
assert.equal(strong.salaryConfidence, "high");

const companyMismatch = score({
  collectedCompany: "LinkedIn Syndicated Co",
  extractedCompanyFromJd: "Real JD Company",
  company: "Real JD Company"
});
assert.equal(companyMismatch.bucket, "good");
assert.equal(companyMismatch.companyVerification.companyMismatchFlag, true);
assert.ok(companyMismatch.manualReviewFlags.includes("company_mismatch"));
assert.ok(companyMismatch.risksGaps.some((risk) => risk.includes("Manual company verification required")));

const ambiguousSalary = score({
  descriptionText: "Full-time React TypeScript frontend UI role with Storybook, testing, accessibility, and $40 stipend."
});
assert.notEqual(ambiguousSalary.salaryType, "annual");
assert.equal(ambiguousSalary.salaryConfidence, "low");
assert.ok(ambiguousSalary.manualReviewFlags.includes("salary_unclear"));

const leadTitle = score({
  title: "Lead Frontend Engineer",
  descriptionText: "Full-time React TypeScript frontend role with accessibility and Storybook. 5+ years of experience."
});
assert.notEqual(leadTitle.bucket, "strong");
assert.ok(leadTitle.bucket === "stretch" || leadTitle.bucket === "skip");

const seniorSevenYears = score({
  title: "Senior Frontend Engineer",
  descriptionText:
    "Full-time React TypeScript frontend product role with Storybook and accessibility. 7+ years of experience required."
});
assert.notEqual(seniorSevenYears.bucket, "strong");
assert.ok(seniorSevenYears.bucket === "stretch" || seniorSevenYears.bucket === "skip");

const baltimoreHybrid = score({
  location: "Baltimore, MD (Hybrid)",
  descriptionText:
    "Full-time React TypeScript frontend role. Hybrid in Baltimore with weekly onsite collaboration. 4+ years of experience."
});
assert.equal(baltimoreHybrid.bucket, "skip");
assert.ok(baltimoreHybrid.risksGaps.some((risk) => risk.includes("Baltimore hybrid")));

const baltimoreRareOnsite = score({
  location: "Baltimore, MD (Hybrid)",
  descriptionText:
    "Full-time React TypeScript frontend role. Remote-first with no more than monthly onsite in Baltimore. 4+ years of experience."
});
assert.notEqual(baltimoreRareOnsite.bucket, "skip");

const unclearHybrid = score({
  location: "Washington, DC (Hybrid)",
  descriptionText: "Full-time React TypeScript frontend role. Hybrid collaboration expected. 4+ years of experience."
});
assert.ok(unclearHybrid.manualReviewFlags.includes("unclear_onsite_frequency"));

const contract = score({
  descriptionText: "Six month 1099 contract for React TypeScript frontend work."
});
assert.equal(contract.bucket, "skip");
assert.ok(contract.risksGaps.some((risk) => risk.includes("contract")));

const clearance = score({
  descriptionText: "Full-time React role. Active Secret clearance is required on day one."
});
assert.equal(clearance.bucket, "skip");
assert.equal(clearance.clearanceStatus, "active_required");

const remoteMidLevel = score();
assert.ok(remoteMidLevel.bucket === "good" || remoteMidLevel.bucket === "strong");

assert.throws(() => assertApplyAutomationAllowed(["node", "script"]), /disabled by default/);
assert.doesNotThrow(() => assertApplyAutomationAllowed(["node", "script", APPLY_FLAG]));
assert.throws(() => assertGmailDraftsAllowed(["node", "script"]), /disabled by default/);
assert.doesNotThrow(() => assertGmailDraftsAllowed(["node", "script", GMAIL_DRAFT_FLAG]));
assert.throws(() => assertRecruiterMessagingAllowed(["node", "script"]), /disabled by default/);
assert.doesNotThrow(() => assertRecruiterMessagingAllowed(["node", "script", RECRUITER_MESSAGE_FLAG]));

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const normalScripts = [
  "discoverJds",
  "collectLinkedIn",
  "collectRemoteBoards",
  "collectCompanyBoards",
  "collectManualUrls",
  "collectHiddenMarketLeads",
  "analyzeJds",
  "generateJobDigest",
  "exportForTailoring",
  "jobRadar"
];
for (const script of normalScripts) {
  const command = packageJson.scripts[script] ?? "";
  assert.ok(command, `${script} should exist`);
  assert.ok(!command.includes("applyBatch"), `${script} must not call apply automation`);
  assert.ok(!command.includes("createOutreachDrafts"), `${script} must not create Gmail drafts`);
  assert.ok(!command.includes("recruiterOutreach"), `${script} must not message recruiters`);
}

function testTailoringExport() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "job-radar-export-"));
  try {
    const workspaceDir = path.join(tempRoot, "workspace");
    const targetRepo = path.join(tempRoot, "resume-tailoring-workflow");
    fs.mkdirSync(path.join(workspaceDir, "config"), { recursive: true });
    fs.mkdirSync(path.join(workspaceDir, "data", "jobs-analyzed"), { recursive: true });
    fs.writeFileSync(
      path.join(workspaceDir, "config", "solomon-profile.json"),
      fs.readFileSync(path.join(process.cwd(), "config", "solomon-profile.json"), "utf8"),
      "utf8"
    );

    const fit = score();
    const record = buildRecordFromFit({
      id: "test-123",
      source: "greenhouse",
      sourceName: "greenhouse",
      sourceType: "greenhouse",
      title: "Frontend Software Engineer II",
      company: "Example Co",
      collectedCompany: "Example Co",
      extractedCompanyFromJd: "Example Co",
      location: "Remote",
      locationRaw: "Remote",
      dateFound: "2026-06-27",
      jobDescriptionText: "Clean JD text for a React TypeScript frontend role.",
      jobDescriptionHash: "abc123",
      jdTextPath: "data/jd-text/test.txt",
      sourceConfidence: "high",
      extractionConfidence: "high",
      fit
    });
    const payload: JobRadarOutputPayload = {
      generatedAt: "2026-06-27T00:00:00.000Z",
      profileName: profile.candidate.name,
      jobs: [record],
      leads: []
    };
    fs.writeFileSync(path.join(workspaceDir, "data", "jobs-analyzed", "all-jobs.json"), JSON.stringify(payload), "utf8");

    const manifest = exportForTailoringPackage({
      jobId: "test-123",
      targetRepo,
      importDir: "input",
      workspaceDir
    });

    for (const fileName of ["job-package.json", "job-description.md", "job-summary.md", "recommended-evidence.md"]) {
      assert.ok(fs.existsSync(path.join(manifest.packageDir, fileName)), `${fileName} should be written`);
    }
    const exported = JSON.parse(fs.readFileSync(path.join(manifest.packageDir, "job-package.json"), "utf8"));
    assert.equal(exported.jobId, "test-123");
    assert.equal(exported.jobDescriptionText, "Clean JD text for a React TypeScript frontend role.");
    assert.ok(fs.existsSync(manifest.manifestPath));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

testTailoringExport();

console.log("jobRadar tests passed");
