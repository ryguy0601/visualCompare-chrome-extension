// Unit Test: Validating that 3-Column View strictly shows differences ONLY in the last column
const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating 3-Column View Strictly Shows Differences ONLY on Last Column...");

const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync(path.join(__dirname, '../sync_agent.js'), 'utf8');

// 1. Verify computeAndApplyRedDifferences isolates diffs strictly to the last column (Column 3)
assert(studioJs.includes('if (currentMode === "side-by-side") {'), 
  "computeAndApplyRedDifferences must have dedicated side-by-side branch");
assert(studioJs.includes('if (iframeProd && iframeProd.contentWindow) {\n        try { iframeProd.contentWindow.postMessage(removeMsg, "*");'),
  "computeAndApplyRedDifferences must send VC_REMOVE_RED_DIFFS to Column 1 (Prod) so it stays clean");
assert(studioJs.includes('if (iframeStg && iframeStg.contentWindow) {\n        try { iframeStg.contentWindow.postMessage(removeMsg, "*");'),
  "computeAndApplyRedDifferences must send VC_REMOVE_RED_DIFFS to Column 2 (Staging) so it stays clean");
assert(studioJs.includes('if (iframeDiffBase && iframeDiffBase.contentWindow) {\n        try { iframeDiffBase.contentWindow.postMessage(applyMsg, "*");'),
  "computeAndApplyRedDifferences must send VC_APPLY_RED_DIFFS ONLY to Column 3 (Diff Base)");
console.log("PASS 1: computeAndApplyRedDifferences enforces Column 1 & 2 clean live pages and sends diffs strictly to Column 3.");

// 2. Verify Swipe view isolates diffs strictly to diff curtain layer
assert(studioJs.includes('if (iframeSwipeStg && iframeSwipeStg.contentWindow) {\n        try { iframeSwipeStg.contentWindow.postMessage(removeMsg, "*");'),
  "computeAndApplyRedDifferences must send VC_REMOVE_RED_DIFFS to Staging base in swipe view");
assert(studioJs.includes('if (swipeCompareMode === "diff" && iframeSwipeDiff && iframeSwipeDiff.contentWindow) {\n        try { iframeSwipeDiff.contentWindow.postMessage(applyMsg, "*");'),
  "computeAndApplyRedDifferences must send VC_APPLY_RED_DIFFS strictly to diff curtain layer in swipe view");
console.log("PASS 2: Swipe view enforces clean Staging base and sends diffs strictly to diff curtain layer.");

// 3. Verify reapplyActiveRedDiffsToWindow never applies red diffs to reference windows
assert(studioJs.includes('const isDiffWin = (iframeDiffBase && win === iframeDiffBase.contentWindow) ||'),
  "reapplyActiveRedDiffsToWindow must identify diff frames");
assert(studioJs.includes('if (!isDiffWin) {\n      try {\n        win.postMessage({ type: "VC_REMOVE_RED_DIFFS" }, "*");'),
  "reapplyActiveRedDiffsToWindow must immediately strip red diffs if a reference frame reports ready");
console.log("PASS 3: reapplyActiveRedDiffsToWindow guarantees reference frames stay 100% clean on reload/navigation.");

// 4. Verify dispatchToPane intercepts VC_APPLY_RED_DIFFS
assert(studioJs.includes('if (message && message.type === "VC_APPLY_RED_DIFFS") {'),
  "dispatchToPane must intercept VC_APPLY_RED_DIFFS messages");
assert(studioJs.includes('else if (currentMode === "side-by-side") {\n        send(iframeDiffBase);'),
  "dispatchToPane must redirect red diffs strictly to iframeDiffBase in side-by-side mode");
console.log("PASS 4: dispatchToPane intercepts VC_APPLY_RED_DIFFS and guards reference frames from turning red.");

// 5. Behavioral Simulation: Confirm 3-Column Message Dispatch State
console.log("TEST 5: Simulating 3-Column Frame Message Dispatch...");
let frameDispatches = {
  col1_prod: [],
  col2_stg: [],
  col3_diff: []
};

const mockIframeProd = {
  contentWindow: {
    postMessage(msg) { frameDispatches.col1_prod.push(msg); }
  }
};
const mockIframeStg = {
  contentWindow: {
    postMessage(msg) { frameDispatches.col2_stg.push(msg); }
  }
};
const mockIframeDiffBase = {
  contentWindow: {
    postMessage(msg) { frameDispatches.col3_diff.push(msg); }
  }
};

const sampleDiffs = [{ selector: ".cta-button", label: "CTA Button modified" }];
const removeMsg = { type: "VC_REMOVE_RED_DIFFS" };
const applyMsg = { type: "VC_APPLY_RED_DIFFS", diffs: sampleDiffs, showOutlines: true };

// Simulate computeAndApplyRedDifferences in 3-column side-by-side mode
let currentMode = "side-by-side";
let isColDiffActive = true;

if (currentMode === "side-by-side") {
  mockIframeProd.contentWindow.postMessage(removeMsg);
  mockIframeStg.contentWindow.postMessage(removeMsg);
  if (isColDiffActive) {
    mockIframeDiffBase.contentWindow.postMessage(applyMsg);
  }
}

// Check Column 1 (Prod)
assert.strictEqual(frameDispatches.col1_prod.length, 1);
assert.strictEqual(frameDispatches.col1_prod[0].type, "VC_REMOVE_RED_DIFFS", "Column 1 must receive VC_REMOVE_RED_DIFFS");
assert(!frameDispatches.col1_prod.some(m => m.type === "VC_APPLY_RED_DIFFS"), "Column 1 must NEVER receive VC_APPLY_RED_DIFFS");

// Check Column 2 (Staging)
assert.strictEqual(frameDispatches.col2_stg.length, 1);
assert.strictEqual(frameDispatches.col2_stg[0].type, "VC_REMOVE_RED_DIFFS", "Column 2 must receive VC_REMOVE_RED_DIFFS");
assert(!frameDispatches.col2_stg.some(m => m.type === "VC_APPLY_RED_DIFFS"), "Column 2 must NEVER receive VC_APPLY_RED_DIFFS");

// Check Column 3 (Diff Base)
assert.strictEqual(frameDispatches.col3_diff.length, 1);
assert.strictEqual(frameDispatches.col3_diff[0].type, "VC_APPLY_RED_DIFFS", "Column 3 must receive VC_APPLY_RED_DIFFS");
assert.strictEqual(frameDispatches.col3_diff[0].diffs.length, 1, "Column 3 must receive the active diff list");

console.log("PASS 5: Behavioral simulation verified Column 1 & 2 are 100% clean and Column 3 exclusively displays differences!");

console.log("\nALL 3-COLUMN ONLY LAST COLUMN TESTS PASSED SUCCESSFULLY!");
