const fs = require('fs');
const assert = require('assert');

console.log("TEST: Validating Swipe Diff Aspect Ratio Adaptation & Zero Warping...");

const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync('sync_agent.js', 'utf8');

// 1. Verify lastCapturedDiffCanvas is invalidated when switching modes
assert(studioJs.includes('switchMode(mode) {\n    if (mode === "pixel-diff") {\n      mode = "side-by-side";\n      isColDiffActive = true;\n      if (btnToggleColDiff) btnToggleColDiff.classList.add("active");\n    }\n\n    currentMode = mode;\n    lastCapturedDiffCanvas = null;'), "switchMode must invalidate lastCapturedDiffCanvas to prevent cross-mode warping");
console.log("PASS 1: Mode switching invalidates stale diff canvases.");

// 2. Verify renderSwipeDiffCanvas verifies resolution before drawing captured diff
assert(studioJs.includes('if (Math.abs(lastCapturedDiffCanvas.width - swW) < 5)'), "renderSwipeDiffCanvas must ensure captured canvas matches swW width exactly");
assert(studioJs.includes('// Mismatched aspect ratio or width (e.g. from 3-column view) - drop stale canvas so it never warps!'), "renderSwipeDiffCanvas must drop stale mismatched canvases");
console.log("PASS 2: renderSwipeDiffCanvas enforces exact resolution match and drops 3-column stretched diffs.");

// 3. Verify renderPixelDiffColumn3 verifies resolution before drawing captured diff
assert(studioJs.includes('if (Math.abs(lastCapturedDiffCanvas.width - width) < 5)'), "renderPixelDiffColumn3 must ensure captured canvas matches width exactly");
console.log("PASS 3: renderPixelDiffColumn3 enforces exact resolution match.");

// 4. Verify candidate boxes include measuredWidth for dynamic responsive websites
assert(syncAgentJs.includes('measuredWidth: vw'), "sync_agent.js candidates must include measuredWidth");
assert(syncAgentJs.includes('measuredWidth: (window.innerWidth || document.documentElement.clientWidth || 1200)'), "appliedBoxes must include measuredWidth");
console.log("PASS 4: sync_agent.js reports viewport width alongside candidate boxes.");

// 5. Verify dynamic aspect-ratio check in renderSwipeDiffCanvas fallback
assert(studioJs.includes('const isBoxFromNarrow = box && box.measuredWidth && box.measuredWidth < 600 && swW > 800;'), "renderSwipeDiffCanvas must detect if box was measured at narrow 3-column width");
assert(studioJs.includes('getEstimatedBoxForSelector(item.selector, swW)'), "renderSwipeDiffCanvas must re-estimate coordinates for dynamic desktop layout when box is narrow");
console.log("PASS 5: Dynamic sites adapt to wide aspect ratio when switching from 3-column view.");

console.log("\nALL SWIPE ASPECT RATIO & ANTI-WARPING TESTS PASSED!");
