#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const separator = process.argv.indexOf("--");
const args = separator >= 0 ? process.argv.slice(separator + 1) : process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node scripts/run-quiet.js -- <command> [arguments...]");
  process.exit(2);
}

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "tanda-forge-check-"));
const logPath = path.join(logDir, "output.log");
const log = fs.createWriteStream(logPath);
const startedAt = Date.now();
const child = spawn(args[0], args.slice(1), {
  cwd: process.cwd(),
  env: process.env,
  shell: false,
  stdio: ["inherit", "pipe", "pipe"],
});
let output = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    output += text;
    log.write(text);
  });
}
child.on("error", (error) => {
  log.end();
  console.error(`Unable to start ${args[0]}: ${error.message}`);
  console.error(`Log: ${logPath}`);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  log.end();
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const notable = output.split(/\r?\n/)
    .filter((line) => /\b(warn(?:ing)?|deprecated|error)\b/i.test(line))
    .slice(-20);
  if (code === 0 && !signal) {
    console.log(`PASS (${seconds}s): ${args.join(" ")}`);
    if (notable.length) {
      console.log("Notable output:");
      console.log(notable.join("\n"));
    }
    return;
  }
  const lines = output.trimEnd().split(/\r?\n/);
  console.error(`FAIL (${seconds}s, ${signal ?? `exit ${code ?? 1}`}): ${args.join(" ")}`);
  console.error(lines.slice(-80).join("\n"));
  console.error(`Complete log: ${logPath}`);
  process.exitCode = code || 1;
});
