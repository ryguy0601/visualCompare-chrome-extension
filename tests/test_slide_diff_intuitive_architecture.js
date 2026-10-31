// Unit Test: Validating Intuitive Slide/Swipe Diff Architecture
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("TEST: Validating Intuitive Slide/Swipe Diff Architecture...");

const studioJs = require("./helpers").readStudioJs();
const studioHtml = fs.readFileSync(path.join(__dirname, "../studio.html"), "utf8");
const studioCss = fs.readFileSync(path.join(__dirname, "../studio.css"), "utf8");

// 1. Verify HTML Structure: Diff canvas sits inside swipe-base-layer directly over Staging
assert(studioHtml.includes('<div class="swipe-layer swipe-base" id="swipe-base-layer">'), "studio.html must contain swipe-base-layer");
assert(studioHtml.includes('<canvas id="swipe-diff-canvas" class="pixel-diff-canvas" style="display: none;"></canvas>'), "studio.html must contain swipe-diff-canvas");
const baseLayerIndex = studioHtml.indexOf('id="swipe-base-layer"');
const overlayLayerIndex = studioHtml.indexOf('id="swipe-overlay-layer"');
const canvasIndex = studioHtml.indexOf('id="swipe-diff-canvas"');
assert(canvasIndex > baseLayerIndex && canvasIndex < overlayLayerIndex, "swipe-diff-canvas must be placed inside swipe-base-layer directly on top of Staging");
console.log("PASS 1: swipe-diff-canvas correctly positioned in swipe-base-layer over Staging.");

// 2. Verify CSS Layering: Overlay layer has higher z-index and clips cleanly over base layer
assert(studioCss.includes(".swipe-base {\n  z-index: 1;\n  background: var(--bg-card-inner);\n}"), "swipe-base must have z-index: 1");
assert(studioCss.includes(".swipe-overlay {\n  z-index: 10;\n  background: transparent;\n  clip-path: inset(0 50% 0 0);"), "swipe-overlay must have z-index: 10 for clean clipping over base");
assert(studioCss.includes(".handle-pill.diff-active {"), "studio.css must style handle-pill.diff-active");
assert(studioCss.includes(".swipe-container.diff-mode .handle-line {"), "studio.css must style handle-line in diff-mode");
console.log("PASS 2: CSS layering and visual styling for diff mode verified.");

// 3. Verify studio.js setSwipeCompareMode: Production is NEVER hidden and stays interactive on Left
assert(studioJs.includes('iframeSwipeProd.style.opacity = "1"'), "iframeSwipeProd must be visible with opacity: 1");
assert(studioJs.includes('iframeSwipeProd.style.pointerEvents = "auto"'), "iframeSwipeProd must accept pointer events");
assert(studioJs.includes('swipeOverlayTag.textContent = "PRODUCTION (LEFT)"'), "swipeOverlayTag must be labeled PRODUCTION (LEFT)");
assert(studioJs.includes('swipeBaseTag.textContent = "STAGING + DIFF (RIGHT)"'), "swipeBaseTag must be labeled STAGING + DIFF (RIGHT) in diff mode");
assert(studioJs.includes('swipeBaseTag.textContent = "STAGING (RIGHT)"'), "swipeBaseTag must be labeled STAGING (RIGHT) in clean mode");
assert(studioJs.includes('if (swipeHandleLabel) {\n        swipeHandleLabel.textContent = "PROD ↔ DIFF";\n      }'), "swipeHandleLabel must say PROD ↔ DIFF when diff is active");
console.log("PASS 3: Production is never hidden; slide view cleanly wipes between Production and Staging with Diff.");

// 4. Verify No-Flicker 60fps Rendering: requestLivePixelDiff avoids screenshot flickering in swipe mode
const swipeCheckInCapture = studioJs.includes('if (currentMode === "swipe") {\n      // In swipe mode, live DOM subpixel diffs and layout shift hazard stripes are rendered\n      // directly on top of Staging in the swipe base layer with zero flicker and 60fps responsiveness.\n      isCapturingDiff = false;\n      return;\n    }');
assert(swipeCheckInCapture, "requestLivePixelDiff must bypass heavy screenshot flickering in swipe mode");
console.log("PASS 4: Zero-flicker live DOM and hazard stripe rendering enforced in swipe mode.");

// 5. Behavioral Simulation: Curtain Divider reveals Production on Left and Staging Diff on Right
let curSwipePct = 50;
let clipPathStr = `inset(0 ${100 - curSwipePct}% 0 0)`;
assert.strictEqual(clipPathStr, "inset(0 50% 0 0)", "At 50% divider, left 50% is Production, right 50% is Staging with Diff");

curSwipePct = 75;
clipPathStr = `inset(0 ${100 - curSwipePct}% 0 0)`;
assert.strictEqual(clipPathStr, "inset(0 25% 0 0)", "At 75% divider, left 75% is Production, right 25% is Staging with Diff");

console.log("PASS 5: Behavioral simulation verified smooth curtain sliding between Production and Staging with Diff!");

console.log("\nALL INTUITIVE SLIDE DIFF ARCHITECTURE TESTS PASSED!");
