import * as fs from "fs";
import * as path from "path";
import { JobSourcesConfig } from "./types";

export function getJobSourcesConfigPath() {
  return path.join(process.cwd(), "config", "job-sources.json");
}

export function loadJobSourcesConfig(filePath = getJobSourcesConfigPath()): JobSourcesConfig {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Job sources config not found at: ${filePath}`);
  }

  const config = JSON.parse(fs.readFileSync(filePath, "utf8")) as JobSourcesConfig;
  if (!Array.isArray(config.sources)) {
    throw new Error("job-sources.json is missing a sources array.");
  }

  return config;
}
