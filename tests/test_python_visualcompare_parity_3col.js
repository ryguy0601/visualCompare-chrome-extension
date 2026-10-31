const fs = require('fs');
const assert = require('assert');

console.log("=================================================================");
console.log("TESTING PYTHON VISUALCOMPARE PARITY FOR 3RD COLUMN BLACK CANVAS");
console.log("=================================================================\n");

const studioJs = require("./helpers").readStudioJs();
const studioHtml = fs.readFileSync('studio.html', 'utf8');
const studioCss = fs.readFileSync('studio.css', 'utf8');

// 1. Verify Desktop Default & Black Canvas Defaults
console.log("1. Verifying Desktop Viewport & Column 3 Black Canvas Defaults...");
assert(studioHtml.includes('<option value="1920x1080" selected>Desktop (1920 × 1080)</option>'), "HTML must select Desktop (1920x1080) by default");
assert(studioHtml.includes('class="pixel-diff-viewport black-page"'), "Viewport must have black-page class by default");
assert(studioHtml.includes('btn-col-diff-base active'), "Black Canvas toggle button must be active by default");
assert(studioCss.includes('.pixel-diff-viewport.black-page'), "CSS must define black-page style");
assert(studioCss.includes('background-color: #000000 !important;'), "Black-page must enforce #000000 background");
assert(studioCss.includes('.pixel-diff-viewport.black-page .diff-base-iframe'), "CSS must hide base iframe in black-page");
console.log("  ✓ Desktop (1920x1080) and Black Canvas (#000000) default states verified\n");

// 2. Verify Resolution Alignment in applyCapturedPixelDiff
console.log("2. Verifying Resolution & Scaling Parity in applyCapturedPixelDiff...");
assert(studioJs.includes('const targetW = wrapFrameDiff?.clientWidth || iframeProd?.clientWidth || Math.round(rProd.width);'), "applyCapturedPixelDiff must use unscaled layout width");
assert(studioJs.includes('const targetH = wrapFrameDiff?.clientHeight || iframeProd?.clientHeight || Math.round(rProd.height);'), "applyCapturedPixelDiff must use unscaled layout height");
assert(studioJs.includes('outCanvas.width = targetW;'), "outCanvas must match targetW");
assert(studioJs.includes('outCanvas.height = targetH;'), "outCanvas must match targetH");
assert(studioJs.includes('outCtx.drawImage(tempCanvas, 0, 0, outCanvas.width, outCanvas.height);'), "tempCanvas must scale to outCanvas");
console.log("  ✓ Captured pixel diff canvas matches Column 3 unscaled dimensions (no discarding!)\n");

// 3. Verify Continuous Diff Scroll Glide
console.log("3. Verifying Continuous Scroll Glide in Column 3 and Swipe Mode...");
assert(studioJs.includes('const deltaY = (currentScrollY - (lastCapturedScrollY || 0));'), "Must calculate scroll deltaY");
assert(studioJs.includes('const deltaX = (currentScrollX - (lastCapturedScrollX || 0));'), "Must calculate scroll deltaX");
assert(studioJs.includes('offCtx.drawImage(lastCapturedDiffCanvas, -deltaX, -deltaY);'), "Must draw diff canvas shifted by (-deltaX, -deltaY) to glide with scroll");
console.log("  ✓ Differences glide with scroll motion matching Python synchronized scroll\n");

// 4. Verify Live Frame Element Querying when Base Frame is Hidden
console.log("4. Verifying Live Frame Querying when Black Canvas is Active...");
assert(studioJs.includes('const isBlackCanvas = !isDiffBasePageVisible;'), "Must check isBlackCanvas");
assert(studioJs.includes('const liveTargetFrame = iframeDiffBase || iframeStg;'), "Must define liveTargetFrame");
assert(studioJs.includes('const activeRenderFrame = (!isBlackCanvas && iframeDiffBase) ? iframeDiffBase : (iframeStg || iframeProd);'), "Must use live frame for geometry when black canvas");
assert(studioJs.includes('if (!isBlackCanvas && iframeDiffBase && iframeDiffBase.contentDocument)'), "Must avoid collapsed zero rects from hidden iframeDiffBase");
assert(studioJs.includes('function applyCanvasBackground(ctx, bgStr, w, h, radius = 0)'), "applyCanvasBackground helper must exist");
console.log("  ✓ Live element geometry and styles queried from rendered frames\n");

// 5. Behavioral Simulation: Subpixel Diff Parity with Python diff_engine.py
console.log("5. Behavioral Simulation: Subpixel Diff Parity with Python diff_engine.py...");
// Extract computeSubpixelPixelDiff
const fnMatch = studioJs.match(/function computeSubpixelPixelDiff\([\s\S]*?\n  \}/);
assert(fnMatch, "computeSubpixelPixelDiff must exist in studio.js");
const computeSubpixelPixelDiff = eval(`(${fnMatch[0]})`);

const w = 20;
const h = 20;
const dataP = new Uint8ClampedArray(w * h * 4);
const dataS = new Uint8ClampedArray(w * h * 4);

// Fill with identical white background
for (let i = 0; i < w * h * 4; i += 4) {
  dataP[i] = 255; dataP[i+1] = 255; dataP[i+2] = 255; dataP[i+3] = 255;
  dataS[i] = 255; dataS[i+1] = 255; dataS[i+2] = 255; dataS[i+3] = 255;
}

// Add differing word/pixel in center (x=10, y=10)
const diffIdx = (10 * w + 10) * 4;
dataS[diffIdx] = 0; dataS[diffIdx+1] = 0; dataS[diffIdx+2] = 0; dataS[diffIdx+3] = 255; // black pixel on Staging

const { outData, diffPixels } = computeSubpixelPixelDiff(dataP, dataS, w, h, 20);

assert.strictEqual(diffPixels, 1, "Exactly 1 differing pixel must be detected");
assert.strictEqual(outData[diffIdx], 225, "R channel must be 225 (matching Python RED)");
assert.strictEqual(outData[diffIdx+1], 29, "G channel must be 29 (matching Python RED)");
assert.strictEqual(outData[diffIdx+2], 72, "B channel must be 72 (matching Python RED)");
assert.strictEqual(outData[diffIdx+3], 220, "A channel must be 220 (matching Python RED)");

// All other pixels must be 0 (transparent -> pitch black on Black Canvas)
for (let i = 0; i < w * h * 4; i += 4) {
  if (i !== diffIdx) {
    assert.strictEqual(outData[i+3], 0, `Pixel at index ${i} must be 100% transparent`);
  }
}
console.log("  ✓ Exact match with Python diff_engine.py: RED = (225, 29, 72, 220) strictly on differing pixels, all others transparent black\n");

console.log("=================================================================");
console.log("ALL PYTHON VISUALCOMPARE PARITY VERIFICATIONS PASSED (100% SUCCESS)!");
console.log("=================================================================");
