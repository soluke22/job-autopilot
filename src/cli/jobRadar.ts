import { spawnSync } from "child_process";

function argValue(args: string[], name: string) {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.split("=").slice(1).join("=");
  const flag = args.indexOf(`--${name}`);
  return flag >= 0 ? args[flag + 1] : undefined;
}

function hasFlag(args: string[], name: string) {
  return args.includes(`--${name}`);
}

function runScript(script: string, args: string[] = []) {
  const exe = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(exe, ["run", script, "--", ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const skipCollect = hasFlag(args, "skip-collect");
  const collectArgs: string[] = [];
  const analyzeArgs: string[] = [];

  const url = argValue(args, "url");
  const count = argValue(args, "count");
  const csv = argValue(args, "csv");
  if (url) collectArgs.push(`--url=${url}`);
  if (count) collectArgs.push(`--count=${count}`);
  if (csv) analyzeArgs.push(`--csv=${csv}`);
  if (count) analyzeArgs.push(`--limit=${count}`);

  if (!skipCollect) {
    runScript(url ? "collectLinkedIn" : "discoverJds", collectArgs);
  }
  runScript("analyzeJds", analyzeArgs);
  runScript("generateJobDigest");
}

main();
