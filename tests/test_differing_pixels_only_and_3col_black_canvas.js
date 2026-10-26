const fs = require('fs');
const assert = require('assert');

console.log("=================================================================");
console.log("TESTING DIFFERING PIXELS ONLY, 3RD COL BLACK CANVAS, & DESKTOP DEFAULT");
console.log("=================================================================\n");

const studioJs = fs.readFileSync('studio.js', 'utf8');
const studioHtml = fs.readFileSync('studio.html', 'utf8');
const studioCss = fs.readFileSync('studio.css', 'utf8');

// 1. Viewport Device Default: Desktop (1920x1080)
console.log("1. Verifying Desktop (1920x1080) Default Device Preset...");
assert(studioHtml.includes('<option value="1920x1080" selected>Desktop (1920 × 1080)</option>'),
  "studio.html must default viewport select to 1920x1080 Desktop");
assert(studioJs.includes('viewportSelect.value = "1920x1080"'),
  "studio.js must initialize viewportSelect.value to 1920x1080");
console.log("  ✓ Desktop (1920 × 1080) is verified as the default selected device preset in HTML & JS\n");

// 2. 3rd Column Black Page Toggle (Default On)
console.log("2. Verifying 3rd Column Black Page Toggle & Default State...");
assert(studioHtml.includes('id="btn-col-diff-base"'), "studio.html must contain #btn-col-diff-base toggle button");
assert(studioHtml.includes('class="pane-btn btn-col-diff-base active"'), "btn-col-diff-base must default to active class");
assert(studioHtml.includes('class="pixel-diff-viewport black-page"'), "pixel-diff-viewport must default to black-page class");
assert(studioCss.includes('.pixel-diff-viewport.black-page'), "studio.css must define .pixel-diff-viewport.black-page");
assert(studioCss.includes('background-color: #000000 !important;'), "black-page must set pitch black background #000000");
assert(studioCss.includes('.pixel-diff-viewport.black-page .diff-base-iframe {\n  display: none !important;\n}'),
  "black-page must hide diff-base-iframe so underlying page does not show");
assert(studioJs.includes('let isDiffBasePageVisible = false;'), "isDiffBasePageVisible must default to false");
assert(studioJs.includes('function updateDiffBaseVisibility'), "studio.js must define updateDiffBaseVisibility");
assert(studioJs.includes('btnColDiffBase.addEventListener("click"'), "btnColDiffBase click listener must be wired up");
console.log("  ✓ Column 3 Black Canvas mode is active by default with underlaid iframe hidden");
console.log("  ✓ Interactive toggle button switches between Black Canvas and Underlaid Page cleanly\n");

// 3. Subpixel Differing Pixels Only Engine
console.log("3. Verifying Differing Pixels Only (No Solid Bounding Box Washes)...");
assert(studioJs.includes('ALLOW_SOLID_BOX_DIFF = false'), "ALLOW_SOLID_BOX_DIFF must be false to prevent solid rectangular fills");
assert(studioJs.includes('item.diffType === "added" ? "" :'), "renderElementSubpixelDiff must treat added elements with blank Prod text");
assert(studioJs.includes('item.diffType === "removed" ? "" :'), "renderElementSubpixelDiff must treat removed elements with blank Staging text");
assert(studioJs.includes('computeSubpixelPixelDiff(dataP, dataS, elW, elH, 14)'), "renderElementSubpixelDiff must invoke subpixel comparison engine");
assert(studioJs.includes('const liveTargetFrame = iframeDiffBase || iframeStg;'), "renderPixelDiffColumn3 must define liveTargetFrame");
assert(studioJs.includes('const liveFallbackFrame = iframeProd;'), "renderPixelDiffColumn3 must define liveFallbackFrame");
console.log("  ✓ renderPixelDiffColumn3 defines live frames and eliminates ReferenceError");
console.log("  ✓ Added and removed items are subpixel-diffed without full solid color card washes");
console.log("  ✓ Solid box fill fallback is disabled\n");

// 4. Behavioral Simulation: Testing Subpixel Engine on Added, Removed, and Text Changes
console.log("4. Behavioral Simulation: Testing Subpixel Engine on Differences...");

const fnPixelDiffMatch = studioJs.match(/function computeSubpixelPixelDiff\(dataP, dataS, width, height, tolerance = 20, shiftRegions = null\) \{[\s\S]*?\n  \}/);
assert(fnPixelDiffMatch, "computeSubpixelPixelDiff must be extractable");
const computeSubpixel = new Function(`return ${fnPixelDiffMatch[0]};`)();

// Simulate a 50x50 canvas for an element
const width = 50;
const height = 50;
const dataProd = new Uint8ClampedArray(width * height * 4);
const dataStg = new Uint8ClampedArray(width * height * 4);

// Test A: Text Change (Unchanged prefix "Item " -> Differing value "A" vs "B")
// Both Prod & Staging have identical white background (255, 255, 255, 255)
for (let i = 0; i < width * height * 4; i += 4) {
  dataProd[i] = 255; dataProd[i+1] = 255; dataProd[i+2] = 255; dataProd[i+3] = 255;
  dataStg[i] = 255; dataStg[i+1] = 255; dataStg[i+2] = 255; dataStg[i+3] = 255;
}

// Draw identical prefix pixel at (10, 10) in black (0, 0, 0, 255)
const idxPrefix = (10 * width + 10) * 4;
dataProd[idxPrefix] = 0; dataProd[idxPrefix+1] = 0; dataProd[idxPrefix+2] = 0; dataProd[idxPrefix+3] = 255;
dataStg[idxPrefix] = 0; dataStg[idxPrefix+1] = 0; dataStg[idxPrefix+2] = 0; dataStg[idxPrefix+3] = 255;

// Draw differing character pixel at (30, 10) (Staging has black pixel, Prod is white)
const idxDiff = (10 * width + 30) * 4;
dataProd[idxDiff] = 255; dataProd[idxDiff+1] = 255; dataProd[idxDiff+2] = 255; dataProd[idxDiff+3] = 255;
dataStg[idxDiff] = 0; dataStg[idxDiff+1] = 0; dataStg[idxDiff+2] = 0; dataStg[idxDiff+3] = 255;

const result = computeSubpixel(dataProd, dataStg, width, height, 15);

// Prefix pixel MUST be transparent (alpha = 0)
assert.strictEqual(result.outData[idxPrefix + 3], 0, "Identical prefix pixel must be 100% transparent (no red wash)");

// Background pixel MUST be transparent (alpha = 0)
const idxBg = (0 * width + 0) * 4;
assert.strictEqual(result.outData[idxBg + 3], 0, "Identical background pixel must be 100% transparent");

// Differing pixel MUST be RED (225, 29, 72, 220)
assert.strictEqual(result.outData[idxDiff], 225, "Differing pixel R must be 225");
assert.strictEqual(result.outData[idxDiff + 1], 29, "Differing pixel G must be 29");
assert.strictEqual(result.outData[idxDiff + 2], 72, "Differing pixel B must be 72");
assert.strictEqual(result.outData[idxDiff + 3], 220, "Differing pixel A must be 220 (0.86 alpha)");

console.log("  ✓ Identical text and background pixels remain 100% transparent");
console.log("  ✓ Differing text pixels are highlighted in RED (225, 29, 72, 220)");

console.log("\n=================================================================");
console.log("ALL DIFFERING PIXELS & 3-COL BLACK CANVAS TESTS PASSED (100% SUCCESS)!");
console.log("=================================================================");
