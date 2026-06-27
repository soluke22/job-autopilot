# Job Radar

Discovery-only job-description collection, dedupe, scoring, digest generation, hidden-market lead tracking, and JD handoff for Solomon Lucas-Thornton.

Job Radar does not auto-apply. It does not fill forms, upload resumes, send emails, create Gmail drafts, message recruiters, bypass logins, or click final apply buttons in the normal workflow. Solomon reviews roles and applies manually.

## Candidate Positioning

Solomon Lucas-Thornton is positioned as a mid-level frontend-focused Software Engineer: a production React/TypeScript frontend engineer with Disney/ESPN experience across product UI, shared component systems, TypeScript modernization, internal tools, testing, production support, and backend-driven data integration.

The scoring profile lives in `config/solomon-profile.json`. It intentionally avoids unsupported claims such as owning Disney's design system, leading modernization, backend ownership, staff/principal scope, or unverified metrics.

## Architecture

The core workflow is now centered on normalized job-description records, not applications:

1. Source adapters describe read-only sources such as LinkedIn, company career pages, Greenhouse, Lever, Ashby, Workday, remote boards, aggregators, manual URLs, and hidden-market leads.
2. `config/job-sources.json` stores configured source lists, search URLs, board URLs, manual job URLs, and lead URLs.
3. Collectors write local discovery rows under `data/jobs-raw/` and lead records under `data/leads/`.
4. `analyzeJds` opens public JD pages read-only, extracts text, verifies company evidence, parses salary confidence, applies commute/seniority/employment/clearance rules, dedupes jobs, and writes local outputs.
5. `exportForTailoring` writes a selected JD package into the separate resume-tailoring repo.

The normalized JD record tracks fields such as `jobId`, `canonicalCompany`, `collectedCompany`, `extractedCompanyFromJd`, `applyUrlDomain`, source metadata, clean JD text/hash, location/work mode, employment type, seniority, salary confidence, clearance/sponsorship status, company mismatch flags, manual review flags, fit bucket, fit score, resume variant, evidence bullets, risks/gaps, and `manualStatus`.

`manualStatus` defaults to `unreviewed`. Job Radar never sets `apply_priority` automatically.

## Setup

```powershell
npm install
npx playwright install
```

LinkedIn collection requires a local browser session:

```powershell
npm run authLinkedIn
```

Private contact data, resumes, cookies, tokens, sessions, `.env`, and generated outputs stay ignored.

## Commands

```powershell
npm run discoverJds
npm run collectLinkedIn -- --count=10 --url "YOUR_LINKEDIN_SEARCH_URL"
npm run collectRemoteBoards
npm run collectCompanyBoards
npm run collectManualUrls
npm run collectHiddenMarketLeads
npm run analyzeJds
npm run generateJobDigest
npm run exportForTailoring -- --jobId <jobId> --targetRepo "C:\Users\solom\OneDrive\Documents\GitHub\resume-tailoring-workflow"
npm run jobRadar
```

`discoverJds` imports configured direct JD URLs and hidden-market leads from `config/job-sources.json`. LinkedIn search collection remains `collectLinkedIn` because it uses an authenticated local browser session. Company board and remote board commands use the same adapter/config model and are safe for configured URL imports; live board crawling should remain small, source-specific, and opt-in in future adapters.

Useful options:

```powershell
npm run discoverJds -- --limit=10 --dry-run
npm run discoverJds -- --sourceType=greenhouse,lever --include-disabled --limit=10
npm run analyzeJds -- --limit=10
npm run jobRadar -- --count=10 --url "YOUR_LINKEDIN_SEARCH_URL"
```

## Adding Sources

Edit `config/job-sources.json`:

- Add direct public JD URLs under `jobUrls` when available.
- Add Greenhouse, Lever, Ashby, Workday, or company career board URLs under the matching source entry for future source-specific collection.
- Preserve aggregator/repost attribution as the source, even when the canonical company comes from the JD body or apply URL.
- Add funding, hiring-post, engineering-blog, or general careers signals under `leadUrls`; these become non-applyable hidden-market leads.

If collected company, extracted JD company, and apply URL domain disagree, the job gets `company_mismatch`, cannot be Strong, and the digest says manual company verification is required.

## Reviewing Good And Stretch

Read `data/job-digests/job-digest.md` and focus on:

- Good roles with no company mismatch and clear full-time/remote or feasible hybrid signals.
- Stretch roles caused by senior/lead scope or 7+ year requirements.
- Manual review flags for unclear onsite frequency, salary ambiguity, company mismatch, sponsorship mention, unclear clearance, or commute review.

Roles in Baltimore hybrid, Sparks Glencoe, Annapolis Junction, or Fort Meade are skipped unless remote-first or onsite is no more than monthly. Active clearance required is skipped.

## Outputs

Generated outputs are local and gitignored:

- `data/jobs-raw/`
- `data/jobs-analyzed/all-jobs.json`
- `data/jobs-analyzed/jobsStrong.csv`
- `data/jobs-analyzed/jobsGood.csv`
- `data/jobs-analyzed/jobsPossible.csv`
- `data/jobs-analyzed/jobsStretch.csv`
- `data/jobs-analyzed/jobsSkip.csv`
- `data/jd-text/`
- `data/job-digests/job-digest.md`
- `data/job-digests/job-leads.md`
- `data/job-digests/apply-priority.md`
- `data/leads/`
- `data/tailoring-handoff/`

## Tailoring Handoff

Configure optional env vars in `.env` if desired:

```powershell
RESUME_TAILORING_REPO_DIR=C:\Users\solom\OneDrive\Documents\GitHub\resume-tailoring-workflow
RESUME_TAILORING_IMPORT_DIR=input
```

Export one selected JD:

```powershell
npm run exportForTailoring -- --jobId <jobId> --targetRepo "C:\Users\solom\OneDrive\Documents\GitHub\resume-tailoring-workflow"
```

This creates:

- `input/job-radar<jobId>/job-package.json`
- `input/job-radar<jobId>/job-description.md`
- `input/job-radar<jobId>/job-summary.md`
- `input/job-radar<jobId>/recommended-evidence.md`

The handoff contains clean JD text, source/apply metadata, scoring fields, evidence-backed bullet candidates, and claims to avoid. It does not apply to the job.

## Safety Boundary

Normal commands are read-only:

- May open public job pages.
- May extract text.
- May save local copies.
- Must not click final apply buttons.
- Must not fill forms.
- Must not upload resumes.
- Must not send messages or emails.
- Must not create Gmail drafts.
- Must not bypass logins, paywalls, robots restrictions, or rate limits.

Archived apply/outreach scripts are historical only and require explicit danger flags:

- Apply automation requires `--i-understand-this-will-apply`.
- Gmail draft creation requires `--i-understand-this-will-create-gmail-drafts`.
- Recruiter messaging requires `--i-understand-this-will-message-recruiters`.

## Validation

```powershell
npm run typecheck
npm test
```

Do not run live collection against large sources. Use direct configured URLs, manual URLs, dry runs, and `--limit=10` smoke tests first.
