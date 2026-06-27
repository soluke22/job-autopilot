export type JobSourceModule = {
  id: string;
  label: string;
  status: "implemented" | "designed";
  recordType: "job" | "lead" | "job-or-lead";
  readOnlyNotes: string;
};

export const JOB_SOURCE_MODULES: JobSourceModule[] = [
  {
    id: "linkedin",
    label: "LinkedIn job search URLs",
    status: "implemented",
    recordType: "job",
    readOnlyNotes: "collectJobs opens search results and stores public job links without applying or Easy Apply interactions."
  },
  {
    id: "manual-public-url",
    label: "Public ATS or career URLs pasted manually",
    status: "implemented",
    recordType: "job-or-lead",
    readOnlyNotes: "collectManualUrls converts pasted URLs into local job rows or hidden-market lead records."
  },
  {
    id: "company-careers",
    label: "Company career pages",
    status: "implemented",
    recordType: "job-or-lead",
    readOnlyNotes: "Configured public career-page JD URLs become jobs; general hiring pages without a JD should become hidden-market leads."
  },
  {
    id: "greenhouse",
    label: "Greenhouse boards",
    status: "implemented",
    recordType: "job",
    readOnlyNotes: "Configured public Greenhouse JD URLs are collected and analyzed read-only; broader board crawling should stay opt-in and limited."
  },
  {
    id: "lever",
    label: "Lever boards",
    status: "implemented",
    recordType: "job",
    readOnlyNotes: "Configured public Lever JD URLs are collected and analyzed read-only; broader board crawling should stay opt-in and limited."
  },
  {
    id: "ashby",
    label: "Ashby boards",
    status: "implemented",
    recordType: "job",
    readOnlyNotes: "Configured public Ashby JD URLs are collected and analyzed read-only; broader board crawling should stay opt-in and limited."
  },
  {
    id: "workday",
    label: "Workday pages",
    status: "implemented",
    recordType: "job",
    readOnlyNotes: "Configured public Workday JD URLs are collected and analyzed read-only; avoid login-gated or brittle high-volume scraping."
  },
  {
    id: "remote-boards",
    label: "Sundayy, RemoteHunter, and other remote boards",
    status: "implemented",
    recordType: "job-or-lead",
    readOnlyNotes: "Configured public remote-board JD URLs become jobs; preserve the board as source attribution."
  },
  {
    id: "recruiter-posts",
    label: "Public recruiter or hiring-manager posts",
    status: "designed",
    recordType: "lead",
    readOnlyNotes: "Public posts should become leads unless they include a real JD and apply URL."
  },
  {
    id: "hidden-market",
    label: "Company hidden-market signals",
    status: "implemented",
    recordType: "lead",
    readOnlyNotes: "Funding, hiring, engineering-blog, and general careers signals should be local lead records only."
  }
];
