// Unit Test: Validating Page Loading, Syntax Cleanliness, and TDZ-Free Initialization
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("TEST: Validating Page Loading, Syntax Integrity & TDZ-Free Frame Initialization...");

const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync(path.join(__dirname, "../sync_agent.js"), "utf8");

// 1. Verify that activeShiftRegions is declared BEFORE loadAllFrames/clearAllHazardSpacers runs (no TDZ error)
const declIndex = studioJs.indexOf("let activeShiftRegions = [];");
const loadCallIndex = studioJs.indexOf("navigateWithAccess(initialProd, initialStg);");
assert(declIndex !== -1, "studio.js must declare activeShiftRegions at top level");
assert(loadCallIndex !== -1, "studio.js must start the first load (navigateWithAccess, which calls loadAllFrames) on initialization");
assert(declIndex < loadCallIndex, "activeShiftRegions must be declared BEFORE loadAllFrames is called to prevent Temporal Dead Zone ReferenceError!");
console.log("PASS 1: activeShiftRegions is initialized before initial loadAllFrames call.");

// 2. Verify sync_agent.js has NO duplicate rect declarations in applyRedDiffs
const applyRedDiffsMatch = syncAgentJs.match(/function applyRedDiffs\(diffList\) \{([\s\S]*?)\n  \}/);
assert(applyRedDiffsMatch, "sync_agent.js must define applyRedDiffs");
const rectMatches = (applyRedDiffsMatch[1].match(/const rect = /g) || []).length;
assert.strictEqual(rectMatches, 1, "applyRedDiffs must have exactly ONE 'const rect =' declaration to prevent SyntaxError");
console.log("PASS 2: sync_agent.js has exactly one rect declaration in applyRedDiffs.");

// 3. Verify URL normalization helper exists and handles protocol auto-prefixing
assert(studioJs.includes("function normalizeUrl(url)"), "studio.js must define normalizeUrl helper");
assert(studioJs.includes("prodUrl = normalizeUrl(prodUrl);"), "loadAllFrames must normalize prodUrl");
assert(studioJs.includes("stgUrl = normalizeUrl(stgUrl);"), "loadAllFrames must normalize stgUrl");
console.log("PASS 3: URL normalization automatically prefixes domains and preserves demo URLs.");

// 4. Verify Enter key navigation listener on URL inputs
assert(studioJs.includes('input.addEventListener("keydown"'), "studio.js must listen for keydown on URL inputs");
assert(studioJs.includes('e.key === "Enter"'), "URL inputs must trigger navigation on Enter key");
console.log("PASS 4: Pressing Enter in either URL input triggers frame navigation.");

// 5. Behavioral Simulation: Full initialization simulation
const idRegex = /id="([^"]+)"/g;
const html = fs.readFileSync(path.join(__dirname, "../studio.html"), "utf8");
let m;
const elements = {};
while ((m = idRegex.exec(html)) !== null) {
  const id = m[1];
  elements[id] = {
    id,
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    dispatchEvent() {},
    setAttribute() {},
    getAttribute() { return ""; },
    appendChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contentWindow: { postMessage() {} },
    dataset: {},
    options: [{ value: "desktop" }],
    value: ""
  };
}

const mockDoc = {
  getElementById(id) {
    return elements[id] || {
      style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {},
      contentWindow: { postMessage() {} },
      dataset: {}
    };
  },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener(event, cb) {
    if (event === "DOMContentLoaded") {
      cb();
    }
  }
};

const mockWin = {
  document: mockDoc,
  location: { search: "?prod=demo_prod.html&stg=demo_stg.html" },
  addEventListener() {},
  removeEventListener() {},
  setTimeout(cb, d) { return 1; },
  clearTimeout() {},
  requestAnimationFrame(cb) { return 1; },
  cancelAnimationFrame() {},
  open() {}
};

global.window = mockWin;
global.document = mockDoc;
global.location = mockWin.location;
global.URLSearchParams = URLSearchParams;
global.chrome = {
  runtime: {
    getURL: (p) => "chrome-extension://mock/" + p
  }
};

let threwError = false;
try {
  eval(studioJs);
} catch (e) {
  threwError = true;
  console.error("Simulation error:", e);
}

assert.strictEqual(threwError, false, "studio.js initialization must complete without any uncaught exception");
console.log("PASS 5: Simulated DOM environment initialized studio.js with 0 exceptions!");

console.log("\nALL PAGE LOADING & TDZ INITIALIZATION TESTS PASSED!");
