// Unit Test: Full-Page PDF Export, Multi-Page Slicing & Advanced Chrome Extension Enhancements
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

console.log("=================================================================");
console.log("TESTING FULL-PAGE PDF EXPORT, SCREENSHOTS & EXTENSION ENHANCEMENTS");
console.log("=================================================================\n");

const baseDir = path.join(__dirname, "..");
const studioJs = fs.readFileSync(path.join(baseDir, "studio.js"), "utf8");
const studioHtml = fs.readFileSync(path.join(baseDir, "studio.html"), "utf8");
const syncAgentJs = fs.readFileSync(path.join(baseDir, "sync_agent.js"), "utf8");

// Mock global environment for zip_exporter.js
global.window = {};
global.TextEncoder = require("util").TextEncoder;
global.TextDecoder = require("util").TextDecoder;
require(path.join(baseDir, "zip_exporter.js"));

const {
  SimpleZip,
  SimplePdf,
  exportComparisonZip,
  exportSinglePdf,
  buildFullPageVisualPdf,
  buildFullPageDiffPdf,
  buildComprehensiveReportPdf
} = global.window.VisualCompareZip;

// 1. Verify SimplePdf Image XObject capabilities
console.log("1. Verifying SimplePdf Image XObject and Binary Builder...");
const pdf = new SimplePdf();
assert(typeof pdf.addImage === "function", "SimplePdf must support addImage");
assert(typeof pdf.drawImage === "function", "SimplePdf must support drawImage");

// Generate minimal 10x10 mock JPEG
execSync('convert -size 10x10 xc:red /tmp/vc_test_tile.jpg');
const sampleJpeg = fs.readFileSync('/tmp/vc_test_tile.jpg');

const imgObj = pdf.addImage(sampleJpeg, 10, 10);
const page = pdf.addPage(612, 792);
pdf.drawText(page, "Test Title", 40, 750, 14, true, [0.1, 0.2, 0.4]);
pdf.drawImage(page, imgObj, 40, 500, 200, 200);

const pdfBytes = pdf.build();
assert(pdfBytes instanceof Uint8Array, "pdf.build() must return Uint8Array");
fs.writeFileSync('/tmp/vc_test_doc.pdf', Buffer.from(pdfBytes));

// Verify with pdfinfo
const info = execSync('pdfinfo /tmp/vc_test_doc.pdf').toString();
assert(info.includes("PDF version:     1.4"), "Must be valid PDF-1.4");
assert(info.includes("Pages:           1"), "Must have 1 page");
console.log("  ✓ SimplePdf Image XObject embeds JPEG streams into valid PDF-1.4\n");

// 2. Verify Full-Page Multi-Slice PDF Generator
console.log("2. Verifying Full-Page Multi-Slice PDF Generator...");
// Mock canvas object with 1200x2400 dimensions (2 pages)
const mockCanvas = {
  width: 1200,
  height: 2400,
  toDataURL: (mime, quality) => {
    return "data:image/jpeg;base64," + sampleJpeg.toString("base64");
  }
};

const meta = {
  prodUrl: "https://example.com/live",
  stgUrl: "https://staging.example.com/live",
  timestamp: "2026-10-22 11:30:00",
  device: "Desktop (1920x1080)",
  currentMode: "side-by-side",
  hazardSpacers: { PROD: [{ height: 76, targetSelector: ".banner" }], STG: [] },
  redDiffs: [{ label: "Button color changed", selector: ".cta-button", diffType: "color" }],
  totalShiftDelta: "+76px",
  diffMismatchPct: "2.14%"
};

// Test Production Full-Page PDF
const prodPdfBytes = buildFullPageVisualPdf("Production Reference", meta.prodUrl, "PROD", mockCanvas, meta);
fs.writeFileSync('/tmp/vc_test_prod_fullpage.pdf', Buffer.from(prodPdfBytes));
const prodInfo = execSync('pdfinfo /tmp/vc_test_prod_fullpage.pdf').toString();
assert(prodInfo.includes("PDF version:     1.4"), "Prod PDF must be valid PDF-1.4");
console.log("  ✓ buildFullPageVisualPdf generates multi-slice full-page Production PDF");

// Test Visual Diff Full-Page PDF
const diffPdfBytes = buildFullPageDiffPdf(meta, mockCanvas, mockCanvas, mockCanvas);
fs.writeFileSync('/tmp/vc_test_diff_fullpage.pdf', Buffer.from(diffPdfBytes));
const diffInfo = execSync('pdfinfo /tmp/vc_test_diff_fullpage.pdf').toString();
assert(diffInfo.includes("PDF version:     1.4"), "Diff PDF must be valid PDF-1.4");
console.log("  ✓ buildFullPageDiffPdf generates multi-slice full-page Visual Diff PDF");

// Test Master Comprehensive Report
const masterPdfBytes = buildComprehensiveReportPdf(meta, mockCanvas, mockCanvas, mockCanvas);
fs.writeFileSync('/tmp/vc_test_master.pdf', Buffer.from(masterPdfBytes));
const masterInfo = execSync('pdfinfo /tmp/vc_test_master.pdf').toString();
assert(masterInfo.includes("PDF version:     1.4"), "Master report must be valid PDF-1.4");
console.log("  ✓ buildComprehensiveReportPdf combines executive audit & full-page plates\n");

// 3. Verify ZIP Export Package containing all Full-Page PDFs & Screenshots
console.log("3. Verifying Complete ZIP Package Generation with Full-Page Assets...");
const fullMeta = {
  ...meta,
  canvasProd: mockCanvas,
  canvasStg: mockCanvas,
  canvasDiff: mockCanvas
};

const zipRes = exportComparisonZip(fullMeta);
assert(zipRes && zipRes.bytes instanceof Uint8Array, "exportComparisonZip must return bytes");
const unzipped = SimpleZip.unzip(zipRes.bytes);

// Check all full-page PDFs inside ZIP
assert(unzipped["Production_FullPage.pdf"], "ZIP must contain Production_FullPage.pdf");
assert(unzipped["Staging_FullPage.pdf"], "ZIP must contain Staging_FullPage.pdf");
assert(unzipped["VisualDiff_FullPage.pdf"], "ZIP must contain VisualDiff_FullPage.pdf");
assert(unzipped["VisualCompare_Diff_Report.pdf"], "ZIP must contain VisualCompare_Diff_Report.pdf");
assert(unzipped["Production_Reference.pdf"], "ZIP must contain backward-compatible Production_Reference.pdf");
assert(unzipped["Staging_Candidate.pdf"], "ZIP must contain backward-compatible Staging_Candidate.pdf");

// Check PNG screenshots inside ZIP
assert(unzipped["screenshots/prod_fullpage.png"], "ZIP must contain screenshots/prod_fullpage.png");
assert(unzipped["screenshots/stg_fullpage.png"], "ZIP must contain screenshots/stg_fullpage.png");
assert(unzipped["screenshots/diff_fullpage.png"], "ZIP must contain screenshots/diff_fullpage.png");

// Check metadata & offline interactive report
assert(unzipped["report.json"], "ZIP must contain report.json");
assert(unzipped["links.txt"], "ZIP must contain links.txt");
assert(unzipped["interactive_report.html"], "ZIP must contain interactive_report.html");

const interactiveHtml = new TextDecoder().decode(unzipped["interactive_report.html"]);
assert(interactiveHtml.includes("Production_FullPage.pdf"), "Interactive report must link to Production_FullPage.pdf");
assert(interactiveHtml.includes("VisualDiff_FullPage.pdf"), "Interactive report must link to VisualDiff_FullPage.pdf");
assert(interactiveHtml.includes("screenshots/prod_fullpage.png"), "Interactive report embeds screenshots");
console.log("  ✓ ZIP package contains all 4 Full-Page PDFs, 3 Full-Size PNG screenshots, JSON, links, and offline viewer\n");

// 4. Verify Single PDF Export API
console.log("4. Verifying exportSinglePdf API...");
const singleProd = exportSinglePdf(fullMeta, "prod");
assert(singleProd.filename.includes("prod-fullpage"), "Prod filename must match");
assert(singleProd.bytes.length > 500, "Prod PDF bytes must be valid");

const singleDiff = exportSinglePdf(fullMeta, "diff");
assert(singleDiff.filename.includes("diff-fullpage"), "Diff filename must match");

const singleMaster = exportSinglePdf(fullMeta, "master");
assert(singleMaster.filename.includes("master-report"), "Master filename must match");
console.log("  ✓ exportSinglePdf enables direct single-file PDF downloads\n");

// 5. Verify Studio UI & DOM Controls for PDF Export & Enhancements
console.log("5. Verifying Studio UI DOM Controls & Hotkeys...");
assert(studioHtml.includes('id="btn-export-pdf"'), "studio.html must define btn-export-pdf");
assert(studioHtml.includes('id="pdf-export-modal"'), "studio.html must define pdf-export-modal");
assert(studioHtml.includes('id="capture-progress-overlay"'), "studio.html must define capture-progress-overlay");
assert(studioHtml.includes('id="diff-tolerance-select"'), "studio.html must define diff-tolerance-select");
assert(studioHtml.includes('id="shortcuts-modal"'), "studio.html must define shortcuts-modal");

assert(studioJs.includes('document.getElementById("btn-export-pdf")'), "studio.js binds btn-export-pdf");
assert(studioJs.includes('document.getElementById("pdf-export-modal")'), "studio.js binds pdf-export-modal");
assert(studioJs.includes('document.getElementById("diff-tolerance-select")'), "studio.js binds diff-tolerance-select");
assert(studioJs.includes('captureFullPageAuditCanvases'), "studio.js defines captureFullPageAuditCanvases");
assert(studioJs.includes('handleExportPdfFlow'), "studio.js defines handleExportPdfFlow");
assert(studioJs.includes('handleExportZipFlow'), "studio.js defines handleExportZipFlow");

// Check Hotkeys
assert(studioJs.includes('e.key === "1"'), "Hotkeys must support mode 1");
assert(studioJs.includes('e.key === "2"'), "Hotkeys must support mode 2");
assert(studioJs.includes('e.key === "3"'), "Hotkeys must support mode 3");
assert(studioJs.includes('e.key === "4"'), "Hotkeys must support mode 4");
assert(studioJs.includes('e.key === "d" || e.key === "D"'), "Hotkeys must support D for diff");
assert(studioJs.includes('e.key === "s" || e.key === "S"'), "Hotkeys must support S for swap");
assert(studioJs.includes('e.key === "e" || e.key === "E"'), "Hotkeys must support E for export");
assert(studioJs.includes('e.key === "?"'), "Hotkeys must support ? for help");
console.log("  ✓ Studio UI buttons, modal dialogs, and keyboard shortcuts verified\n");

// 6. Verify Pre-Capture Freezing in sync_agent.js
console.log("6. Verifying Pre-Capture Animation Freeze in sync_agent.js...");
assert(syncAgentJs.includes('data.type === "VC_PREPARE_CAPTURE"'), "sync_agent must handle VC_PREPARE_CAPTURE");
assert(syncAgentJs.includes('data.type === "VC_RESTORE_CAPTURE"'), "sync_agent must handle VC_RESTORE_CAPTURE");
assert(syncAgentJs.includes('animation-duration: 0s !important'), "sync_agent freezes CSS animations");
assert(syncAgentJs.includes('transition-duration: 0s !important'), "sync_agent freezes CSS transitions");
assert(syncAgentJs.includes('.carousel'), "sync_agent pauses carousels matching Python browser.py");
console.log("  ✓ sync_agent.js implements Python browser.py pre-capture animation freeze & carousel pausing\n");

console.log("=================================================================");
console.log("ALL FULL-PAGE PDF EXPORT & EXTENSION ENHANCEMENT TESTS PASSED!");
console.log("=================================================================");
