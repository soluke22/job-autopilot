import * as fs from "fs";
import * as path from "path";
import { JobRadarOutputPayload, writeJobRadarOutputs } from "../utils/jobRadarOutput";
import { loadSolomonProfile } from "../utils/solomonProfile";

function main() {
  const profile = loadSolomonProfile();
  const allJobsPath = path.join(process.cwd(), "data", "jobs-analyzed", "all-jobs.json");

  if (!fs.existsSync(allJobsPath)) {
    throw new Error(`Missing ${allJobsPath}. Run npm run analyzeJobs first.`);
  }

  const payload = JSON.parse(fs.readFileSync(allJobsPath, "utf8")) as JobRadarOutputPayload;
  writeJobRadarOutputs(payload, profile);
  console.log("Regenerated job digest, lead digest, and bucket CSVs from all-jobs.json.");
}

main();
