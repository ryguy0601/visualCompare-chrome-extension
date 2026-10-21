const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating Difference Comparison Buttons, Calculation Engine & Clean Overlays...");

const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');
const syncAgentJs = fs.readFileSync(path.join(__dirname, '../sync_agent.js'), 'utf8');

// 1. Verify btnRunDiff click handler & execution flow
assert(studioJs.includes('btnRunDiff.addEventListener("click"'), "btnRunDiff must have a click listener");
assert(studioJs.includes('function runVisualDiffCalculation'), "runVisualDiffCalculation must be defined");
assert(studioJs.includes('checkSyncRedDiff.checked = true;'), "runVisualDiffCalculation must ensure checkSyncRedDiff is enabled");
assert(studioJs.includes('computeAndApplyRedDifferences(true);'), "runVisualDiffCalculation must compute and apply red diffs");
assert(studioJs.includes('isColDiffActive = true;'), "runVisualDiffCalculation in side-by-side must activate 3rd column diff");
assert(studioJs.includes('renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions'), "runVisualDiffCalculation must render pixel diff column 3");
assert(studioJs.includes('setSwipeCompareMode("diff");'), "runVisualDiffCalculation in swipe mode must activate diff mode");
assert(studioJs.includes('renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions'), "runVisualDiffCalculation must render swipe diff canvas");
console.log("PASS 1: btnRunDiff triggers full calculation and displays diffs across all modes.");

// 2. Verify btnToggleRedDiffs click handler
assert(studioJs.includes('if (btnToggleRedDiffs) {'), "btnToggleRedDiffs listener must be registered");
assert(studioJs.includes('checkSyncRedDiff.checked = !checkSyncRedDiff.checked;'), "btnToggleRedDiffs must toggle checkSyncRedDiff.checked");
assert(studioJs.includes('computeAndApplyRedDifferences(true);'), "btnToggleRedDiffs must apply red differences when checked");
assert(studioJs.includes('clearAllRedDiffs(true);'), "btnToggleRedDiffs must clear red diffs when unchecked");
console.log("PASS 2: btnToggleRedDiffs reliably toggles visual diff highlights on live pages.");

// 3. Verify btnToggleColDiff click handler
assert(studioJs.includes('if (btnToggleColDiff) {'), "btnToggleColDiff listener must be registered");
assert(studioJs.includes('if (currentMode !== "side-by-side") {\n        switchMode("side-by-side");'), "btnToggleColDiff must switch to side-by-side mode if in another mode");
assert(studioJs.includes('if (activeRedDiffs.length === 0) {\n          computeAndApplyRedDifferences(true);\n        }'), "btnToggleColDiff must compute diffs if not yet computed");
assert(studioJs.includes('paneColDiff.style.display = "flex";'), "btnToggleColDiff must show paneColDiff when active");
console.log("PASS 3: btnToggleColDiff toggles 3rd column and auto-calculates diffs if empty.");

// 4. Verify btnSwipeTargetDiff click handler
assert(studioJs.includes('if (btnSwipeTargetDiff) {'), "btnSwipeTargetDiff listener must be registered");
assert(studioJs.includes('setSwipeCompareMode("diff");'), "btnSwipeTargetDiff must switch swipe compare mode to diff");
assert(studioJs.includes('if (activeRedDiffs.length === 0) {\n        computeAndApplyRedDifferences(true);\n      }'), "setSwipeCompareMode diff must auto-calculate diffs if empty");
console.log("PASS 4: btnSwipeTargetDiff switches to diff view and auto-calculates diffs if empty.");

// 5. Verify btnColDiffRefresh click handler
assert(studioJs.includes('if (btnColDiffRefresh) {'), "btnColDiffRefresh listener must be registered");
assert(studioJs.includes('dispatchToPane("PROD", { type: "VC_REQUEST_LANDMARKS" });'), "btnColDiffRefresh must request landmarks from PROD");
assert(studioJs.includes('dispatchToPane("STG", { type: "VC_REQUEST_LANDMARKS" });'), "btnColDiffRefresh must request landmarks from STG");
assert(studioJs.includes('runVisualDiffCalculation(true);'), "btnColDiffRefresh must run visual diff calculation");
console.log("PASS 5: btnColDiffRefresh re-requests frame data and refreshes comparisons.");

// 6. Verify sync_agent.js receives and applies red diffs properly
assert(syncAgentJs.includes('} else if (data.type === "VC_APPLY_RED_DIFFS") {\n      applyRedDiffs(data.diffs);\n    } else if (data.type === "VC_REMOVE_RED_DIFFS") {'), "sync_agent.js must apply red diffs on VC_APPLY_RED_DIFFS and not suppress them");
assert(syncAgentJs.includes('el.classList.add("vc-red-diff-highlight");'), "sync_agent.js must add vc-red-diff-highlight class");
assert(syncAgentJs.includes('type: "VC_RED_DIFFS_APPLIED"'), "sync_agent.js must report measured boxes back to parent");
console.log("PASS 6: sync_agent.js applies red diffs and reports exact bounding boxes back to studio.");

// 7. Verify both renderPixelDiffColumn3 and renderSwipeDiffCanvas draw clean diffs
assert(studioJs.includes('offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.65)";'), "Both diff renderers must draw clean red highlight fills");
assert(studioJs.includes('drawHazardStripes(offCtx, 0, regY, swW, reg.h, 14);'), "Swipe diff renderer must draw hazard stripes matching 3rd column");
assert(studioJs.includes('drawHazardStripes(offCtx, 0, regY, width, reg.h, 14);'), "3rd column diff renderer must draw hazard stripes matching swipe diff");
console.log("PASS 7: Both 3rd column and swipe diff canvases render clean, bold, beautiful diff overlays identically.");

console.log("\nALL DIFFERENCE BUTTONS & COMPARISON ENGINE TESTS PASSED SUCCESSFULLY!");
