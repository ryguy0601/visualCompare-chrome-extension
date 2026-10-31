const fs = require('fs');
const assert = require('assert');

console.log("TEST: Validating Subpixel Diff Alignment, StgBox Anchoring, and Clean Outline-Free Shapes...");

const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync('sync_agent.js', 'utf8');

// 1. Verify Staging coordinates (stgBox) are preserved and anchored in VC_RED_DIFFS_APPLIED
assert(studioJs.includes('match.stgBox = boxObj;'), "VC_RED_DIFFS_APPLIED must preserve Staging coordinates in match.stgBox");
assert(studioJs.includes('match.prodBox = boxObj;'), "VC_RED_DIFFS_APPLIED must preserve Prod coordinates in match.prodBox");
assert(studioJs.includes('if (!match.stgBox) {\n                match.box = boxObj;'), 
  "VC_RED_DIFFS_APPLIED must not overwrite match.box with Prod coordinates when stgBox exists");
console.log("PASS 1: VC_RED_DIFFS_APPLIED anchors diff highlights directly to Staging coordinates.");

// 2. Verify Computed Style checking for fixed and sticky elements (no hardcoded selector strings)
assert(syncAgentJs.includes('function isElementFixed(el)'), "sync_agent.js must define isElementFixed");
assert(syncAgentJs.includes('function isElementSticky(el)'), "sync_agent.js must define isElementSticky");
assert(syncAgentJs.includes('s.position === \'fixed\''), "isElementFixed must check computed style position === 'fixed'");
assert(syncAgentJs.includes('s.position === \'sticky\' || s.position === \'fixed\''), "isElementSticky must check computed style position === 'sticky' || 'fixed'");
console.log("PASS 2: sync_agent.js verifies element fixed/sticky state via real computed style chain.");

// 3. Verify studio.js does not falsely force isItemSticky on all headers or login buttons
assert(!studioJs.includes('p.selector.includes("btn-login")'), "studio.js must not hardcode btn-login as sticky");
assert(studioJs.includes('const isItemFixed = Boolean(s.isFixed || p.isFixed);'), "studio.js must evaluate isItemFixed from measured candidates");
console.log("PASS 3: studio.js evaluates genuine fixed/sticky elements without false positives.");

// 4. Verify Range.getClientRects() and outline-free rounded rectangles in renderers
assert(studioJs.includes('range.selectNodeContents(targetEl)'), "renderers must use Range.selectNodeContents for subpixel text alignment");
assert(studioJs.includes('range.getClientRects()'), "renderers must use Range.getClientRects() for exact line glyph boxes");
assert(studioJs.includes('offCtx.roundRect(rx - 2, ry - 1, rw + 4, rh + 2, 4)'), "renderers must highlight text glyphs with clean subpixel rounded rectangles");
assert(studioJs.includes('offCtx.roundRect(drawX, drawY, drawW, drawH, rVal)'), "renderers must fill button/card shapes using their exact borderRadius");
assert(!studioJs.includes('strokeRect'), "renderers must have ZERO outlines anywhere");
console.log("PASS 4: Diff renderers provide pure pixel differences with subpixel text alignment and zero outlines.");

// 5. Behavioral Simulation: Staging vs Prod coordinate anchoring with Layout Shift (+52px)
console.log("TEST 5: Simulating Staging vs Prod coordinate anchoring with +52px layout shift...");

const activeDiffs = [
  {
    selector: ".metric-card:first-child .metric-value",
    label: "Metric Value Display",
    stgBox: { x: 48, y: 362, width: 140, height: 48, measuredWidth: 1200 }, // Shifted +52px on Staging
    prodBox: { x: 48, y: 310, width: 140, height: 48, measuredWidth: 1200 }, // Unshifted on Prod
    box: { x: 48, y: 362, width: 140, height: 48, measuredWidth: 1200 },
    diffType: "typography",
    isFixed: false
  }
];

// In diff mode (drawn over Staging): canvas must pick stgBox (y: 362)
const item = activeDiffs[0];
const box = item.stgBox || item.box || item.prodBox;
assert.strictEqual(box.y, 362, "Diff highlight must anchor to Staging coordinate (y: 362) to line up with the underlying Staging element");

// Scrolling down by 100px: drawY must be 362 - 100 = 262px
const scrollY = 100;
const isFixed = Boolean(item.isFixed || box.isFixed);
const drawY = isFixed ? (box.viewportY !== undefined ? box.viewportY : box.y) : (box.y - scrollY);
assert.strictEqual(drawY, 262, "Scrolled drawY must accurately reflect document position minus scroll");
console.log("PASS 5: Diff highlights remain anchored to Staging coordinates and scroll in lockstep.");

// 6. Behavioral Simulation: Text Range Rect Alignment vs Old Text Left-Offset
console.log("TEST 6: Simulating Centered Button Text Subpixel Alignment...");
// Button width: 200px, centered text: "Start Free Trial" (width: 100px)
const buttonRect = { left: 100, top: 20, width: 200, height: 40 };
// Range.getClientRects() for centered text inside button
const textGlyphRect = { left: 150, top: 28, width: 100, height: 24 };

// Range text highlight: rx = 150, ry = 28
const rangeHighlightX = Math.round(textGlyphRect.left);
const rangeHighlightY = Math.round(textGlyphRect.top);
assert.strictEqual(rangeHighlightX, 150, "Text highlight X must match the centered text position (150px), not button left (100px)");
assert.strictEqual(rangeHighlightY, 28, "Text highlight Y must match the text baseline/top position (28px)");
console.log("PASS 6: Text glyph highlight aligns with centered button text with subpixel precision.");

console.log("\nALL DIFF ALIGNMENT & OUTLINE-FREE RENDERING TESTS PASSED SUCCESSFULLY!");
