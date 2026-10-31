const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("TEST: Validating Pure Pixel Difference, Accurate Mismatch %, and Zero Count Clutter...");

// 1. Check sync_agent.js
const syncAgentCode = fs.readFileSync(path.join(__dirname, "../sync_agent.js"), "utf8");

// Verify .vc-red-diff-badge is hidden and not created
assert(syncAgentCode.includes(".vc-red-diff-badge {\n        display: none !important;"), "sync_agent.js must hide diff badges via CSS");
assert(!syncAgentCode.includes("el.appendChild(badge);"), "sync_agent.js must not append text description badges to elements");
assert(syncAgentCode.includes('el.querySelectorAll(".vc-red-diff-badge").forEach(b => b.remove());'), "sync_agent.js must remove any existing badges");
console.log("PASS 1: Floating description badges completely eliminated from sync_agent.js.");

// 2. Check studio.html
const studioHtml = fs.readFileSync(path.join(__dirname, "../studio.html"), "utf8");

// Verify metric-red-badge has display: none !important
assert(studioHtml.includes('id="metric-red-badge" style="display: none !important;"'), "metric-red-badge must be hidden");
// Verify swipe-diff-pct exists
assert(studioHtml.includes('id="swipe-diff-pct"'), "swipe-diff-pct must exist for swipe view mismatch percentage");
assert(studioHtml.includes('id="col-diff-pct"'), "col-diff-pct must exist for 3rd column mismatch percentage");
assert(studioHtml.includes('id="metric-diff-pct"'), "metric-diff-pct must exist for top toolbar mismatch percentage");
console.log("PASS 2: studio.html hides diff count badge and provides accurate diff % pills for both views.");

// 3. Check studio.js
const studioJs = require("./helpers").readStudioJs();

// Verify drawRedPixelDiffLabel and drawRedDiffCanvasBadge are disabled / no-op
assert(studioJs.includes("function drawRedPixelDiffLabel(ctx, x, y, label) {\n    // Disabled per user instruction"), "drawRedPixelDiffLabel must be disabled");
assert(studioJs.includes("function drawRedDiffCanvasBadge(ctx, x, y, label) {\n    // Disabled per user instruction"), "drawRedDiffCanvasBadge must be disabled");

// Verify pixel diff calculations compute accurate percentage
assert(studioJs.includes("const accuratePctNum = (diffPixels / totalPixels) * 100;"), "studio.js must calculate exact subpixel mismatch %");
assert(studioJs.includes("lastAccuratePixelDiffPct = pct;"), "studio.js must store accurate pixel diff %");
assert(studioJs.includes("updateAllDiffPercentDisplays(pct);"), "studio.js must sync all diff percent displays");

// Verify btn-toggle-red-diffs has no count numbers
const btnToggleRegex = /btnToggleRedDiffs\.innerHTML\s*=\s*`[^`]*\(\$\{[^}]+\}\)[^`]*`/g;
assert(!btnToggleRegex.test(studioJs), "btnToggleRedDiffs must not contain dynamic count numbers");

console.log("PASS 3: studio.js provides pure pixel diff overlay without text descriptions, accurate %, and zero count clutter.");

console.log("\nALL PURE PIXEL DIFF & ACCURACY TESTS PASSED!");
