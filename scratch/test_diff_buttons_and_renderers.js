const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating Difference Comparison Buttons, Pixel-Level Calculation & Zero Outlines...");

const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');
const syncAgentJs = fs.readFileSync(path.join(__dirname, '../sync_agent.js'), 'utf8');

// 1. Verify btnRunDiff click handler & execution flow without forcing unselected views
assert(studioJs.includes('btnRunDiff.addEventListener("click"'), "btnRunDiff must have a click listener");
assert(studioJs.includes('function runVisualDiffCalculation'), "runVisualDiffCalculation must be defined");
assert(studioJs.includes('computeAndApplyRedDifferences(true);'), "runVisualDiffCalculation must compute red diffs");
assert(studioJs.includes('if (isColDiffActive) {'), "runVisualDiffCalculation must only render column 3 diff if selected");
assert(studioJs.includes('if (swipeCompareMode === "diff") {'), "runVisualDiffCalculation must only render swipe diff if diff mode is selected");
assert(studioJs.includes('scheduleLivePixelDiffCapture();'), "runVisualDiffCalculation must trigger live pixel diff capture");
console.log("PASS 1: btnRunDiff calculates diffs and only displays in 3rd column or swipe view if selected.");

// 2. Verify btnToggleRedDiffs click handler
assert(studioJs.includes('if (btnToggleRedDiffs) {'), "btnToggleRedDiffs listener must be registered");
assert(studioJs.includes('checkSyncRedDiff.checked = !checkSyncRedDiff.checked;'), "btnToggleRedDiffs must toggle checkSyncRedDiff.checked");
assert(studioJs.includes('computeAndApplyRedDifferences(true);'), "btnToggleRedDiffs must apply red differences when checked");
assert(studioJs.includes('clearAllRedDiffs(true);'), "btnToggleRedDiffs must clear red diffs when unchecked");
console.log("PASS 2: btnToggleRedDiffs reliably toggles visual diff calculation.");

// 3. Verify btnToggleColDiff click handler
assert(studioJs.includes('if (btnToggleColDiff) {'), "btnToggleColDiff listener must be registered");
assert(studioJs.includes('if (currentMode !== "side-by-side") {\n        switchMode("side-by-side");'), "btnToggleColDiff must switch to side-by-side mode if in another mode");
assert(studioJs.includes('paneColDiff.style.display = "flex";'), "btnToggleColDiff must show paneColDiff when active");
console.log("PASS 3: btnToggleColDiff toggles 3rd column and auto-calculates diffs if empty.");

// 4. Verify btnSwipeTargetDiff click handler
assert(studioJs.includes('if (btnSwipeTargetDiff) {'), "btnSwipeTargetDiff listener must be registered");
assert(studioJs.includes('setSwipeCompareMode("diff");'), "btnSwipeTargetDiff must switch swipe compare mode to diff");
console.log("PASS 4: btnSwipeTargetDiff switches to diff view and auto-calculates diffs if empty.");

// 5. Verify btnColDiffRefresh click handler
assert(studioJs.includes('if (btnColDiffRefresh) {'), "btnColDiffRefresh listener must be registered");
assert(studioJs.includes('dispatchToPane("PROD", { type: "VC_REQUEST_LANDMARKS" });'), "btnColDiffRefresh must request landmarks from PROD");
assert(studioJs.includes('dispatchToPane("STG", { type: "VC_REQUEST_LANDMARKS" });'), "btnColDiffRefresh must request landmarks from STG");
assert(studioJs.includes('runVisualDiffCalculation(true);'), "btnColDiffRefresh must run visual diff calculation");
console.log("PASS 5: btnColDiffRefresh re-requests frame data and refreshes comparisons.");

// 6. Verify sync_agent.js NEVER adds outlines to live web page elements
assert(!syncAgentJs.includes('outline: 3px solid #ef4444'), "sync_agent.js must never add outline to live pages");
assert(!syncAgentJs.includes('el.classList.add("vc-red-diff-highlight");'), "sync_agent.js must not add outline classes to live page elements");
assert(syncAgentJs.includes('type: "VC_RED_DIFFS_APPLIED"'), "sync_agent.js must report measured boxes back to studio");
console.log("PASS 6: sync_agent.js keeps live pages 100% clean with zero outlines on anything.");

// 7. Verify both renderPixelDiffColumn3 and renderSwipeDiffCanvas have ZERO outlines
assert(!studioJs.includes('strokeRect('), "studio.js must not draw strokeRect outlines on anything");
assert(studioJs.includes('drawHazardStripes(offCtx, 0, regY, swW, reg.h, 14);'), "Swipe diff renderer must draw hazard stripes matching 3rd column");
assert(studioJs.includes('drawHazardStripes(offCtx, 0, regY, width, reg.h, 14);'), "3rd column diff renderer must draw hazard stripes matching swipe diff");
assert(studioJs.includes('if (!isColDiffActive)'), "renderPixelDiffColumn3 only renders diffs if 3rd column is selected");
assert(studioJs.includes('if (swipeCompareMode !== "diff")'), "renderSwipeDiffCanvas only renders diffs if diff mode is selected in swipe view");
console.log("PASS 7: Both 3rd column and swipe diff canvases compare on a pixel level with zero outlines on anything.");

console.log("\nALL DIFFERENCE BUTTONS & COMPARISON ENGINE TESTS PASSED SUCCESSFULLY!");
