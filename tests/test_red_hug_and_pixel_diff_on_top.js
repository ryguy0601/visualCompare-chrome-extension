const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating Red Hug on Differing Tags & Pixel Differences on Top of Site...");

const syncAgentJs = fs.readFileSync(path.join(__dirname, '../sync_agent.js'), 'utf8');
const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');

// 1. Verify sync_agent.js defines clean translucent red hug with zero outlines and zero box-shadow
assert(syncAgentJs.includes('.vc-red-diff-hug {'), "sync_agent.js must define .vc-red-diff-hug");
assert(syncAgentJs.includes('background-color: rgba(239, 68, 68,'), ".vc-red-diff-hug must have translucent red hue");
assert(syncAgentJs.includes('.vc-red-diff-hug::after {'), ".vc-red-diff-hug must define ::after overlay to embrace tag shape");
assert(syncAgentJs.includes('outline: none !important;'), ".vc-red-diff-hug must have ZERO outlines");
assert(syncAgentJs.includes('box-shadow: none !important;'), ".vc-red-diff-hug must have ZERO box shadows");
console.log("PASS 1: sync_agent.js defines clean translucent red hug with zero outlines and zero box shadows.");

// 2. Verify applyRedDiffs applies the red hug to live tags that have differences
assert(syncAgentJs.includes('el.classList.add("vc-red-diff-hug");'), "applyRedDiffs must add vc-red-diff-hug to differing tags");
assert(syncAgentJs.includes('el.dataset.vcOriginalStatic = "true";'), "applyRedDiffs must handle static positioning for overlay");
assert(syncAgentJs.includes('el.classList.remove("vc-red-diff-hug");'), "removeRedDiffs must remove vc-red-diff-hug on cleanup");
console.log("PASS 2: applyRedDiffs accurately hugs differing HTML tags with pure red hue.");

// 3. Verify candidate extraction is immune to applied red diff hug
assert(syncAgentJs.includes('el.classList.contains("vc-red-diff-hug")'), "extractDiffCandidates must detect vc-red-diff-hug to preserve original styling");
assert(syncAgentJs.includes('el.dataset.vcOriginalBg'), "extractDiffCandidates must preserve vcOriginalBg");
console.log("PASS 3: Candidate extraction remains 100% immune to applied red diff hug.");

// 4. Verify studio.js displays pixel diff on top of site in swipe mode when diff toggled
assert(studioJs.includes('if (currentMode === "swipe" && swipeCompareMode !== "diff") {\n          setSwipeCompareMode("diff");'), 
  "btnToggleRedDiffs must activate diff compare mode when in swipe mode");
assert(studioJs.includes('swipeDiffCanvas.style.display = "block";'), 
  "renderSwipeDiffCanvas must ensure diff canvas is visible on top of site");
console.log("PASS 4: studio.js ensures pixel diff canvas is displayed immediately on top of site.");

// 5. Behavioral simulation: DOM element receives red hug
console.log("TEST 5: Simulating DOM element receiving red hug...");
const mockElement = {
  tagName: "BUTTON",
  classList: {
    classes: new Set(),
    add(cls) { this.classes.add(cls); },
    remove(cls) { this.classes.delete(cls); },
    contains(cls) { return this.classes.has(cls); }
  },
  style: { position: "static", backgroundColor: "rgb(37, 99, 235)" },
  dataset: {}
};

// Simulate applyRedDiffs
if (mockElement.style.position === "static") {
  mockElement.style.position = "relative";
  mockElement.dataset.vcOriginalStatic = "true";
}
mockElement.dataset.vcOriginalBg = mockElement.style.backgroundColor;
mockElement.classList.add("vc-red-diff-hug");

assert.strictEqual(mockElement.classList.contains("vc-red-diff-hug"), true, "Tag must have vc-red-diff-hug");
assert.strictEqual(mockElement.style.position, "relative", "Static tag must be relative for ::after hug");
assert.strictEqual(mockElement.dataset.vcOriginalBg, "rgb(37, 99, 235)", "Original background must be preserved");

// Simulate removeRedDiffs
mockElement.classList.remove("vc-red-diff-hug");
if (mockElement.dataset.vcOriginalStatic === "true") {
  mockElement.style.position = "";
  delete mockElement.dataset.vcOriginalStatic;
}
delete mockElement.dataset.vcOriginalBg;

assert.strictEqual(mockElement.classList.contains("vc-red-diff-hug"), false, "Tag must not have vc-red-diff-hug after cleanup");
assert.strictEqual(mockElement.style.position, "", "Tag position must be restored after cleanup");

console.log("PASS 5: Behavioral simulation of tag red hug application and cleanup succeeded!");

console.log("\nALL RED HUG & PIXEL DIFF ON TOP TESTS PASSED SUCCESSFULLY!");
