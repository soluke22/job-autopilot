import { chromium, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { CsvRow, readCsv, writeCsv } from "../utils/csv";
import { loadSolomonProfile } from "../utils/solomonProfile";
import { RAW_JOB_HEADERS } from "../sources/collection";

type JobRow = {
  title: string;
  company: string;
  location: string;
  link: string;
};

const HEADERS = RAW_JOB_HEADERS;

function getArg(name: string): string | null {
  const hit = process.argv.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes("=")) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] ?? null;
}

function normalizeCompanyForMatch(value: string) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function loadCompanyBlacklist(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function isBlacklistedCompany(company: string, blacklist: string[]) {
  const normalized = normalizeCompanyForMatch(company);
  return !!normalized && blacklist.some((blocked) => normalized.includes(normalizeCompanyForMatch(blocked)));
}

function getNextId(rows: CsvRow[]) {
  return (
    rows.reduce((max, row) => {
      const value = Number.parseInt(row.id ?? "", 10);
      return Number.isNaN(value) ? max : Math.max(max, value);
    }, 0) + 1
  );
}

function getExistingLinks(rows: CsvRow[]) {
  return new Set(rows.map((row) => row.link || row.sourceUrl || row.applyUrl).filter(Boolean));
}

function readExistingRows(filePath: string) {
  if (!fs.existsSync(filePath)) return [];
  return readCsv(filePath);
}

async function autoScroll(page: Page, times: number) {
  for (let i = 0; i < times; i += 1) {
    const didScroll = await page.evaluate(() => {
      const isScrollable = (el: HTMLElement | null) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const overflow = style.overflowY || style.overflow;
        return (overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight;
      };

      const findScrollableParent = (el: HTMLElement | null) => {
        let cur = el?.parentElement ?? null;
        while (cur) {
          if (isScrollable(cur)) return cur;
          cur = cur.parentElement;
        }
        return null;
      };

      const card =
        (document.querySelector("li.jobs-search-results__list-item") as HTMLElement | null) ||
        (document.querySelector("li.jobs-search__results-list-item") as HTMLElement | null) ||
        (document.querySelector("div.job-card-container") as HTMLElement | null) ||
        (document.querySelector("li[data-occludable-job-id]") as HTMLElement | null);

      const list =
        (document.querySelector("ul.jobs-search__results-list") as HTMLElement | null) ||
        (document.querySelector("div.jobs-search-results-list") as HTMLElement | null) ||
        (document.querySelector("div.jobs-search__results-list") as HTMLElement | null) ||
        (document.querySelector("div.scaffold-layout__list") as HTMLElement | null) ||
        (document.querySelector("div.scaffold-layout__list-container") as HTMLElement | null);

      const target = findScrollableParent(card) ?? findScrollableParent(list);
      if (target && target.scrollHeight > target.clientHeight) {
        const before = target.scrollTop;
        target.scrollTop = before + target.clientHeight * 0.9;
        return target.scrollTop !== before;
      }

      const before = window.scrollY;
      window.scrollBy(0, 900);
      return window.scrollY !== before;
    });

    if (!didScroll) {
      await page.mouse.wheel(0, 1200);
    }
    await page.waitForTimeout(500);
  }
}

async function extractJobs(page: Page): Promise<JobRow[]> {
  return page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href*='/jobs/view/']"));
    const normalize = (href: string) => {
      try {
        const url = new URL(href);
        url.search = "";
        url.hash = "";
        return url.toString();
      } catch {
        return href;
      }
    };
    const text = (el: Element | null | undefined) => (el as HTMLElement | null)?.innerText?.trim() ?? "";
    const seen = new Set<string>();
    const rows: JobRow[] = [];

    for (const anchor of anchors) {
      const href = normalize(anchor.href);
      if (!href || seen.has(href)) continue;
      seen.add(href);

      const card =
        anchor.closest("li") ||
        anchor.closest("div.jobs-search-results__list-item") ||
        anchor.closest("div.job-card-container") ||
        anchor.parentElement;

      const title =
        text(card?.querySelector("span[aria-hidden='true']")) ||
        text(card?.querySelector("a.job-card-list__title")) ||
        text(card?.querySelector("h3")) ||
        text(anchor);

      const company =
        text(card?.querySelector(".job-card-container__primary-description")) ||
        text(card?.querySelector(".job-card-container__company-name")) ||
        text(card?.querySelector("span.job-card-container__company-name")) ||
        text(card?.querySelector("a.job-card-container__company-name")) ||
        text(card?.querySelector(".job-card-container__subtitle")) ||
        text(card?.querySelector(".artdeco-entity-lockup__subtitle")) ||
        text(card?.querySelector("h4")) ||
        "";

      const location =
        text(card?.querySelector(".job-card-container__metadata-item")) ||
        text(card?.querySelector(".job-card-container__metadata-wrapper")) ||
        "";

      rows.push({ title, company, location, link: href });
    }

    return rows;
  });
}

function capByRoleAndCompany(items: JobRow[], maxPerKey: number) {
  const counts = new Map<string, number>();
  const out: JobRow[] = [];
  const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

  for (const item of items) {
    const key = `${norm(item.title || "")}@@${norm(item.company || "")}`;
    if (key === "@@") {
      out.push(item);
      continue;
    }
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    if (next <= maxPerKey) out.push(item);
  }
  return out;
}

async function main() {
  loadSolomonProfile();

  const count = Math.max(1, Number.parseInt(getArg("count") ?? "10", 10) || 10);
  const url =
    getArg("url") ??
    "https://www.linkedin.com/jobs/search/?keywords=frontend%20engineer%20react%20typescript&location=United%20States&f_JT=F";

  const storagePath = path.join(process.cwd(), "storage", "linkedin.json");
  if (!fs.existsSync(storagePath)) {
    throw new Error(`LinkedIn session not found. Run: npm run authLinkedIn`);
  }

  const dataDir = path.join(process.cwd(), "data");
  const rawJobsDir = path.join(dataDir, "jobs-raw");
  fs.mkdirSync(rawJobsDir, { recursive: true });
  const outPath = path.join(rawJobsDir, "jobs.csv");
  const blacklistPath = path.join(dataDir, "blacklist-companies.txt");
  const companyBlacklist = loadCompanyBlacklist(blacklistPath);
  const existingRows = readExistingRows(outPath);
  const existingLinks = getExistingLinks(existingRows);
  const nextId = getNextId(existingRows);

  console.log("Launching browser for read-only LinkedIn collection...");
  const browser = await chromium.launch({ headless: false, slowMo: 10 });
  const context = await browser.newContext({ storageState: storagePath });
  const page = await context.newPage();

  console.log("Going to URL:");
  console.log(url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  if (page.url().includes("/login")) {
    throw new Error("Redirected to LinkedIn login. Re-run: npm run authLinkedIn");
  }

  const possibleSelectors = [
    "ul.jobs-search__results-list",
    "div.jobs-search-results-list",
    "div.scaffold-layout__list",
    "main"
  ];
  for (const selector of possibleSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 6000 });
      console.log(`Found results container: ${selector}`);
      break;
    } catch {}
  }

  const jobs: JobRow[] = [];
  const seen = new Set<string>();
  let blacklistedSkipped = 0;
  let totalScrolls = 0;
  let noProgressStreak = 0;

  while (jobs.length < count && totalScrolls < 80 && noProgressStreak < 5) {
    const before = jobs.length;
    await autoScroll(page, totalScrolls === 0 ? 10 : 4);
    totalScrolls += totalScrolls === 0 ? 10 : 4;

    const batch = await extractJobs(page);
    for (const job of batch) {
      if (!job.link || seen.has(job.link)) continue;
      seen.add(job.link);
      if (isBlacklistedCompany(job.company || "", companyBlacklist)) {
        blacklistedSkipped += 1;
        continue;
      }
      jobs.push(job);
    }

    noProgressStreak = jobs.length === before ? noProgressStreak + 1 : 0;
    console.log(`Collected ${jobs.length}/${count} job links after ${totalScrolls} scrolls.`);
  }

  const capped = capByRoleAndCompany(jobs, 2).slice(0, count);
  const today = new Date().toISOString().slice(0, 10);
  const rowsForCsv = capped
    .filter((job) => !existingLinks.has(job.link))
    .map((job, index) => ({
      id: String(nextId + index),
      source: "linkedin",
      sourceName: "linkedin",
      sourceType: "linkedIn",
      title: job.title || "",
      company: job.company || "",
      location: job.location || "",
      link: job.link,
      sourceUrl: job.link,
      applyUrl: job.link,
      dateFound: today,
      sourceConfidence: "medium",
      approved: "false",
      manualStatus: "unreviewed",
      notes: "discovery-only; review manually"
    }));

  writeCsv(outPath, [...existingRows, ...rowsForCsv], HEADERS);

  console.log(`Raw extracted job links: ${jobs.length}`);
  if (blacklistedSkipped > 0) console.log(`Skipped ${blacklistedSkipped} jobs due to company blacklist.`);
  console.log(`Wrote CSV: ${outPath}`);
  console.log("Discovery-only collection complete. Review, analyze, and apply manually outside this tool.");

  await browser.close();
}

main().catch((error) => {
  console.error("collectJobs failed:", error);
  process.exit(1);
});
