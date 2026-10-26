const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating Single Unified Difference Button & Strict Selection-Only Display...");

const studioHtml = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');

// 1. Verify single visible difference button in toolbar and redundant buttons hidden
assert(studioHtml.includes('id="btn-toggle-red-diffs" class="btn-diff-action btn-red-diffs inactive"'), 
  "btn-toggle-red-diffs must be inactive by default and act as primary Difference button");
assert(studioHtml.includes('id="btn-run-diff" class="btn-diff-action" title="Capture snapshots and calculate visual pixel mismatch" style="display: none !important;"'), 
  "btn-run-diff must be hidden to eliminate redundant diff buttons");
assert(studioHtml.includes('id="side-controls" style="display: none !important;"'), 
  "side-controls must be hidden to avoid duplicate diff toggles");
assert(studioHtml.includes('class="segmented-toggle" style="display: none !important;"'), 
  "swipe segmented-toggle must be hidden to avoid duplicate diff toggles");
assert(studioHtml.includes('id="chip-sync-red-diff" style="display: none !important;"'), 
  "chip-sync-red-diff must be hidden from chip bar to eliminate duplication");
console.log("PASS 1: UI has only ONE visible Difference button; redundant duplicate buttons eliminated.");

// 2. Verify differences are OFF by default
assert(studioHtml.includes('<input type="checkbox" id="check-sync-red-diff" />'), 
  "check-sync-red-diff must NOT be checked by default in HTML");
assert(studioJs.includes('checkSyncRedDiff.checked = false;'), 
  "checkSyncRedDiff.checked must initialize to false");
assert(studioJs.includes('let isColDiffActive = false;'), 
  "isColDiffActive must default to false");
assert(studioJs.includes('let swipeCompareMode = "prod";'), 
  "swipeCompareMode must default to prod (no diffs)");
console.log("PASS 2: Differences strictly default to OFF with zero diffs displayed on initial load.");

// 3. Verify differences are ONLY displayed when the Difference button is selected
assert(studioJs.includes('if (checkSyncRedDiff && checkSyncRedDiff.checked) {\n          if (swipeProdLandmarks && swipeStgLandmarks'), 
  "Landmark updates in swipe mode must only compute diffs if Difference button is selected");
assert(studioJs.includes('if (checkSyncRedDiff && checkSyncRedDiff.checked) {\n          if (colProdLandmarks && colStgLandmarks'), 
  "Landmark updates in side-by-side mode must only compute diffs if Difference button is selected");
console.log("PASS 3: Background frame updates strictly obey Difference button selection.");

// 4. Verify btnToggleRedDiffs toggles both 3rd column and swipe diff views in lockstep with diff state
assert(studioJs.includes('if (checkSyncRedDiff.checked) {\n        computeAndApplyRedDifferences(true);\n        if (currentMode === "swipe" && swipeCompareMode !== "diff") {\n          setSwipeCompareMode("diff");\n        } else if (currentMode === "side-by-side") {\n          isColDiffActive = true;'), 
  "btnToggleRedDiffs must activate 3rd column or swipe diff when Difference button is selected");
assert(studioJs.includes('clearAllRedDiffs(true);\n        if (currentMode === "swipe") {\n          setSwipeCompareMode("prod");\n          updateAllDiffPercentDisplays("0.00%");\n        } else if (currentMode === "side-by-side") {\n          isColDiffActive = false;'), 
  "btnToggleRedDiffs must deactivate 3rd column and swipe diff when Difference button is unselected");
console.log("PASS 4: Difference button selection cleanly opens and closes diff views across all modes.");

// 5. Verify mode switching honors Difference button selection
assert(studioJs.includes('isColDiffActive = Boolean(checkSyncRedDiff && checkSyncRedDiff.checked);'), 
  "switchMode to side-by-side must only show 3rd column if Difference button is selected");
assert(studioJs.includes('const targetCompare = (checkSyncRedDiff && checkSyncRedDiff.checked) ? "diff" : "prod";'), 
  "switchMode to swipe must only show diff curtain if Difference button is selected");
console.log("PASS 5: Mode switching strictly honors Difference button selection.");

console.log("\nALL SINGLE DIFF BUTTON & STRICT SELECTION TESTS PASSED SUCCESSFULLY!");
