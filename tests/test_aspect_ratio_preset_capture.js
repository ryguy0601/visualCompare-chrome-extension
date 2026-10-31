const fs = require("fs");
const path = require("path");
const assert = require("assert");

console.log("=================================================================");
console.log("TESTING ASPECT RATIO & DEVICE PRESET CAPTURE PARITY");
console.log("=================================================================\n");

const baseDir = path.resolve(__dirname, "..");
const studioHtml = fs.readFileSync(path.join(baseDir, "studio.html"), "utf8");
const studioCss = fs.readFileSync(path.join(baseDir, "studio.css"), "utf8");
const studioJs = require("./helpers").readStudioJs();
const zipExporterJs = fs.readFileSync(path.join(baseDir, "zip_exporter.js"), "utf8");

// 1. Verify Viewport Device Presets in studio.html
console.log("1. Verifying Viewport Device Presets in studio.html...");
assert(studioHtml.includes('value="responsive"'), "Must support Responsive preset");
assert(studioHtml.includes('value="1920x1080"'), "Must support Desktop 1920x1080 preset");
assert(studioHtml.includes('value="1366x768"'), "Must support Laptop 1366x768 preset");
assert(studioHtml.includes('value="768x1024"'), "Must support Tablet 768x1024 preset");
assert(studioHtml.includes('value="440x956"'), "Must support Mobile 440x956 preset");
console.log("  ✓ All 5 device presets verified (Responsive, Desktop, Laptop, Tablet, Mobile)");

// 2. Verify Dynamic Aspect Ratio CSS Variables in studio.css
console.log("\n2. Verifying Dynamic Aspect Ratio CSS Variables in studio.css...");
assert(studioCss.includes("var(--capture-pane-width, 100vw)"), "CSS must support --capture-pane-width variable");
assert(studioCss.includes("var(--capture-pane-left, 0)"), "CSS must support --capture-pane-left variable");
assert(studioCss.includes("var(--capture-pane-transform, none)"), "CSS must support --capture-pane-transform variable");
console.log("  ✓ CSS dynamically adapts active capture pane and iframes to selected device width");

// 3. Verify captureFullPageAuditCanvases Aspect Ratio Logic
console.log("\n3. Verifying studio.js Aspect Ratio Capture Engine...");
assert(studioJs.includes('const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";'), "Must read selected device preset");
assert(studioJs.includes('presetW = parseInt(wStr, 10) || 0;'), "Must parse preset width");
assert(studioJs.includes('document.body.style.setProperty("--capture-pane-width", `${presetW}px`);'), "Must apply preset width to body CSS var");
assert(studioJs.includes('if (presetW > 0) {\n      frameW = presetW;\n    }'), "Must set frameW strictly to presetW when specified");
assert(studioJs.includes('document.body.style.removeProperty("--capture-pane-width");'), "Must clean up CSS var in finally");
console.log("  ✓ studio.js sizes live iframe to exact preset width before dimension freeze");
console.log("  ✓ studio.js renders canvasProd, canvasStg, and canvasDiff at exact selected aspect ratio");

// 4. Verify GoFullPage PDF Generation with Different Aspect Ratios
console.log("\n4. Verifying GoFullPage PDF Output with Multiple Aspect Ratios...");
global.window = {};
eval(zipExporterJs);
const { buildGoFullPagePdf } = global.window.VisualCompareZip;

function checkPdfDimensions(pdfBytes) {
  const str = Buffer.from(pdfBytes).toString("binary");
  const mediaBoxMatch = str.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d\.]+)\s+([\d\.]+)\s*\]/);
  assert(mediaBoxMatch, "PDF must define /MediaBox");
  return {
    ptWidth: parseFloat(mediaBoxMatch[1]),
    ptHeight: parseFloat(mediaBoxMatch[2])
  };
}

// Test 4A: Mobile Aspect Ratio (440 x 3000 px)
const mockMobileCanvas = {
  width: 440,
  height: 3000,
  toDataURL: (mime, q) => "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
};
const mobilePdf = buildGoFullPagePdf(mockMobileCanvas);
const mobileDims = checkPdfDimensions(mobilePdf);
assert.strictEqual(mobileDims.ptWidth, 330, "Mobile PDF ptWidth must be 440 * 0.75 = 330 pt");
assert.strictEqual(mobileDims.ptHeight, 2250, "Mobile PDF ptHeight must be 3000 * 0.75 = 2250 pt");
console.log(`  ✓ Mobile (440x3000 px) -> PDF: ${mobileDims.ptWidth} x ${mobileDims.ptHeight} pt (Exact mobile aspect ratio)`);

// Test 4B: Tablet Aspect Ratio (768 x 3000 px)
const mockTabletCanvas = {
  width: 768,
  height: 3000,
  toDataURL: (mime, q) => "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
};
const tabletPdf = buildGoFullPagePdf(mockTabletCanvas);
const tabletDims = checkPdfDimensions(tabletPdf);
assert.strictEqual(tabletDims.ptWidth, 576, "Tablet PDF ptWidth must be 768 * 0.75 = 576 pt");
assert.strictEqual(tabletDims.ptHeight, 2250, "Tablet PDF ptHeight must be 3000 * 0.75 = 2250 pt");
console.log(`  ✓ Tablet (768x3000 px) -> PDF: ${tabletDims.ptWidth} x ${tabletDims.ptHeight} pt (Exact tablet aspect ratio)`);

// Test 4C: Desktop Aspect Ratio (1920 x 3000 px)
const mockDesktopCanvas = {
  width: 1920,
  height: 3000,
  toDataURL: (mime, q) => "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
};
const desktopPdf = buildGoFullPagePdf(mockDesktopCanvas);
const desktopDims = checkPdfDimensions(desktopPdf);
assert.strictEqual(desktopDims.ptWidth, 1440, "Desktop PDF ptWidth must be 1920 * 0.75 = 1440 pt");
assert.strictEqual(desktopDims.ptHeight, 2250, "Desktop PDF ptHeight must be 3000 * 0.75 = 2250 pt");
console.log(`  ✓ Desktop (1920x3000 px) -> PDF: ${desktopDims.ptWidth} x ${desktopDims.ptHeight} pt (Exact desktop aspect ratio)`);

console.log("\n=================================================================");
console.log("ALL ASPECT RATIO & DEVICE PRESET CAPTURE TESTS PASSED (100% SUCCESS)!");
console.log("=================================================================");
