#!/usr/bin/env node
/**
 * Test runner: executes every tests/test_*.js in its own process.
 * Many tests read source files via relative paths, so we always run from the
 * extension root regardless of where this script is invoked from.
 * Usage: node tests/run_all.js [name-filter]
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const filter = process.argv[2] || "";
const files = fs.readdirSync(__dirname)
  .filter((f) => /^test_.*\.js$/.test(f) && f.includes(filter))
  .sort();

const failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { cwd: root, encoding: "utf8", timeout: 120000 });
  const ok = r.status === 0;
  console.log(`${ok ? "PASS" : "FAIL"}  ${f}`);
  if (!ok) { failed.push(f); console.log((r.stdout + r.stderr).split("\n").slice(-12).join("\n")); }
}
console.log(`\n${files.length - failed.length}/${files.length} passed`);
process.exit(failed.length ? 1 : 0);
