# Collecting And Analyzing JDs

Job Radar is discovery-only. Collection writes local rows and lead records; it does not apply, fill forms, upload resumes, send messages, or create drafts.

## Configured Sources

Edit `config/job-sources.json` to add direct public JD URLs or lead signals.

```powershell
npm run discoverJds
npm run discoverJds -- --limit=10 --dry-run
npm run discoverJds -- --sourceType=greenhouse,lever --include-disabled --limit=10
```

Configured direct JD URLs write to `data/jobs-raw/jobs.csv`. Hidden-market signals write to `data/leads/job-leads.json` and remain non-applyable.

## LinkedIn Collection

LinkedIn uses a local authenticated browser session and stays read-only.

```powershell
npm run authLinkedIn
npm run collectLinkedIn -- --count=20 --url "YOUR_LINKEDIN_SEARCH_URL"
```

Shortcut searches:

```powershell
npm run frontendJobs
npm run softwareJobs
npm run fullstackFrontendJobs
```

## Manual Public URLs And Leads

Create the manual import template:

```powershell
npm run collectManualUrls
```

Edit `data/jobs-raw/manual-urls.txt`:

```text
https://boards.greenhouse.io/company/jobs/123
job|Company|Frontend Engineer|Remote|https://jobs.lever.co/company/abc
lead|Company|https://example.com/hiring-post|Frontend team appears to be hiring|frontend/product UI|react, typescript|frontend engineering manager|medium|watch next month
```

Run the importer again:

```powershell
npm run collectManualUrls
```

## Board Buckets

These commands use the same configured source list:

```powershell
npm run collectRemoteBoards
npm run collectCompanyBoards
npm run collectHiddenMarketLeads
```

Live crawling of boards should remain small, source-specific, polite, and opt-in. Prefer direct public JD URLs first.

## Analysis

```powershell
npm run analyzeJds
npm run analyzeJds -- --limit=10
```

Analysis extracts clean JD text, verifies company evidence, parses salary confidence, scores the JD against Solomon's profile, dedupes, and writes outputs.

Regenerate Markdown and CSV outputs from `all-jobs.json`:

```powershell
npm run generateJobDigest
```

One-command flow:

```powershell
npm run jobRadar -- --count=10 --url "YOUR_LINKEDIN_SEARCH_URL"
```

Without `--url`, `jobRadar` runs configured source import, analysis, and digest generation.

## Tailoring Export

```powershell
npm run exportForTailoring -- --jobId <jobId> --targetRepo "C:\Users\solom\OneDrive\Documents\GitHub\resume-tailoring-workflow"
```

The export creates a local handoff package under the resume-tailoring repo's `input/job-radar<jobId>/` folder and a local manifest under `data/tailoring-handoff/`.
