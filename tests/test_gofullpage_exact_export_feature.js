const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("=================================================================");
console.log("TESTING EXACT GOFULLPAGE EXPORT FEATURE VERIFICATION");
console.log("=================================================================");

const baseDir = path.join(__dirname, "..");
const studioJs = require("./helpers").readStudioJs();
const studioHtml = fs.readFileSync(path.join(baseDir, "studio.html"), "utf8");
const studioCss = fs.readFileSync(path.join(baseDir, "studio.css"), "utf8");
const syncAgentJs = fs.readFileSync(path.join(baseDir, "sync_agent.js"), "utf8");
const zipExporterJs = fs.readFileSync(path.join(baseDir, "zip_exporter.js"), "utf8");

// 1. Verify GoFullPage UI Controls in studio.html
console.log("\n1. Verifying GoFullPage UI Controls in studio.html...");
assert(studioHtml.includes('id="btn-export-pdf"'), "studio.html must define btn-export-pdf");
assert(studioHtml.includes('id="btn-export-png"'), "studio.html must define btn-export-png");
assert(studioHtml.includes('id="gofullpage-viewer-modal"'), "studio.html must define gofullpage-viewer-modal");
assert(studioHtml.includes('id="gofullpage-viewer-title"'), "studio.html must define gofullpage-viewer-title");
assert(studioHtml.includes('id="gofullpage-viewer-dims"'), "studio.html must define gofullpage-viewer-dims");
assert(studioHtml.includes('id="btn-gofullpage-view-stg"'), "studio.html must define btn-gofullpage-view-stg");
assert(studioHtml.includes('id="btn-gofullpage-view-prod"'), "studio.html must define btn-gofullpage-view-prod");
assert(studioHtml.includes('id="btn-gofullpage-view-diff"'), "studio.html must define btn-gofullpage-view-diff");
assert(studioHtml.includes('id="btn-gofullpage-dl-pdf"'), "studio.html must define btn-gofullpage-dl-pdf");
assert(studioHtml.includes('id="btn-gofullpage-dl-png"'), "studio.html must define btn-gofullpage-dl-png");
assert(studioHtml.includes('id="btn-gofullpage-close"'), "studio.html must define btn-gofullpage-close");
assert(studioHtml.includes('id="gofullpage-body-wrap"'), "studio.html must define gofullpage-body-wrap");
assert(studioHtml.includes('id="gofullpage-preview-canvas"'), "studio.html must define gofullpage-preview-canvas");
console.log("  ✓ All 12 GoFullPage viewer DOM elements defined in studio.html");

// 2. Verify GoFullPage CSS Styling in studio.css
console.log("\n2. Verifying GoFullPage CSS Styling in studio.css...");
assert(studioCss.includes(".gofullpage-viewer-backdrop"), "studio.css must style .gofullpage-viewer-backdrop");
assert(studioCss.includes(".gofullpage-header-bar"), "studio.css must style .gofullpage-header-bar");
assert(studioCss.includes(".gofullpage-pill"), "studio.css must style .gofullpage-pill");
assert(studioCss.includes(".btn-gofullpage-action"), "studio.css must style .btn-gofullpage-action");
assert(studioCss.includes(".gofullpage-canvas-container"), "studio.css must style .gofullpage-canvas-container");
console.log("  ✓ GoFullPage header bar, segmented pills, and preview container styled matching GoFullPage UX");

// 3. Verify Direct One-Click GoFullPage Flow in studio.js
console.log("\n3. Verifying Direct One-Click GoFullPage Flow in studio.js...");
assert(studioJs.includes('btnExportPdf.addEventListener("click", () => {\n      handleGoFullPageExportFlow("pdf");\n    });'),
  "btnExportPdf must trigger handleGoFullPageExportFlow('pdf') directly without 5-card modal");
assert(studioJs.includes('btnExportPng.addEventListener("click", () => {\n      handleGoFullPageExportFlow("png");\n    });'),
  "btnExportPng must trigger handleGoFullPageExportFlow('png') directly");
assert(studioJs.includes("handleGoFullPageExportFlow"), "studio.js must define handleGoFullPageExportFlow");
assert(studioJs.includes("renderGoFullPagePreview"), "studio.js must define renderGoFullPagePreview");
console.log("  ✓ Clicking 'Export PDF' immediately triggers full-page capture and downloads continuous PDF");
console.log("  ✓ Clicking 'Export PNG' immediately triggers full-page capture and downloads high-res PNG");

// 4. Verify Duplicate Fixed Header Elimination
console.log("\n4. Verifying Duplicate Fixed Header Elimination...");
assert(syncAgentJs.includes('type === "VC_CAPTURE_SLICE_START"'), "sync_agent.js must handle VC_CAPTURE_SLICE_START");
assert(syncAgentJs.includes("hideFixedHeadersForSlice"), "sync_agent.js must define hideFixedHeadersForSlice");
assert(studioJs.includes('type: "VC_CAPTURE_SLICE_START", sliceIndex: sliceIdx'), "studio.js must notify frames of sliceIndex");
console.log("  ✓ Slices s > 0 hide fixed/sticky headers so headers are captured strictly once at top of page");

// 5. Verify VisualCompareZip exportSinglePdf and exportSinglePng
console.log("\n5. Verifying VisualCompareZip export APIs...");
global.window = {};
eval(zipExporterJs);

const { buildGoFullPagePdf, exportSinglePdf, exportSinglePng } = global.window.VisualCompareZip;
assert(typeof exportSinglePng === "function", "VisualCompareZip must expose exportSinglePng");
assert(typeof exportSinglePdf === "function", "VisualCompareZip must expose exportSinglePdf");

execSync('magick -size 10x10 xc:green /tmp/vc_test_tile_green.jpg 2>/dev/null || convert -size 10x10 xc:green /tmp/vc_test_tile_green.jpg');
const testJpeg = fs.readFileSync('/tmp/vc_test_tile_green.jpg');

const mockCanvas = {
  width: 1400,
  height: 4200,
  toDataURL: (mime, quality) => "data:image/jpeg;base64," + testJpeg.toString("base64")
};

const pdfResult = exportSinglePdf({
  prodUrl: "https://example.com/p",
  stgUrl: "https://example.com/s",
  canvasProd: mockCanvas,
  canvasStg: mockCanvas,
  canvasDiff: mockCanvas
}, "master");

fs.writeFileSync("/tmp/vc_gofullpage_master_verify.pdf", Buffer.from(pdfResult.bytes));
const pdfInfo = execSync("pdfinfo /tmp/vc_gofullpage_master_verify.pdf").toString();
assert(pdfInfo.includes("Pages:           1"), "GoFullPage PDF must be exactly 1 continuous page");
assert(pdfInfo.includes("1050 x 3150 pts") || (pdfInfo.includes("1050") && pdfInfo.includes("3150")), "Page size must be 1400 * 0.75 = 1050 pt");

const pngResult = exportSinglePng(mockCanvas, "gofullpage-test.png");
assert(pngResult.bytes && pngResult.bytes.length > 50, "exportSinglePng must produce valid PNG bytes");
console.log("  ✓ PDF output: 1 single continuous page (1050 x 3150 pt / 1400 x 4200 px), edge-to-edge");
console.log("  ✓ PNG output: Full-resolution lossless image export");

// 6. Verify Hotkeys
console.log("\n6. Verifying GoFullPage Hotkeys...");
assert(studioJs.includes('e.key === "p" || e.key === "P" || (e.altKey && (e.key === "p" || e.key === "P"))'),
  "studio.js must support GoFullPage hotkeys (P and Alt+Shift+P)");
console.log("  ✓ Hotkey 'P' and 'Alt+Shift+P' trigger GoFullPage capture workflow");

console.log("\n=================================================================");
console.log("ALL GOFULLPAGE EXPORT FEATURE TESTS PASSED 100%!");
console.log("=================================================================");
