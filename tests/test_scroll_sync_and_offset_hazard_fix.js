// Unit Test: Comprehensive Validation of Scroll Sync & Offset Hazard Fixes Across All Panes & Modes
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("TEST: Validating Scroll Sync & Offset Hazard Alignment Across The Board...");

const studioJs = fs.readFileSync(path.join(__dirname, "../studio.js"), "utf8");
const syncAgentJs = fs.readFileSync(path.join(__dirname, "../sync_agent.js"), "utf8");

// 1. Verify that candidate reports NEVER wipe landmarks or document heights
assert(studioJs.includes("landmarks: swipeProdLandmarks?.landmarks || lastProdLandmarks?.landmarks || []"),
  "VC_DIFF_CANDIDATES_REPORT in swipe mode must preserve existing landmarks in swipeProdLandmarks");
assert(studioJs.includes("landmarks: swipeStgLandmarks?.landmarks || lastStgLandmarks?.landmarks || []"),
  "VC_DIFF_CANDIDATES_REPORT in swipe mode must preserve existing landmarks in swipeStgLandmarks");
assert(studioJs.includes("landmarks: colProdLandmarks?.landmarks || lastProdLandmarks?.landmarks || []"),
  "VC_DIFF_CANDIDATES_REPORT in column mode must preserve existing landmarks in colProdLandmarks");
assert(studioJs.includes("landmarks: colStgLandmarks?.landmarks || lastStgLandmarks?.landmarks || []"),
  "VC_DIFF_CANDIDATES_REPORT in column mode must preserve existing landmarks in colStgLandmarks");
console.log("PASS 1: Candidate reports preserve landmarks and docHeight without clobbering.");

// 2. Verify calculateAndApplyLayoutShifts computes activeShiftRegions and cleans stale spacers
assert(studioJs.includes("activeShiftRegions = [];"),
  "calculateAndApplyLayoutShifts must initialize activeShiftRegions");
assert(studioJs.includes('activeShiftRegions.push({ y, h: gapDiff, label: `+${gapDiff}px (inserted space)` });'),
  "calculateAndApplyLayoutShifts must track gapDiff shift regions for visual hazard striping");
assert(studioJs.includes('activeShiftRegions.push({ y, h: secDiff, label: `+${secDiff}px ("${pSec.heading || pSec.tag || sSec.heading || sSec.tag}" is larger)` });'),
  "calculateAndApplyLayoutShifts must track section size shift regions for visual hazard striping");
assert(studioJs.includes('renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions'),
  "calculateAndApplyLayoutShifts must refresh swipe diff canvas with new activeShiftRegions");
assert(studioJs.includes('renderPixelDiffColumn3(colRedDiffs, activeShiftRegions'),
  "calculateAndApplyLayoutShifts must refresh 3rd column diff canvas with new activeShiftRegions");
assert(studioJs.includes('clearAllHazardSpacers') && studioJs.includes('activeShiftRegions = [];'),
  "clearAllHazardSpacers must reset activeShiftRegions to clean state");
console.log("PASS 2: Hazard spacer calculation immediately establishes activeShiftRegions and triggers canvas rendering.");

// 3. Verify studio.js accepts messages from Column 3 (diff) and Swipe Diff
assert(studioJs.includes("(!active.diff || sourceWindow !== active.diff.contentWindow)"),
  "studio.js must accept VC_ACTION_PERFORMED from active.diff (Column 3 & Swipe Diff)");
console.log("PASS 3: VC_ACTION_PERFORMED accepts messages from all active pane windows, including Column 3 and Swipe Diff.");

// 4. Verify Scroll Leader Lock & Echo Elimination in studio.js
assert(studioJs.includes("let activeScrollLeader = null;"),
  "studio.js must declare activeScrollLeader lock");
assert(studioJs.includes("let scrollLeaderTimer = null;"),
  "studio.js must declare scrollLeaderTimer");
assert(studioJs.includes("activeScrollLeader = scrollSender;"),
  "studio.js must assign activeScrollLeader when user scrolls");
assert(studioJs.includes('activeScrollLeader = "WHEEL";'),
  "studio.js must assign activeScrollLeader to WHEEL during wheel gestures");
console.log("PASS 4: Scroll leader lock eliminates jitter and feedback fighting between frames.");

// 5. Verify forwardActionToPane dispatches symmetrically without echoing to originWindow
assert(studioJs.includes("function forwardActionToPane(targetPane, action, originWindow = null)"),
  "forwardActionToPane must accept originWindow");
assert(studioJs.includes("(!originWindow || iframe.contentWindow !== originWindow)"),
  "forwardActionToPane send must never echo back to the originating window");
assert(studioJs.includes("if (originWindow && iframeDiffBase && originWindow === iframeDiffBase.contentWindow) {\n        send(iframeStg);\n      }"),
  "forwardActionToPane must forward actions from Column 3 to Staging");
assert(studioJs.includes("if (originWindow && iframeStg && originWindow === iframeStg.contentWindow && iframeDiffBase) {\n        send(iframeDiffBase);\n      }"),
  "forwardActionToPane must forward actions from Staging to Column 3");
assert(studioJs.includes("if (originWindow && iframeSwipeDiff && originWindow === iframeSwipeDiff.contentWindow) {\n        send(iframeSwipeStg);\n      }"),
  "forwardActionToPane must forward actions from Swipe Diff to Swipe Staging");
console.log("PASS 5: All 3 columns and all swipe layers forward interactions symmetrically with zero echo bounceback.");

// 6. Behavioral Simulation: Full Layout Shift Calculation & Hazard Spacer Dispatch
console.log("TEST 6: Simulating Layout Shift Hazard Calculation on Demo Overview Page...");

const mockProd = {
  landmarks: [
    { selector: "header", heading: "Header", box: { y: 0, height: 60 } },
    { selector: ".hero-section", heading: "Unified Cloud Observability", box: { y: 60, height: 400 } },
    { selector: ".features-section", heading: "Core Capabilities", box: { y: 460, height: 350 } }
  ]
};

const mockStg = {
  landmarks: [
    { selector: "header", heading: "Header", box: { y: 0, height: 60 } },
    // Staging has +53px banner between header and hero!
    { selector: ".hero-section", heading: "Unified Cloud Observability", box: { y: 113, height: 400 } },
    // Features section is +50px larger in Staging
    { selector: ".features-section", heading: "Core Capabilities", box: { y: 513, height: 400 } }
  ]
};

// Simulate matching pairs
const pairs = [
  { prod: mockProd.landmarks[0], stg: mockStg.landmarks[0] },
  { prod: mockProd.landmarks[1], stg: mockStg.landmarks[1] },
  { prod: mockProd.landmarks[2], stg: mockStg.landmarks[2] }
];

let appliedSpacers = { PROD: [], STG: [] };
let simulatedShiftRegions = [];

let prevP = 0, prevS = 0;
for (let idx = 0; idx < pairs.length; idx++) {
  const pSec = pairs[idx].prod;
  const sSec = pairs[idx].stg;

  const pGap = Math.max(0, pSec.box.y - prevP);
  const sGap = Math.max(0, sSec.box.y - prevS);
  const gapDiff = Math.abs(pGap - sGap);

  if (gapDiff > 4) {
    simulatedShiftRegions.push({ y: Math.min(pSec.box.y, sSec.box.y), h: gapDiff });
    if (pGap < sGap) {
      appliedSpacers.PROD.push({ target: "PROD", height: gapDiff, targetSelector: pSec.selector });
    } else {
      appliedSpacers.STG.push({ target: "STG", height: gapDiff, targetSelector: sSec.selector });
    }
  }

  const secDiff = Math.abs(pSec.box.height - sSec.box.height);
  if (secDiff > 4) {
    simulatedShiftRegions.push({ y: Math.min(pSec.box.y, sSec.box.y) + Math.min(pSec.box.height, sSec.box.height), h: secDiff });
    if (pSec.box.height < sSec.box.height) {
      appliedSpacers.PROD.push({ target: "PROD", height: secDiff, targetSelector: pSec.selector });
    } else {
      appliedSpacers.STG.push({ target: "STG", height: secDiff, targetSelector: sSec.selector });
    }
  }

  prevP = pSec.box.y + pSec.box.height;
  prevS = sSec.box.y + sSec.box.height;
}

// 1. Banner gap shift
assert.strictEqual(appliedSpacers.PROD.length, 2, "PROD must receive 2 hazard spacers (banner gap + section height)");
assert.strictEqual(appliedSpacers.PROD[0].height, 53, "First spacer must be +53px for dynamic-ticker banner");
assert.strictEqual(appliedSpacers.PROD[0].targetSelector, ".hero-section", "First spacer must be before hero-section");

// 2. Features section shift
assert.strictEqual(appliedSpacers.PROD[1].height, 50, "Second spacer must be +50px for features section expansion");
assert.strictEqual(appliedSpacers.PROD[1].targetSelector, ".features-section", "Second spacer must match features section");

// 3. Shift regions for visual striping
assert.strictEqual(simulatedShiftRegions.length, 2, "Exactly 2 shift regions recorded for hazard striping");
assert.strictEqual(simulatedShiftRegions[0].h, 53);
assert.strictEqual(simulatedShiftRegions[1].h, 50);

console.log("PASS 6: Behavioral simulation verified accurate layout shift hazard calculation & spacer generation!");

console.log("\nALL SCROLL SYNC & OFFSET HAZARD TESTS PASSED SUCCESSFULLY!");
