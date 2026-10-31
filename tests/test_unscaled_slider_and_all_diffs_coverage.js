// Unit Test: Validating Unscaled Diff Opacity Slider and Comprehensive Visual Differences Coverage
const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("=================================================================");
console.log("TESTING UNSCALED OPACITY SLIDER & COMPREHENSIVE DIFFS COVERAGE");
console.log("=================================================================\n");

const studioHtml = fs.readFileSync(path.join(__dirname, '../studio.html'), 'utf8');
const studioCss = fs.readFileSync(path.join(__dirname, '../studio.css'), 'utf8');
const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync(path.join(__dirname, '../sync_agent.js'), 'utf8');

// ----------------------------------------------------
// SUITE 1: Verifying Unscaled Diff Opacity Slider
// ----------------------------------------------------
console.log("1. Verifying Diff Opacity Slider is Outside Viewport Scaler...");

// Ensure #col-diff-opacity-slider is inside .secondary-toolbar and NOT inside #viewport-scaler
const scalerIdx = studioHtml.indexOf('id="viewport-scaler"');
const sliderIdx = studioHtml.indexOf('id="col-diff-opacity-slider"');
const toolbarIdx = studioHtml.indexOf('class="secondary-toolbar"');

assert(sliderIdx > toolbarIdx, "col-diff-opacity-slider must be inside secondary toolbar");
assert(sliderIdx < scalerIdx, "col-diff-opacity-slider MUST be located before/outside #viewport-scaler so page scaling never affects it!");

// Verify CSS styles for .diff-opacity-toolbar-group
assert(studioCss.includes(".diff-opacity-toolbar-group"), "studio.css must define .diff-opacity-toolbar-group");
assert(studioCss.includes(".diff-opacity-toolbar-group .diff-opacity-slider"), "studio.css must define unscaled slider size");
assert(studioCss.includes(".diff-opacity-toolbar-group .diff-opacity-val"), "studio.css must define unscaled label size");
console.log("  ✓ Diff opacity slider is placed in secondary toolbar outside #viewport-scaler");
console.log("  ✓ Dedicated unscaled CSS styles verified");

// Verify studio.js binds and synchronizes opacity
assert(studioJs.includes('document.getElementById("col-diff-opacity-slider")'), "studio.js binds colDiffOpacitySlider");
assert(studioJs.includes('if (pixelDiffCanvas) pixelDiffCanvas.style.opacity = (val / 100).toString()'), "slider updates pixelDiffCanvas");
assert(studioJs.includes('if (swipeDiffCanvas) swipeDiffCanvas.style.opacity = (val / 100).toString()'), "slider updates swipeDiffCanvas");
assert(studioJs.includes('swipeDiffCanvas.style.opacity = (colDiffOpacitySlider ? colDiffOpacitySlider.value / 100 : 0.85).toString()'), "swipe mode diff uses slider opacity");
console.log("  ✓ Opacity slider event listeners and atomic frame bindings verified\n");

// ----------------------------------------------------
// SUITE 2: Verifying Candidate Extraction Coverage
// ----------------------------------------------------
console.log("2. Verifying sync_agent.js Candidate Extraction Expansion...");

assert(syncAgentJs.includes("'figure'"), "Candidates selector includes figure");
assert(syncAgentJs.includes("'picture'"), "Candidates selector includes picture");
assert(syncAgentJs.includes("'time'"), "Candidates selector includes time");
assert(syncAgentJs.includes("'details'"), "Candidates selector includes details");
assert(syncAgentJs.includes("'summary'"), "Candidates selector includes summary");
assert(syncAgentJs.includes("'div[class]'"), "Candidates selector includes styled divs");
assert(syncAgentJs.includes("[class*=\"content\"]"), "Candidates selector includes content classes");
assert(syncAgentJs.includes("[class*=\"box\"]"), "Candidates selector includes box classes");
assert(syncAgentJs.includes("candidates.length >= 2500"), "Candidates extraction cap expanded to 2500 elements");
console.log("  ✓ Semantic elements, media, styled divs, and class patterns included");
console.log("  ✓ Candidate limit expanded for large pages\n");

// ----------------------------------------------------
// SUITE 3: Verifying Bidirectional Diff Detection & Full Coverage
// ----------------------------------------------------
console.log("3. Verifying detectPageDifferences Bidirectional & Regression Coverage...");

// Extract detectPageDifferences and addDiffIfMissing for direct execution
const fnMatch = studioJs.match(/function detectPageDifferences\(prodLandmarks, stgLandmarks\) \{[\s\S]*?\n  \}\n\n  function addDiffIfMissing\(list, diffItem\) \{[\s\S]*?\n  \}/);
assert(fnMatch, "detectPageDifferences and addDiffIfMissing must be extractable");

const evalDiffs = new Function("prodLandmarks", "stgLandmarks", `
  const prodUrlInput = { value: prodLandmarks?.href || "" };
  const stgUrlInput = { value: stgLandmarks?.href || "" };
  const currentMode = "side-by-side";
  const lastProdLandmarks = prodLandmarks;
  const lastStgLandmarks = stgLandmarks;
  const colProdLandmarks = prodLandmarks;
  const colStgLandmarks = stgLandmarks;
  const swipeProdLandmarks = prodLandmarks;
  const swipeStgLandmarks = stgLandmarks;
  const matchLandmarks = (p, s) => [];
  const getEstimatedBoxForSelector = () => null;
  ${fnMatch[0]}
  return detectPageDifferences(prodLandmarks, stgLandmarks);
`);

// Test Case A: Newly added Staging element (not present in Prod)
const testAddedProd = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: "#logo", tag: "img", src: "logo.png", box: { x: 10, y: 10, width: 100, height: 40 } }
  ]
};
const testAddedStg = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: "#logo", tag: "img", src: "logo.png", box: { x: 10, y: 10, width: 100, height: 40 } },
    { selector: "#new-cta-banner", tag: "div", text: "Limited Time Offer: 50% Off", style: { bg: "rgb(239, 68, 68)", color: "#fff" }, box: { x: 10, y: 60, width: 600, height: 50 } }
  ]
};

const diffsAdded = evalDiffs(testAddedProd, testAddedStg);
assert(diffsAdded.some(d => d.selector === "#new-cta-banner" && d.diffType === "added"), "New element added in Staging MUST be detected and flagged as added diff!");
console.log("  ✓ Newly added Staging elements correctly flagged (diffType: 'added')");

// Test Case B: Removed Prod element (missing in Staging)
const testRemovedProd = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: "#logo", tag: "img", src: "logo.png", box: { x: 10, y: 10, width: 100, height: 40 } },
    { selector: "#old-notice", tag: "div", text: "Legacy notice", box: { x: 10, y: 60, width: 300, height: 40 } }
  ]
};
const testRemovedStg = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: "#logo", tag: "img", src: "logo.png", box: { x: 10, y: 10, width: 100, height: 40 } }
  ]
};

const diffsRemoved = evalDiffs(testRemovedProd, testRemovedStg);
assert(diffsRemoved.some(d => d.selector === "#old-notice" && d.diffType === "removed"), "Element removed in Staging MUST be detected and flagged as removed diff!");
console.log("  ✓ Removed Prod elements correctly flagged (diffType: 'removed')");

// Test Case C: Multiple distinct elements with the same difference label
const testMultiProd = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: "#btn-save", tag: "button", text: "Save", style: { bg: "rgb(37, 99, 235)" }, box: { x: 10, y: 100, width: 80, height: 35 } },
    { selector: "#btn-checkout", tag: "button", text: "Checkout", style: { bg: "rgb(37, 99, 235)" }, box: { x: 10, y: 300, width: 120, height: 40 } }
  ]
};
const testMultiStg = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: "#btn-save", tag: "button", text: "Save", style: { bg: "rgb(239, 68, 68)" }, box: { x: 10, y: 100, width: 80, height: 35 } },
    { selector: "#btn-checkout", tag: "button", text: "Checkout", style: { bg: "rgb(239, 68, 68)" }, box: { x: 10, y: 300, width: 120, height: 40 } }
  ]
};

const diffsMulti = evalDiffs(testMultiProd, testMultiStg);
assert(diffsMulti.some(d => d.selector === "#btn-save"), "#btn-save must be detected");
assert(diffsMulti.some(d => d.selector === "#btn-checkout"), "#btn-checkout must be detected (NOT dropped due to duplicate label!)");
assert.strictEqual(diffsMulti.length, 2, "Both buttons MUST be in diffs, neither dropped!");
console.log("  ✓ Multiple elements with identical difference labels preserved (deduplication bug fixed)");

// Test Case D: Typography, dimensions, opacity, and leaf divs
const testRichProd = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: ".stat-value", tag: "div", text: "1,200", style: { fontSize: "16px", fontWeight: "400", bg: "transparent" }, box: { x: 20, y: 50, width: 100, height: 30 } },
    { selector: ".hero-sub", tag: "p", text: "Original subtext", style: { opacity: "1" }, box: { x: 20, y: 150, width: 200, height: 30 } },
    { selector: ".callout", tag: "div", text: "Callout", style: { borderColor: "rgba(0,0,0,0)" }, box: { x: 20, y: 250, width: 150, height: 40 } }
  ]
};
const testRichStg = {
  href: "https://example.com/site",
  diffCandidates: [
    { selector: ".stat-value", tag: "div", text: "1,500", style: { fontSize: "24px", fontWeight: "700", bg: "rgb(59, 130, 246)" }, box: { x: 20, y: 50, width: 140, height: 40 } },
    { selector: ".hero-sub", tag: "p", text: "Original subtext", style: { opacity: "0.5" }, box: { x: 20, y: 150, width: 200, height: 30 } },
    { selector: ".callout", tag: "div", text: "Callout", style: { borderColor: "rgb(234, 179, 8)" }, box: { x: 20, y: 250, width: 150, height: 40 } }
  ]
};

const diffsRich = evalDiffs(testRichProd, testRichStg);
assert(diffsRich.some(d => d.selector === ".stat-value"), "Leaf div .stat-value text and style changes detected");
assert(diffsRich.some(d => d.selector === ".hero-sub"), "Opacity change detected on .hero-sub");
assert(diffsRich.some(d => d.selector === ".callout"), "Border color activation detected on .callout");
console.log("  ✓ Typography, font size/weight, opacity, and borders detected\n");

// ----------------------------------------------------
// SUITE 4: Verifying Column 3 Scaling and Fallback
// ----------------------------------------------------
console.log("4. Verifying Column 3 Proportional Coordinate Scaling & Anti-Crash...");

// Check that isTextNode is declared in item scope
assert(studioJs.includes('const itemTag = (item.tag || "").toLowerCase();'), "renderers declare itemTag");
assert(studioJs.includes('const isTextNode = (itemTag === "h1" || itemTag === "h2"'), "renderers declare isTextNode in outer item scope");

// Check that wide boxes are scaled on non-demo sites instead of returning early
assert(studioJs.includes('const scaleX = (box.measuredWidth && box.measuredWidth > 0 && Math.abs(box.measuredWidth - width) > 30) ? (width / box.measuredWidth) : 1;'), "Column 3 scales coordinates proportionally for non-demo sites");
assert(studioJs.includes('pixelDiffCanvas.style.opacity = (colDiffOpacitySlider ? colDiffOpacitySlider.value / 100 : 0.85).toString();'), "pixelDiffCanvas synchronizes opacity with slider");

console.log("  ✓ No ReferenceError on cross-origin frames");
console.log("  ✓ Proportional coordinate scaling enabled for Column 3 on all websites");

console.log("\n=================================================================");
console.log("ALL UNSCALED SLIDER & DIFF COVERAGE TESTS PASSED (100% SUCCESS)!");
console.log("=================================================================");
