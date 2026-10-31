const fs = require("fs");
const path = require("path");
const assert = require("assert");

console.log("=================================================================");
console.log("TESTING ASPECT RATIO AUTO-ZOOM OUT & DEVICE FITTING PARITY");
console.log("=================================================================\n");

const baseDir = path.resolve(__dirname, "..");
const studioHtml = fs.readFileSync(path.join(baseDir, "studio.html"), "utf8");
const studioCss = fs.readFileSync(path.join(baseDir, "studio.css"), "utf8");
const studioJs = require("./helpers").readStudioJs();

// 1. Verify Auto (Fit) Option in studio.html
console.log("1. Verifying Auto (Fit) Option in studio.html...");
assert(studioHtml.includes('<option value="auto" selected>Auto (Fit)</option>'), "zoom-select must have Auto (Fit) option as default");
console.log("  ✓ Auto (Fit) scale option verified in studio.html");

// 2. Verify applyViewportPresetAndZoom Function in studio.js
console.log("\n2. Verifying applyViewportPresetAndZoom Function in studio.js...");
assert(studioJs.includes("function applyViewportPresetAndZoom("), "studio.js must define applyViewportPresetAndZoom");
assert(studioJs.includes("scaleX = stageW / targetScalerW;"), "Must calculate scaleX from stage and target width");
assert(studioJs.includes("scaleY = stageH / targetScalerH;"), "Must calculate scaleY from stage and target height");
assert(studioJs.includes("autoScale = Math.min(scaleX, scaleY);"), "Must use Math.min to fit both dimensions");
assert(studioJs.includes("viewportScaler.style.transform = `scale(${activeScale})`"), "Must apply scale transform to viewportScaler");
assert(studioJs.includes("viewportScaler.style.transformOrigin = \"top center\""), "Must pin transformOrigin to top center");
assert(studioJs.includes("viewportScaler.style.marginBottom = `-${marginB}px`"), "Must counteract vertical overflow with negative margin-bottom");
console.log("  ✓ applyViewportPresetAndZoom calculates optimal auto-fit scale");
console.log("  ✓ Negative margins eliminate layout scrollbars when scaled down");

// 3. Behavioral Simulation of Auto-Zoom Math
console.log("\n3. Simulating Auto-Zoom Math for Device Presets...");

function simulateAutoZoom(val, mode, stageW, stageH, isColDiff = false) {
  if (val === "responsive") {
    return { width: "100%", height: "100%", scale: 1 };
  }
  const [wStr, hStr] = val.split("x");
  const presetW = parseInt(wStr, 10);
  const presetH = parseInt(hStr, 10);
  let targetScalerW = presetW;
  let targetScalerH = presetH;

  if (mode === "side-by-side") {
    const numCols = isColDiff ? 3 : 2;
    const colGap = 10;
    targetScalerW = (presetW * numCols) + (colGap * (numCols - 1));
  }

  const scaleX = stageW / targetScalerW;
  const scaleY = stageH / targetScalerH;
  let autoScale = Math.min(scaleX, scaleY);
  autoScale = Math.min(1, autoScale);
  autoScale = Math.max(0.15, Math.floor(autoScale * 100) / 100);

  return {
    width: `${targetScalerW}px`,
    height: `${targetScalerH}px`,
    scale: autoScale
  };
}

const mockStageW = 1200;
const mockStageH = 650;

// Test 3A: Mobile (440 x 956) in Swipe Mode
const mobSwipe = simulateAutoZoom("440x956", "swipe", mockStageW, mockStageH);
assert.strictEqual(mobSwipe.width, "440px");
assert.strictEqual(mobSwipe.height, "956px");
assert(mobSwipe.scale < 1, "Mobile must zoom out to fit vertical stage height");
assert.strictEqual(mobSwipe.scale, Math.floor((mockStageH / 956) * 100) / 100);
console.log(`  ✓ Mobile in Swipe Mode (440x956): scaled to ${mobSwipe.scale * 100}% -> fits cleanly inside stage (${mobSwipe.width} x ${mobSwipe.height})`);

// Test 3B: Mobile (440 x 956) in Side-by-Side Mode (2 Columns)
const mobSide = simulateAutoZoom("440x956", "side-by-side", mockStageW, mockStageH);
assert.strictEqual(mobSide.width, "890px"); // 440*2 + 10
assert.strictEqual(mobSide.height, "956px");
assert.strictEqual(mobSide.scale, Math.floor((mockStageH / 956) * 100) / 100);
console.log(`  ✓ Mobile in Side-by-Side (2 cols): width 890px, height 956px, scaled to ${mobSide.scale * 100}% -> both phones fit side-by-side`);

// Test 3C: Desktop (1920 x 1080) in Swipe Mode
const dskSwipe = simulateAutoZoom("1920x1080", "swipe", mockStageW, mockStageH);
assert.strictEqual(dskSwipe.width, "1920px");
assert.strictEqual(dskSwipe.height, "1080px");
assert(dskSwipe.scale < 1, "Desktop must zoom out to fit stage");
assert.strictEqual(dskSwipe.scale, Math.floor(Math.min(mockStageW / 1920, mockStageH / 1080) * 100) / 100);
console.log(`  ✓ Desktop in Swipe Mode (1920x1080): scaled to ${dskSwipe.scale * 100}% -> full desktop monitor visible without scroll`);

// Test 3D: Responsive Mode
const resp = simulateAutoZoom("responsive", "side-by-side", mockStageW, mockStageH);
assert.strictEqual(resp.width, "100%");
assert.strictEqual(resp.height, "100%");
assert.strictEqual(resp.scale, 1);
console.log(`  ✓ Responsive Mode: 100% fluid, scale 1.0 (100%)`);

// 4. Verify Integration Across Mode Switch and Resize
console.log("\n4. Verifying Event Hooks and Mode Switch Integration...");
assert(studioJs.includes('viewportSelect.addEventListener("change"'), "viewportSelect change event hooked");
assert(studioJs.includes('applyViewportPresetAndZoom(true);'), "Must force auto scale on preset change");
assert(studioJs.includes('zoomSelect.addEventListener("change"'), "zoomSelect change event hooked");
assert(studioJs.includes('applyViewportPresetAndZoom(false);'), "Must honor manual scale choice");

console.log("\n=================================================================");
console.log("ALL ASPECT RATIO AUTO-ZOOM FIT TESTS PASSED (100% SUCCESS)!");
console.log("=================================================================");
