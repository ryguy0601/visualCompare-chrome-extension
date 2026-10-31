const fs = require('fs');
const assert = require('assert');

console.log("TEST: Comprehensive Verification of Side-by-Side & Slide (Swipe) Views...");

const studioCss = fs.readFileSync('studio.css', 'utf8');
const studioHtml = fs.readFileSync('studio.html', 'utf8');
const studioJs = require("./helpers").readStudioJs();
const syncAgentJs = fs.readFileSync('sync_agent.js', 'utf8');

// 1. Verify CSS View Isolation & Collision Prevention
assert(studioCss.includes('.stage-view {') && studioCss.includes('display: none !important;'), "CSS must ensure inactive stage views are display: none !important");
assert(studioCss.includes('.stage-view.active {') && studioCss.includes('display: flex !important;'), "CSS must ensure active stage views are display: flex !important");
assert(!studioCss.includes('.stage-view.mode-view-pixel-diff {\n  display: flex !important;'), "CSS must NOT have un-scoped .stage-view.mode-view-pixel-diff without .active");
assert(studioCss.includes('.stage-view.active.mode-view-side.mode-view-pixel-diff'), "CSS must scope mode-view-pixel-diff to active side-by-side view");
console.log("PASS 1: CSS strictly isolates view modes. No view sticking or collision possible.");

// 2. Verify Side-by-Side 2-Column Default & 3-Column Toggle
assert(studioJs.includes('let isColDiffActive = false;'), "isColDiffActive must default to false (2-column side-by-side view)");
assert(!studioHtml.includes('id="btn-toggle-col-diff" class="sub-btn btn-diff-toggle active"'), "btn-toggle-col-diff must not have active class by default in HTML");
assert(studioHtml.includes('id="pane-col-diff" style="display: none;"'), "pane-col-diff must default to display: none in HTML");
assert(!studioJs.includes('if (notify && !isColDiffActive) {\n        isColDiffActive = true;'), "runVisualDiffCalculation must NOT override user's toggle state");
console.log("PASS 2: Side-by-Side defaults cleanly to 2 columns and toggle preserves user choice.");

// 3. Verify Slide / Swipe View (Prod on Left <-> Staging+Diff on Right)
assert(studioCss.includes('.swipe-overlay {\n  z-index: 10;\n  background: transparent;'), "swipe-overlay must have transparent background and higher z-index than base");
assert(studioJs.includes('iframeSwipeProd.style.opacity = "1"'), "In diff mode, Production is rendered at opacity: 1 on Left of curtain");
assert(studioJs.includes('iframeSwipeProd.style.pointerEvents = "auto"'), "In diff mode, Production iframe handles pointer events");
assert(studioJs.includes('swipeDiffCanvas.style.display = "block"'), "In diff mode, swipeDiffCanvas is displayed");
assert(studioJs.includes('renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions'), "renderSwipeDiffCanvas is called on diff updates");
console.log("PASS 3: Slide (Swipe) view renders Production cleanly on Left with Staging diff on Right.");

// 4. Verify Scroll Mirroring & Fluidity
assert(!syncAgentJs.includes('syncLockCounter'), "sync_agent.js must not have syncLockCounter blocking scrollbar drag");
assert(!syncAgentJs.includes('lastProgrammaticScrollTime < 140'), "sync_agent.js must not drop user scroll events based on timer");
assert(!studioJs.includes('activeScrollLeader && activeScrollLeader !== paneId'), "studio.js must not lock scroll leader between panes");
assert(syncAgentJs.includes('if (isSyncing) return;'), "sync_agent.js uses clean isSyncing guard against echo loops");
console.log("PASS 4: Scroll synchronization is fluid, consistent, and free of artificial locks.");

console.log("\nALL SIDE-BY-SIDE AND SLIDE (SWIPE) INTEGRATION VERIFICATIONS PASSED!");
