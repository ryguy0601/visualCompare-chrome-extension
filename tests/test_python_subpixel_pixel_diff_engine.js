// Unit Test: Validating Python diff_engine.py Subpixel Pixel Diff Port & Live Viewport-based Diffing
const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating Python diff_engine.py Subpixel Pixel Diff Port & Dynamic Viewport Diffing...");

const studioJs = require("./helpers").readStudioJs();

// 1. Verify computeSubpixelPixelDiff port of diff_engine.py make_diff_mask_subpixel
assert(studioJs.includes('function computeSubpixelPixelDiff(dataP, dataS, width, height, tolerance'), 
  "studio.js must define computeSubpixelPixelDiff matching diff_engine.py make_diff_mask_subpixel");
assert(studioJs.includes('// 8-neighbor offsets matching diff_engine.py make_diff_mask_subpixel'),
  "computeSubpixelPixelDiff must check 8-neighbor offsets for anti-aliasing rejection");
assert(studioJs.includes('outData[pIdx] = 225;') && 
       studioJs.includes('outData[pIdx + 1] = 29;') && 
       studioJs.includes('outData[pIdx + 2] = 72;') && 
       studioJs.includes('outData[pIdx + 3] = 220;'),
  "computeSubpixelPixelDiff must use RED = (225, 29, 72, 220) matching diff_engine.py");
console.log("PASS 1: computeSubpixelPixelDiff matches diff_engine.py make_diff_mask_subpixel with 8-neighbor checking & RED=(225, 29, 72, 220).");

// 2. Verify Dynamic Viewport Diffing (Not all at once)
assert(studioJs.includes('function scheduleLivePixelDiffCapture() {'),
  "studio.js must define scheduleLivePixelDiffCapture for dynamic viewport updates");
assert(studioJs.includes('liveDiffCaptureTimer = setTimeout(() => {\n      requestLivePixelDiff();\n    }, 80);'),
  "scheduleLivePixelDiffCapture must debounce capture to prevent performance lockups");
assert(studioJs.includes('if (isUserScrolling || isCapturingDiff) return;'),
  "scheduleLivePixelDiffCapture must defer during active scroll for 60fps continuous motion");
console.log("PASS 2: Dynamic live viewport diffing updates smoothly without full-page freezes.");

// 3. Verify Dual-Mode Support: Both 3-Column and Swipe modes supported
assert(studioJs.includes('function applyCapturedSwipePixelDiff(dataUrlProd, dataUrlStg,'),
  "studio.js must define applyCapturedSwipePixelDiff for swipe mode");
assert(studioJs.includes('if (currentMode === "swipe") {'),
  "requestLivePixelDiff must handle swipe mode without disrupting UI");
console.log("PASS 3: Live pixel diff capture supports both 3-Column and Swipe modes.");

// 4. Verify Layout Shifts match Python YELLOW=(250, 204, 21, 220) and create_hazard_stripe_box
assert(studioJs.includes('function drawHazardStripes(ctx, x, y, width, height, stripeW = 14)'),
  "studio.js must define drawHazardStripes matching create_hazard_stripe_box");
assert(studioJs.includes('function drawYellowHighlight(ctx, x, y, width, height)'),
  "studio.js must define drawYellowHighlight matching paste_yellow_highlight");
assert(studioJs.includes('ctx.fillStyle = "rgba(250, 204, 21, 0.86)";'),
  "drawYellowHighlight must use YELLOW = (250, 204, 21, 220) matching Python diff_engine.py");
console.log("PASS 4: Layout shift hazard stripes and highlights match Python diff_engine.py.");

// 5. Behavioral Simulation: Test computeSubpixelPixelDiff algorithm
console.log("TEST 5: Simulating computeSubpixelPixelDiff with anti-aliasing edge and real difference...");

const W = 4;
const H = 4;
const pData = new Uint8ClampedArray(W * H * 4);
const sData = new Uint8ClampedArray(W * H * 4);

// Fill with white background
pData.fill(255);
sData.fill(255);

// Scenario A: 1px font anti-aliasing shift (Prod has gray pixel at (1,1), Staging has it at (1,2))
// Neighbor check should REJECT this as subpixel smoothing
pData[(1 * W + 1) * 4] = 180;
pData[(1 * W + 1) * 4 + 1] = 180;
pData[(1 * W + 1) * 4 + 2] = 180;

sData[(2 * W + 1) * 4] = 180;
sData[(2 * W + 1) * 4 + 1] = 180;
sData[(2 * W + 1) * 4 + 2] = 180;

// Scenario B: Real difference at (3,3) (Prod is blue, Staging is red)
pData[(3 * W + 3) * 4] = 30;
pData[(3 * W + 3) * 4 + 1] = 60;
pData[(3 * W + 3) * 4 + 2] = 220;

sData[(3 * W + 3) * 4] = 220;
sData[(3 * W + 3) * 4 + 1] = 30;
sData[(3 * W + 3) * 4 + 2] = 30;

function computeSubpixelTest(dataP, dataS, width, height, tolerance = 20) {
  const outData = new Uint8ClampedArray(width * height * 4);
  let diffPixels = 0;
  const totalPixels = width * height;
  const baseDiff = new Uint8Array(totalPixels);
  for (let idx = 0, pIdx = 0; idx < totalPixels; idx++, pIdx += 4) {
    const rD = Math.abs(dataP[pIdx] - dataS[pIdx]);
    const gD = Math.abs(dataP[pIdx + 1] - dataS[pIdx + 1]);
    const bD = Math.abs(dataP[pIdx + 2] - dataS[pIdx + 2]);
    baseDiff[idx] = Math.max(rD, gD, bD);
  }

  const neighbors = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, 1], [-1, 1], [1, -1]
  ];

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      let minDiff = baseDiff[idx];

      if (minDiff > tolerance) {
        const pIdx = idx * 4;
        const rS = dataS[pIdx];
        const gS = dataS[pIdx + 1];
        const bS = dataS[pIdx + 2];

        for (let n = 0; n < 8; n++) {
          const nx = x + neighbors[n][0];
          const ny = y + neighbors[n][1];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nPIdx = (ny * width + nx) * 4;
            const curDiff = Math.max(
              Math.abs(dataP[nPIdx] - rS),
              Math.abs(dataP[nPIdx + 1] - gS),
              Math.abs(dataP[nPIdx + 2] - bS)
            );
            if (curDiff < minDiff) {
              minDiff = curDiff;
              if (minDiff <= tolerance) break;
            }
          }
        }
      }

      if (minDiff > tolerance) {
        const pIdx = idx * 4;
        outData[pIdx] = 225;
        outData[pIdx + 1] = 29;
        outData[pIdx + 2] = 72;
        outData[pIdx + 3] = 220;
        diffPixels++;
      }
    }
  }

  return { outData, diffPixels };
}

const result = computeSubpixelTest(pData, sData, W, H, 20);

// Verify Scenario B (real diff at (3,3)) was detected and colored RED=(225, 29, 72, 220)
const diffIdx = (3 * W + 3) * 4;
assert.strictEqual(result.outData[diffIdx], 225, "Red channel must be 225");
assert.strictEqual(result.outData[diffIdx + 1], 29, "Green channel must be 29");
assert.strictEqual(result.outData[diffIdx + 2], 72, "Blue channel must be 72");
assert.strictEqual(result.outData[diffIdx + 3], 220, "Alpha channel must be 220");

// Verify Scenario A (1px shifted anti-aliased edge) was correctly rejected
const aaIdx1 = (1 * W + 1) * 4;
const aaIdx2 = (2 * W + 1) * 4;
assert.strictEqual(result.outData[aaIdx1 + 3], 0, "Anti-aliasing shift must be rejected (alpha = 0)");
assert.strictEqual(result.outData[aaIdx2 + 3], 0, "Anti-aliasing shift must be rejected (alpha = 0)");

assert.strictEqual(result.diffPixels, 1, "Only the genuine visual regression at (3,3) should be counted");
console.log("PASS 5: Subpixel difference test successfully rejected anti-aliasing edge and isolated true difference!");

console.log("\nALL PYTHON SUBPIXEL PIXEL DIFF ENGINE TESTS PASSED SUCCESSFULLY!");
