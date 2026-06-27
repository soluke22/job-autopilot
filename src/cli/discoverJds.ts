import { collectConfiguredSources } from "../sources/collection";
import { JobSourceType } from "../sources/types";

function getArg(name: string): string | null {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes("=")) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseSourceTypes(value: string | null): JobSourceType[] | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as JobSourceType[];
}

export function runConfiguredCollection(defaultSourceTypes?: JobSourceType[]) {
  const sourceTypes = parseSourceTypes(getArg("sourceType")) ?? defaultSourceTypes;
  const limitArg = getArg("limit") ?? getArg("count");
  const limit = limitArg ? Math.max(1, Number.parseInt(limitArg, 10) || 1) : undefined;
  const includeDisabled = hasFlag("include-disabled");
  const dryRun = hasFlag("dry-run");

  const result = collectConfiguredSources({
    sourceTypes,
    includeDisabled,
    limit,
    dryRun
  });

  const sourceText = sourceTypes?.join(", ") ?? "all configured source types";
  console.log(`Source filter: ${sourceText}`);
  console.log(`Configured job URL(s): ${result.jobs.length}`);
  console.log(`Hidden-market lead(s): ${result.leads.length}`);
  if (dryRun) {
    console.log(`Dry run only. Would write jobs to ${result.jobsPath} and leads to ${result.leadsPath}.`);
  } else {
    console.log(`Wrote/updated jobs: ${result.jobsPath}`);
    console.log(`Wrote/updated leads: ${result.leadsPath}`);
  }
  console.log("Discovery-only collection complete. No applications, drafts, messages, uploads, or form fills were attempted.");
}

if (require.main === module) {
  runConfiguredCollection();
}
