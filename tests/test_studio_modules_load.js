// Verifies the studio/*.js module split: files exist, are syntactically valid, are all
// loaded by studio.html, and (if Chromium is installed) studio.html boots with no
// uncaught errors and all iframe sync agents initialise.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { root, studioModulePaths } = require("./helpers");

const modules = studioModulePaths();
assert(modules.length >= 10, "studio.html must load the studio modules");
assert.strictEqual(modules[0], "studio/state.js", "state.js must load first");
assert.strictEqual(modules[modules.length - 1], "studio/main.js", "main.js (startup) must load last");
assert(!fs.existsSync(path.join(root, "studio.js")), "monolithic studio.js must be gone");

const onDisk = fs.readdirSync(path.join(root, "studio")).filter((f) => f.endsWith(".js")).map((f) => "studio/" + f);
assert.deepStrictEqual([...onDisk].sort(), [...modules].sort(), "every studio/*.js file must be loaded by studio.html (and vice versa)");

for (const m of modules) {
  const r = spawnSync(process.execPath, ["--check", path.join(root, m)], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, `${m} must parse: ${r.stderr}`);
}
console.log(`  ✓ ${modules.length} modules present, ordered and syntactically valid`);

const chrome = ["chromium", "chromium-browser", "google-chrome"].find((b) => spawnSync("which", [b]).status === 0);
if (!chrome) {
  console.log("  - Chromium not found: skipping real-browser boot check");
} else {
  const url = `file://${root}/studio.html?prod=file://${root}/demo/demo_prod.html&stg=file://${root}/demo/demo_stg.html`;
  const r = spawnSync(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--allow-file-access-from-files",
    "--enable-logging=stderr", "--v=0", "--virtual-time-budget=5000", "--dump-dom", url], { encoding: "utf8", timeout: 60000 });
  const log = r.stderr || "";
  assert(!/Uncaught|ReferenceError|SyntaxError/.test(log), "studio.html must boot without errors:\n" + log.split("\n").filter((l) => /Uncaught/.test(l)).join("\n"));
  const agents = (log.match(/Agent initialized for pane/g) || []).length;
  assert(agents >= 4, `iframes must load and initialise sync agents (got ${agents})`);
  console.log(`  ✓ studio.html booted in ${chrome} with 0 errors, ${agents} sync agents initialised`);
}
console.log("PASS");
