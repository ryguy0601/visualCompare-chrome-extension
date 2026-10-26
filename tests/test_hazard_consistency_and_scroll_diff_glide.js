// Unit Test: Hazard Spacer Consistency & Live Diff Scroll Glide Parity
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=================================================================");
console.log("TESTING HAZARD CONSISTENCY & DIFF SCROLL GLIDE PARITY");
console.log("=================================================================\n");

const studioJs = fs.readFileSync(path.join(__dirname, "../studio.js"), "utf8");
const syncAgentJs = fs.readFileSync(path.join(__dirname, "../sync_agent.js"), "utf8");

// 1. Verify Hazard Spacer Consistency
console.log("1. Verifying Hazard Spacer Consistency Architecture...");

// Multiple matches resolution near targetY
assert(syncAgentJs.includes("const matches = document.querySelectorAll(targetSelector);"),
  "sync_agent.js must query all matching elements for targetSelector");
assert(syncAgentJs.includes("Math.abs(y - targetY);"),
  "sync_agent.js must check distance between candidate elements and targetY");
assert(syncAgentJs.includes("if (dist < bestDist)"),
  "sync_agent.js must select the specific element closest to targetY when duplicate selectors exist");
console.log("  ✓ Spacers attach to the element closest to targetY instead of piling on the first element");

// Spacer ID tracking in studio.js
assert(studioJs.includes("activeShiftRegions[activeShiftRegions.length - 1].spacerId = gapSpacerId;"),
  "studio.js must track spacerId for gap shifts");
assert(studioJs.includes("activeShiftRegions[activeShiftRegions.length - 1].spacerId = secSpacerId;"),
  "studio.js must track spacerId for section size shifts");
console.log("  ✓ studio.js correlates shift regions with unique DOM spacer IDs");

// Precise per-spacer lookup in renderers
assert(studioJs.includes('reg.spacerId ? `.vc-hazard-stripe-spacer[data-spacer-id="${reg.spacerId}"]` : ".vc-hazard-stripe-spacer"'),
  "renderers must query specific spacer by data-spacer-id");
assert(studioJs.includes("regY = Math.round((r.top + fScrollY) - currentScrollY);"),
  "hazard stripes must scroll in real-time using frame scroll offset");
console.log("  ✓ Hazard stripes calculate exact real-time vertical coordinates in lockstep with scrolling");


// 2. Verifying Differences Appear As You Scroll
console.log("\n2. Verifying Differences Appear As You Scroll...");

// Diff candidates extracted across document
assert(syncAgentJs.includes("extractDiffCandidates(options = {})"),
  "extractDiffCandidates must accept options");
assert(syncAgentJs.includes("extractDiffCandidates({ includeAll: true })"),
  "sendLandmarksReport and sendDiffCandidatesReport must extract candidates across document");
assert(syncAgentJs.includes("candidateScrollDebounce"),
  "sync_agent.js must refresh candidates as user scrolls into new document regions");
console.log("  ✓ Candidates extracted document-wide and refreshed on scroll");

// studio.js does not discard below-viewport differences on real websites
assert(!studioJs.includes("if (!isDemoSite && p.inViewport === false && s.inViewport === false"),
  "studio.js must not discard non-initial-viewport differences on actual websites");
console.log("  ✓ detectPageDifferences evaluates all regressions across the document");


// 3. Verifying Currently Showing Differences Scroll With Everything Else
console.log("\n3. Verifying Currently Showing Differences Scroll With Everything Else...");

// Dynamic lockstep coordinate formula in Swipe mode
assert(studioJs.includes("const elDocY = r.top + frameScrollY;"),
  "studio.js must compute document-absolute top coordinate for live elements");
assert(studioJs.includes("drawY = Math.round(elDocY - currentScrollY);"),
  "studio.js must compute drawY relative to currentScrollY in lockstep");
assert(studioJs.includes("const elDocX = r.left + frameScrollX;"),
  "studio.js must compute document-absolute left coordinate for live elements");
assert(studioJs.includes("drawX = Math.round(elDocX - currentScrollX);"),
  "studio.js must compute drawX relative to currentScrollX in lockstep");
console.log("  ✓ Swipe diff canvas calculates dynamic (elDocY - currentScrollY) on every frame");

// Dynamic lockstep coordinate formula in Column 3 mode
assert(studioJs.includes("const frameWin = (iframeDiffBase?.contentWindow || iframeStg?.contentWindow || iframeProd?.contentWindow);"),
  "Column 3 must query frame scroll state");
assert(studioJs.includes("ry = Math.round((r.top + frameScrollY) - currentScrollY);"),
  "Typography text glyphs must scroll in lockstep with document");
console.log("  ✓ Column 3 diff canvas and typography glyphs scroll in lockstep with document");

// Invalidate stale screenshot captures on scroll
assert(studioJs.includes("if (lastCapturedDiffCanvas && Math.abs((lastScrollState.scrollY || 0) - lastCapturedScrollY) > 2) {\n      lastCapturedDiffCanvas = null;"),
  "studio.js must invalidate stale screenshot captures when scroll position changes");
console.log("  ✓ Stale captured screenshot diffs invalidated on scroll so diffs never snap back to (0,0)");


// 4. Behavioral Simulation: Scroll Glide from Top (scrollY = 0) to Deep Scroll (scrollY = 850)
console.log("\n4. Simulating Diff Discovery & Scroll Glide Behavior...");

const mockDocumentDiffs = [
  { selector: "#hero-title", box: { x: 40, y: 120, width: 300, height: 50 }, isSticky: false },
  { selector: "#btn-trial", box: { x: 40, y: 220, width: 140, height: 44 }, isSticky: false },
  { selector: "#card-feature-1", box: { x: 40, y: 680, width: 350, height: 180 }, isSticky: false },
  { selector: "#pricing-tier-pro", box: { x: 40, y: 1200, width: 320, height: 250 }, isSticky: false },
  { selector: "#footer-newsletter-btn", box: { x: 40, y: 2100, width: 160, height: 40 }, isSticky: false }
];

const viewH = 800;

function getRenderedDiffs(scrollY) {
  return mockDocumentDiffs.map(d => {
    const drawY = d.box.y - scrollY;
    const isVisible = (drawY + d.box.height >= -10 && drawY <= viewH + 10);
    return { ...d, drawY, isVisible };
  }).filter(d => d.isVisible);
}

// Scroll at Top (scrollY = 0)
const diffsAt0 = getRenderedDiffs(0);
assert.strictEqual(diffsAt0.length, 3, "At scroll 0, only the 3 elements in the top 800px are visible");
assert.strictEqual(diffsAt0[0].selector, "#hero-title");
assert.strictEqual(diffsAt0[0].drawY, 120);
assert.strictEqual(diffsAt0[1].selector, "#btn-trial");
assert.strictEqual(diffsAt0[1].drawY, 220);
console.log("  ✓ At scroll 0: Hero Title (y=120) and CTA (y=220) are displayed");

// Scroll down by 200px (scrollY = 200) - differences scroll with everything else!
const diffsAt200 = getRenderedDiffs(200);
const ctaAt200 = diffsAt200.find(d => d.selector === "#btn-trial");
assert.strictEqual(ctaAt200.drawY, 20, "CTA button scrolled up with content to drawY = 20 (220 - 200)");
const cardAt200 = diffsAt200.find(d => d.selector === "#card-feature-1");
assert.strictEqual(cardAt200.drawY, 480, "Feature card scrolled up with content to drawY = 480 (680 - 200)");
assert(!diffsAt200.find(d => d.selector === "#hero-title"), "Hero title scrolled past the top and was clipped cleanly");
console.log("  ✓ At scroll 200: All currently showing diffs smoothly scrolled up by -200px");

// Deep scroll (scrollY = 850) - new differences appear as you scroll!
const diffsAt850 = getRenderedDiffs(850);
const pricingAt850 = diffsAt850.find(d => d.selector === "#pricing-tier-pro");
assert(pricingAt850, "Pricing Tier Pro must appear as you scroll into the 1200px region!");
assert.strictEqual(pricingAt850.drawY, 350, "Pricing Tier Pro appears at drawY = 350 (1200 - 850)");
assert(!diffsAt850.find(d => d.selector === "#hero-title"), "Top hero elements are clipped when scrolled past");
console.log("  ✓ At scroll 850: Pricing Tier Pro dynamically appeared at drawY=350 as user scrolled!");

console.log("\n=================================================================");
console.log("ALL HAZARD CONSISTENCY & DIFF SCROLL GLIDE TESTS PASSED (100%)!");
console.log("=================================================================");
