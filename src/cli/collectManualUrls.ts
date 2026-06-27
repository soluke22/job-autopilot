import * as fs from "fs";
import * as path from "path";
import { readCsv, writeCsv } from "../utils/csv";
import { JobLeadRecord } from "../utils/jobRadarOutput";
import { RAW_JOB_HEADERS } from "../sources/collection";

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function getNextId(rows: Array<Record<string, string>>) {
  return (
    rows.reduce((max, row) => {
      const value = Number.parseInt(row.id ?? "", 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0) + 1
  );
}

function splitPipe(line: string) {
  return line.split("|").map((part) => part.trim());
}

function stableLeadId(company: string, signalUrl: string) {
  return `lead-${Buffer.from(`${company}|${signalUrl}`).toString("base64url").slice(0, 12)}`;
}

function toLead(parts: string[]): JobLeadRecord {
  const company = parts[1] || "Unknown company";
  const signalUrl = parts[2] || "";
  const whyWorthWatching = parts[3] || "Public signal suggests the company may be hiring.";
  return {
    leadId: stableLeadId(company, signalUrl),
    company,
    signalSource: "manual-public-url",
    signalUrl,
    signalType: "manual_signal",
    whyWorthWatching,
    whyWatch: whyWorthWatching,
    likelyRoleFamily: parts[4] || "frontend/product UI",
    suggestedSearchTerms: (parts[5] || "frontend engineer, react, typescript")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean),
    suggestedNetworkingTarget: parts[6] || "frontend engineering manager or recruiter",
    confidence: (parts[7] === "high" || parts[7] === "low" ? parts[7] : "medium") as "high" | "medium" | "low",
    applyable: false,
    notes: parts[8] || ""
  };
}

function main() {
  const rawDir = path.join(process.cwd(), "data", "jobs-raw");
  const leadsDir = path.join(process.cwd(), "data", "leads");
  ensureDir(rawDir);
  ensureDir(leadsDir);
  const inputPath = path.join(rawDir, "manual-urls.txt");
  const jobsPath = path.join(rawDir, "jobs.csv");
  const leadsPath = path.join(leadsDir, "job-leads.json");

  if (!fs.existsSync(inputPath)) {
    fs.writeFileSync(
      inputPath,
      [
        "# One URL per line becomes a discovery-only job row.",
        "# job|Company|Title|Location|https://public-ats.example/job",
        "# lead|Company|Signal source URL|Why watch|Likely role family|search term 1, search term 2|Networking target|medium|notes",
        ""
      ].join("\n"),
      "utf8"
    );
    console.log(`Created template: ${inputPath}`);
    return;
  }

  const existingRows = fs.existsSync(jobsPath) ? readCsv(jobsPath) : [];
  const existingLinks = new Set(existingRows.map((row) => row.link || row.sourceUrl || row.applyUrl).filter(Boolean));
  const nextId = getNextId(existingRows);
  const today = new Date().toISOString().slice(0, 10);
  const jobRows: Array<Record<string, string>> = [];
  const leads: JobLeadRecord[] = fs.existsSync(leadsPath) ? JSON.parse(fs.readFileSync(leadsPath, "utf8")) : [];

  const lines = fs
    .readFileSync(inputPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  for (const line of lines) {
    const parts = splitPipe(line);
    const kind = parts[0]?.toLowerCase();
    if (kind === "lead") {
      leads.push(toLead(parts));
      continue;
    }

    const url = kind === "job" ? parts[4] : line;
    if (!url || existingLinks.has(url)) continue;
    jobRows.push({
      id: String(nextId + jobRows.length),
      source: "manual-public-url",
      title: kind === "job" ? parts[2] || "" : "",
      company: kind === "job" ? parts[1] || "" : "",
      location: kind === "job" ? parts[3] || "" : "",
      link: url,
      sourceUrl: url,
      applyUrl: url,
      dateFound: today,
      sourceName: "manual-public-url",
      sourceType: "manualUrl",
      sourceConfidence: "medium",
      approved: "false",
      manualStatus: "unreviewed",
      notes: "manual public URL; discovery-only"
    });
  }

  writeCsv(jobsPath, [...existingRows, ...jobRows], RAW_JOB_HEADERS);
  const seenLeadIds = new Set<string>();
  const dedupedLeads = leads.filter((lead) => {
    if (seenLeadIds.has(lead.leadId)) return false;
    seenLeadIds.add(lead.leadId);
    return true;
  });
  fs.writeFileSync(leadsPath, JSON.stringify(dedupedLeads, null, 2), "utf8");
  console.log(`Imported ${jobRows.length} job URL(s) into ${jobsPath}`);
  console.log(`Stored ${dedupedLeads.length} hidden-market lead(s) in ${leadsPath}`);
}

main();
