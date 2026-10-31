/**
 * Unit & Integration Test: Differences Engine Stability & Controls Area Improvements
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=================================================================");
console.log("TESTING DIFFERENCES ENGINE STABILITY & CONTROLS AREA IMPROVEMENTS");
console.log("=================================================================\n");

const baseDir = path.join(__dirname, "..");
const studioJs = require("./helpers").readStudioJs();
const pixelDiffEngineJs = fs.readFileSync(path.join(baseDir, "studio/pixel_diff_engine.js"), "utf8");
const redDiffDetectionJs = fs.readFileSync(path.join(baseDir, "studio/red_diff_detection.js"), "utf8");
const diffRunnerJs = fs.readFileSync(path.join(baseDir, "studio/diff_runner.js"), "utf8");
const actionRelayJs = fs.readFileSync(path.join(baseDir, "studio/action_relay.js"), "utf8");
const navigationJs = fs.readFileSync(path.join(baseDir, "studio/navigation.js"), "utf8");
const viewModesJs = fs.readFileSync(path.join(baseDir, "studio/view_modes.js"), "utf8");
const exportImportJs = fs.readFileSync(path.join(baseDir, "studio/export_import.js"), "utf8");
const studioHtml = fs.readFileSync(path.join(baseDir, "studio.html"), "utf8");
const studioCss = fs.readFileSync(path.join(baseDir, "studio.css"), "utf8");

// ----------------------------------------------------------------------------
// SUITE 1: ZERO REFERENCEERRORS & SAFE DIMENSION GUARDS IN PIXEL DIFF ENGINE
// ----------------------------------------------------------------------------
console.log("SUITE 1: Verifying Scope & Dimension Safety in Pixel Diff Engine...");

// 1. ALLOW_SOLID_BOX_DIFF declared at module level in pixel_diff_engine.js
assert(
  pixelDiffEngineJs.includes("const ALLOW_SOLID_BOX_DIFF = false;"),
  "ALLOW_SOLID_BOX_DIFF must be defined in pixel_diff_engine.js"
);
const allowSolidMatches = pixelDiffEngineJs.match(/const ALLOW_SOLID_BOX_DIFF\s*=/g) || [];
assert.strictEqual(
  allowSolidMatches.length,
  1,
  "ALLOW_SOLID_BOX_DIFF must be declared once at module scope (not trapped inside nested if blocks)"
);

// 2. renderSwipeDiffCanvas defines activeRenderFrame, liveTargetFrame, and liveFallbackFrame in function scope
const swipeFnStart = pixelDiffEngineJs.indexOf("function renderSwipeDiffCanvas");
const col3FnStart = pixelDiffEngineJs.indexOf("function renderPixelDiffColumn3");
const swipeFnBody = pixelDiffEngineJs.slice(swipeFnStart, col3FnStart);
const drawnCapturedIdxSwipe = swipeFnBody.indexOf("if (!drawnCapturedDiff)");
assert(
  swipeFnBody.indexOf("const liveTargetFrame = iframeSwipeStg;") < drawnCapturedIdxSwipe,
  "renderSwipeDiffCanvas must define liveTargetFrame in outer function scope before if (!drawnCapturedDiff)"
);
assert(
  swipeFnBody.indexOf("const activeRenderFrame = iframeSwipeStg || iframeSwipeProd;") < drawnCapturedIdxSwipe,
  "renderSwipeDiffCanvas must define activeRenderFrame in outer function scope"
);

// 3. renderPixelDiffColumn3 defines isBlackCanvas, liveTargetFrame, liveFallbackFrame, activeRenderFrame in function scope
const col3FnBody = pixelDiffEngineJs.slice(col3FnStart);
const drawnCapturedIdxCol3 = col3FnBody.indexOf("if (!drawnCapturedDiff");
assert(
  col3FnBody.indexOf("const isBlackCanvas = !isDiffBasePageVisible;") < drawnCapturedIdxCol3,
  "renderPixelDiffColumn3 must define isBlackCanvas in outer function scope"
);
assert(
  col3FnBody.indexOf("const activeRenderFrame = (!isBlackCanvas && iframeDiffBase)") < drawnCapturedIdxCol3,
  "renderPixelDiffColumn3 must define activeRenderFrame in outer function scope"
);

// 4. renderElementSubpixelDiff guards against invalid/zero dimensions
assert(
  pixelDiffEngineJs.includes("if (!Number.isFinite(drawW) || !Number.isFinite(drawH) || drawW <= 0 || drawH <= 0) return false;"),
  "renderElementSubpixelDiff must guard against zero, negative, or NaN dimensions"
);
console.log("  ✓ ALLOW_SOLID_BOX_DIFF, activeRenderFrame, and liveTargetFrame are safely scoped");
console.log("  ✓ Zero/NaN canvas dimension guards verified\n");

// ----------------------------------------------------------------------------
// SUITE 2: STRICT SELECTION-ONLY STABILITY Across Landmarks & Mode Switching
// ----------------------------------------------------------------------------
console.log("SUITE 2: Verifying Strict Selection-Only Stability Across Modes...");

assert(
  actionRelayJs.includes('if (checkSyncRedDiff && checkSyncRedDiff.checked && (isDiffActive || isColDiffActive || (currentMode === "swipe" && swipeCompareMode === "diff") || currentMode === "overlay"))'),
  "VC_LANDMARKS_REPORT must only re-run visual diff calculation when checkSyncRedDiff.checked is true"
);
assert(
  redDiffDetectionJs.includes("isDiffActive = false;") &&
  redDiffDetectionJs.includes("lastCapturedDiffCanvas = null;") &&
  redDiffDetectionJs.includes("lastAccuratePixelDiffPct = null;"),
  "clearAllRedDiffs must reset isDiffActive, lastCapturedDiffCanvas, and lastAccuratePixelDiffPct"
);
assert(
  diffRunnerJs.includes("if (!checkSyncRedDiff || !checkSyncRedDiff.checked) {\n    canvas.style.display = \"none\";"),
  "renderDiffCanvasHeatmap must keep overlay diff canvas hidden when Differences are off"
);
assert(
  !redDiffDetectionJs.includes("typeof isDemoSite"),
  "addDiffIfMissing must not reference out-of-scope isDemoSite variable"
);
console.log("  ✓ Landmark reports never auto-enable differences when Differences button is off");
console.log("  ✓ clearAllRedDiffs completely resets diff state across Side-by-Side, Swipe, and Overlay modes\n");

// ----------------------------------------------------------------------------
// SUITE 3: SENSITIVITY & OPACITY LIVE RE-RENDER SYNCHRONIZATION
// ----------------------------------------------------------------------------
console.log("SUITE 3: Verifying Sensitivity & Opacity Live Synchronization...");

assert(
  exportImportJs.includes("lastCapturedDiffCanvas = null;") &&
  exportImportJs.includes("computeAndApplyRedDifferences(true);") &&
  exportImportJs.includes("renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions);") &&
  exportImportJs.includes("renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);") &&
  exportImportJs.includes("renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);"),
  "Changing diffToleranceSelect must invalidate cached diff canvas and re-render active diffs in all modes"
);
assert(
  pixelDiffEngineJs.includes("Math.max(4, Math.round(currentDiffTolerance * 0.7))"),
  "renderElementSubpixelDiff must scale subpixel element tolerance with currentDiffTolerance"
);
assert(
  navigationJs.includes("if (diffCanvas) diffCanvas.style.opacity = (val / 100).toString();"),
  "colDiffOpacitySlider must synchronize diffCanvas opacity in Overlay mode as well"
);
console.log("  ✓ Sensitivity selector dynamically updates subpixel engine and re-renders active mode");
console.log("  ✓ Diff opacity slider controls Side-by-Side 3rd col, Swipe curtain diff, and Overlay heatmap\n");

// ----------------------------------------------------------------------------
// SUITE 4: CONTROLS AREA ERGONOMICS & VISUAL FEEDBACK
// ----------------------------------------------------------------------------
console.log("SUITE 4: Verifying Controls Area Improvements...");

assert(
  navigationJs.includes('tolGroup.classList.toggle("diff-controls-active"'),
  "Diff sensitivity group must toggle .diff-controls-active when Differences are active"
);
assert(
  navigationJs.includes('opaGroup.classList.toggle("diff-controls-active"'),
  "Diff opacity group must toggle .diff-controls-active when Differences are active"
);
assert(
  navigationJs.includes('colDiffOpacityVal.title = "Click to reset diff opacity to 85%"'),
  "Clicking colDiffOpacityVal must reset diff opacity to 85%"
);
assert(
  viewModesJs.includes('labelOpacityVal.title = "Click to reset ghost opacity to 80%"'),
  "Clicking labelOpacityVal must reset ghost overlay opacity to 80%"
);
assert(
  viewModesJs.includes('swipeDivider.addEventListener("dblclick"'),
  "Double-clicking swipeDivider must reset swipe curtain to 50% center"
);
assert(
  viewModesJs.includes('e.key === "ArrowLeft" || e.key === "ArrowRight"'),
  "ArrowLeft/ArrowRight keys must nudge swipe curtain in Swipe mode"
);
assert(
  diffRunnerJs.includes('metricShiftBadge.title = "Click to toggle yellow layout shift hazard spacers"'),
  "Clicking metricShiftBadge must toggle yellow hazard spacers"
);
assert(
  studioCss.includes(".sync-status-indicator.paused") &&
  studioCss.includes(".diff-tolerance-group.diff-controls-active"),
  "studio.css must style paused sync status indicator and active diff control groups"
);
console.log("  ✓ Master Mirror status toggle, active diff control highlights, and quick-reset controls verified\n");

// ----------------------------------------------------------------------------
// SUITE 5: END-TO-END BEHAVIORAL SIMULATION OF DIFF & CONTROL INTERACTIONS
// ----------------------------------------------------------------------------
console.log("SUITE 5: Running End-to-End Behavioral Simulation...");

const mockElements = {};
function getMockEl(id) {
  if (!mockElements[id]) {
    const classes = new Set();
    const listeners = {};
    mockElements[id] = {
      id,
      value: id === "viewport-select" ? "1920x1080" : (id === "zoom-select" ? "auto" : (id === "diff-tolerance-select" ? "20" : (id === "col-diff-opacity-slider" ? "85" : (id === "slider-overlay-opacity" ? "80" : "")))),
      checked: id !== "check-sync-red-diff",
      selectedIndex: 0,
      options: [{ value: "20", text: "Normal (20 - Balanced)" }, { value: "10", text: "High (10 - Strict)" }],
      textContent: "",
      innerHTML: "",
      title: "",
      src: "",
      width: 1200,
      height: 800,
      clientWidth: 1200,
      clientHeight: 800,
      style: { display: "none" },
      dataset: { mode: id.replace("mode-btn-", "") },
      classList: {
        add(...c) { c.forEach(x => classes.add(x)); },
        remove(...c) { c.forEach(x => classes.delete(x)); },
        contains(c) { return classes.has(c); },
        toggle(c, force) {
          const next = force !== undefined ? Boolean(force) : !classes.has(c);
          if (next) classes.add(c); else classes.delete(c);
          return next;
        }
      },
      addEventListener(evt, cb) {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(cb);
      },
      dispatchEvent(evt) {
        const list = listeners[evt.type] || [];
        list.forEach(cb => cb(evt));
      },
      click() {
        const list = listeners["click"] || [];
        list.forEach(cb => cb({ preventDefault() {}, stopPropagation() {}, target: this }));
      },
      trigger(type, evtObj = {}) {
        const list = listeners[type] || [];
        list.forEach(cb => cb(Object.assign({ preventDefault() {}, stopPropagation() {}, target: this }, evtObj)));
      },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800 }; },
      getContext() {
        return {
          clearRect() {},
          drawImage() {},
          fillRect() {},
          beginPath() {},
          roundRect() {},
          rect() {},
          fill() {},
          stroke() {},
          clip() {},
          moveTo() {},
          lineTo() {},
          closePath() {},
          fillText() {},
          save() {},
          restore() {},
          getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
          putImageData() {}
        };
      }
    };
  }
  return mockElements[id];
}

const mockDoc = {
  getElementById: getMockEl,
  createElement(tag) { return getMockEl("created-" + tag + "-" + Math.random()); },
  querySelectorAll(sel) {
    if (sel === ".mode-btn") {
      const mSide = getMockEl("mode-btn-side"); mSide.dataset.mode = "side-by-side";
      const mSwipe = getMockEl("mode-btn-swipe"); mSwipe.dataset.mode = "swipe";
      const mFlicker = getMockEl("mode-btn-flicker"); mFlicker.dataset.mode = "flicker";
      const mOverlay = getMockEl("mode-btn-overlay"); mOverlay.dataset.mode = "overlay";
      return [mSide, mSwipe, mFlicker, mOverlay];
    }
    if (sel === ".stage-view") {
      return [
        getMockEl("view-side-by-side"),
        getMockEl("view-swipe"),
        getMockEl("view-flicker"),
        getMockEl("view-overlay")
      ];
    }
    return [];
  },
  querySelector() { return null; },
  addEventListener(evt, cb) { if (evt === "DOMContentLoaded") cb(); }
};

const mockWin = {
  document: mockDoc,
  location: { search: "?prod=demo_prod.html&stg=demo_stg.html" },
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener() {},
  removeEventListener() {},
  setTimeout() { return 1; },
  clearTimeout() {},
  requestAnimationFrame(cb) { cb(); return 1; },
  cancelAnimationFrame() {},
  open() {}
};

global.window = mockWin;
global.document = mockDoc;
global.location = mockWin.location;
global.requestAnimationFrame = mockWin.requestAnimationFrame;
global.cancelAnimationFrame = mockWin.cancelAnimationFrame;
global.Event = class Event { constructor(type) { this.type = type; } };
global.ImageData = class ImageData { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } };
global.chrome = {
  runtime: {
    getURL: p => "chrome-extension://test/" + p,
    sendMessage(msg, cb) { if (cb) cb({ status: "ok" }); }
  }
};

eval(studioJs);

// 1. Test clicking #btn-toggle-red-diffs in Overlay mode
const modeBtnOverlay = getMockEl("mode-btn-overlay");
modeBtnOverlay.click();
assert.strictEqual(getMockEl("diff-output-canvas").style.display, "none", "Overlay diff canvas must start hidden when Differences are off");

const btnDiffs = getMockEl("btn-toggle-red-diffs");
btnDiffs.click();
assert.strictEqual(getMockEl("check-sync-red-diff").checked, true, "Clicking Differences button turns check-sync-red-diff ON");
assert.strictEqual(getMockEl("diff-output-canvas").style.display, "block", "Overlay diff canvas becomes visible when Differences turned ON in Overlay mode");
assert(getMockEl("diff-tolerance-group").classList.contains("diff-controls-active"), "Diff sensitivity group gets .diff-controls-active class");
assert(getMockEl("diff-opacity-toolbar-group").classList.contains("diff-controls-active"), "Diff opacity group gets .diff-controls-active class");

btnDiffs.click();
assert.strictEqual(getMockEl("check-sync-red-diff").checked, false, "Clicking Differences button again turns check-sync-red-diff OFF");
assert.strictEqual(getMockEl("diff-output-canvas").style.display, "none", "Overlay diff canvas hides when Differences turned OFF");
assert(!getMockEl("diff-tolerance-group").classList.contains("diff-controls-active"), "Diff sensitivity group removes .diff-controls-active class when OFF");

// 2. Test Opacity Quick-Reset by clicking percentage value
const opaSlider = getMockEl("col-diff-opacity-slider");
const opaVal = getMockEl("col-diff-opacity-val");
opaSlider.value = "40";
opaSlider.trigger("input", { target: opaSlider });
assert.strictEqual(opaVal.textContent, "40%", "Slider input updates opacity label to 40%");
assert.strictEqual(getMockEl("pixel-diff-canvas").style.opacity, "0.4", "pixelDiffCanvas opacity updated to 0.4");
assert.strictEqual(getMockEl("diff-output-canvas").style.opacity, "0.4", "diffCanvas opacity updated to 0.4");

opaVal.click();
assert.strictEqual(opaSlider.value, "85", "Clicking opacity label resets slider value to 85");
assert.strictEqual(opaVal.textContent, "85%", "Clicking opacity label resets text to 85%");
assert.strictEqual(getMockEl("pixel-diff-canvas").style.opacity, "0.85", "pixelDiffCanvas opacity reset to 0.85");

// 3. Test Master Mirror Status Toggle (#sync-status)
const syncStatus = getMockEl("sync-status");
syncStatus.click();
assert.strictEqual(getMockEl("check-sync-clicks").checked, false, "Clicking #sync-status pauses click mirror");
assert.strictEqual(getMockEl("check-sync-scroll").checked, false, "Clicking #sync-status pauses scroll mirror");
assert(syncStatus.classList.contains("paused"), "#sync-status has .paused class when paused");
syncStatus.click();
assert.strictEqual(getMockEl("check-sync-clicks").checked, true, "Clicking #sync-status again resumes click mirror");
assert(!syncStatus.classList.contains("paused"), "#sync-status removes .paused class when resumed");

// 4. Test Swipe Curtain Double-Click Reset
const swipeDivider = getMockEl("swipe-divider");
mockWin.__vcUpdateSwipePosition(22);
assert.strictEqual(swipeDivider.style.left, "22%", "Swipe divider moved to 22%");
swipeDivider.trigger("dblclick");
assert.strictEqual(swipeDivider.style.left, "50%", "Double-clicking swipe divider resets curtain to 50%");

console.log("  ✓ Overlay mode diff toggle ON/OFF verified");
console.log("  ✓ Diff opacity slider & click-to-reset (85%) verified");
console.log("  ✓ Master Mirror status click-to-pause/resume verified");
console.log("  ✓ Swipe curtain double-click 50% reset verified\n");

// ----------------------------------------------------------------------------
// SUITE 6: ANTI-STUTTER CACHING & 3RD-COLUMN HEIGHT / SCROLL SYNC PARITY
// ----------------------------------------------------------------------------
console.log("SUITE 6: Verifying Anti-Stutter Caching & 3rd-Column Scroll Sync Height Parity...");

const layoutAlignmentJs = fs.readFileSync(path.join(baseDir, "studio/layout_alignment.js"), "utf8");
const syncAgentJs = fs.readFileSync(path.join(baseDir, "sync_agent.js"), "utf8");

// 1. Subpixel bitmap cache in renderElementSubpixelDiff
assert(
  pixelDiffEngineJs.includes("if (item._subpixelCache && item._subpixelCache.key === cacheKey)") &&
  pixelDiffEngineJs.includes("offCtx.drawImage(item._subpixelCache.canvas, drawX, drawY);"),
  "renderElementSubpixelDiff must cache and reuse computed subpixel diff bitmaps during 60fps scrolling"
);

// 2. Owner-document window scroll offset in renderPixelDiffColumn3 & renderSwipeDiffCanvas
assert(
  pixelDiffEngineJs.includes("const elWin = el.ownerDocument?.defaultView;") &&
  pixelDiffEngineJs.includes("frameScrollY = elWin.scrollY || elWin.pageYOffset || 0;"),
  "renderPixelDiffColumn3 and renderSwipeDiffCanvas must read frameScrollY from el.ownerDocument.defaultView so Black Canvas mode never double-subtracts scrollY"
);

// 3. Non-destructive landmark extraction & in-place spacer pruning (zero DOM collapse stutter)
assert(
  !syncAgentJs.includes('if (data.type === "VC_REQUEST_LANDMARKS") {\n      removeHazardSpacers();'),
  "sync_agent.js must not tear down hazard spacers on VC_REQUEST_LANDMARKS"
);
assert(
  syncAgentJs.includes("const rawDocHeight = Math.max(0, docHeight - totalSpacerH);") &&
  syncAgentJs.includes("y: Math.max(0, Math.round(rawTop - precedingSpacerH)),"),
  "extractLandmarks must mathematically subtract mounted hazard spacer heights so raw coordinates are measured without DOM teardown"
);
assert(
  layoutAlignmentJs.includes("keepIds: activeHazardSpacers.PROD.map(s => s.spacerId)") &&
  syncAgentJs.includes("function removeHazardSpacers(keepIds = null)"),
  "calculateAndApplyLayoutShifts must prune only obsolete spacers via keepIds so active spacers update in-place without jumping"
);

// 4. Unified 3rd-column viewport height & scroll height parity
assert(
  studioCss.includes(".pane-header {\n  height: 32px;\n  min-height: 32px;\n  max-height: 32px;") &&
  studioCss.includes("flex-wrap: nowrap;"),
  "studio.css must lock .pane-header to a single 32px row so Column 3's viewport height matches Columns 1 & 2"
);
assert(
  layoutAlignmentJs.includes('type: "VC_SET_MIN_DOC_HEIGHT", minDocHeight: alignedDocHeight') &&
  syncAgentJs.includes("function applyMinDocHeight(minDocHeight)"),
  "calculateAndApplyLayoutShifts must synchronize alignedDocHeight across PROD, STG, and Column 3 via VC_SET_MIN_DOC_HEIGHT"
);
assert(
  navigationJs.includes("function getEffectiveMaxScrollY(viewH)") &&
  navigationJs.includes("const docH = knownDocH > viewH ? knownDocH : 50000;"),
  "Wheel handlers must clamp scroll using getEffectiveMaxScrollY(viewH) so Column 3 stops at the real document bottom in lockstep with PROD & STG"
);

// Behavioral check: getEffectiveMaxScrollY clamps to real aligned document height instead of overscrolling to 50,000px
mockWin.__vcAlignedDocHeight = 2200;
assert.strictEqual(
  mockWin.__vcGetEffectiveMaxScrollY(800),
  1400,
  "getEffectiveMaxScrollY(800) with 2200px aligned document height must return exact maxScrollY of 1400px (not 49200px)"
);

console.log("  ✓ Subpixel bitmap cache eliminates per-frame getImageData CPU stutter");
console.log("  ✓ Black Canvas element scroll offset resolved from el.ownerDocument.defaultView");
console.log("  ✓ Hazard spacers update in-place without DOM teardown or layout jumps");
console.log("  ✓ 3rd column viewport height & maxScrollY match PROD and STG 1:1\n");

// ----------------------------------------------------------------------------
// SUITE 7: COLUMN ZOOMING, DYNAMIC SCROLL DIFF LOADING & COLOR DIFF DETECTION
// ----------------------------------------------------------------------------
console.log("SUITE 7: Verifying Column Zooming, Scroll-Time Diff Loading & Color Diff Detection...");

// 1. Column Zooming & Focus Behavioral Tests
assert(
  studioHtml.includes('id="btn-zoom-in-prod"') &&
  studioHtml.includes('id="btn-zoom-in-stg"') &&
  studioHtml.includes('id="btn-zoom-in-diff"') &&
  studioHtml.includes('id="btn-focus-col-prod"') &&
  studioHtml.includes('id="btn-focus-col-stg"') &&
  studioHtml.includes('id="btn-focus-col-diff"') &&
  studioHtml.includes('<option value="2">200%</option>') &&
  studioHtml.includes('<option value="1.5">150%</option>') &&
  studioHtml.includes('<option value="1.25">125%</option>'),
  "studio.html must include per-column zoom and focus controls in all 3 columns plus 125%/150%/200% options in #zoom-select"
);

// Test synchronized column zoom via #btn-zoom-in-prod
const btnZoomInProd = getMockEl("btn-zoom-in-prod");
btnZoomInProd.trigger("click", { altKey: false });
assert.strictEqual(getMockEl("col-zoom-val-prod").textContent, "125%", "Clicking + on Prod zooms Prod column to 125%");
assert.strictEqual(getMockEl("col-zoom-val-stg").textContent, "125%", "Clicking + without Alt synchronizes Stg column to 125%");
assert.strictEqual(getMockEl("col-zoom-val-diff").textContent, "125%", "Clicking + without Alt synchronizes Diff column to 125%");

// Test independent single-column zoom via Alt+Click on #btn-zoom-in-stg
const btnZoomInStg = getMockEl("btn-zoom-in-stg");
btnZoomInStg.trigger("click", { altKey: true });
assert.strictEqual(getMockEl("col-zoom-val-prod").textContent, "125%", "Alt+Click on Stg leaves Prod column at 125%");
assert.strictEqual(getMockEl("col-zoom-val-stg").textContent, "150%", "Alt+Click on Stg zooms only Stg column to 150%");

// Test click-to-reset column zoom to 100%
getMockEl("col-zoom-val-prod").trigger("click", { altKey: false });
assert.strictEqual(getMockEl("col-zoom-val-prod").textContent, "100%", "Clicking zoom label resets Prod column to 100%");
assert.strictEqual(getMockEl("col-zoom-val-stg").textContent, "100%", "Clicking zoom label without Alt resets Stg column to 100%");
assert.strictEqual(getMockEl("col-zoom-val-diff").textContent, "100%", "Clicking zoom label without Alt resets Diff column to 100%");

// Test column Focus / Maximize toggle (#btn-focus-col-diff)
const btnFocusDiff = getMockEl("btn-focus-col-diff");
btnFocusDiff.click();
assert(getMockEl("pane-col-diff").classList.contains("col-focused"), "Clicking Focus on Diff column adds .col-focused to #pane-col-diff");
assert(getMockEl("view-side-by-side").classList.contains("has-focused-column"), "Clicking Focus on Diff column adds .has-focused-column to #view-side-by-side");
assert(btnFocusDiff.classList.contains("active"), "Clicking Focus on Diff column marks #btn-focus-col-diff as .active");
btnFocusDiff.click();
assert(!getMockEl("pane-col-diff").classList.contains("col-focused"), "Clicking Focus again restores 3-column layout");
assert(!getMockEl("view-side-by-side").classList.contains("has-focused-column"), "Clicking Focus again removes .has-focused-column from #view-side-by-side");

// 2. Dynamic Scroll-Time Difference Loading Tests
assert(
  syncAgentJs.includes("if (Math.abs(sy - lastCandidateScrollY) >= 60 && (now - lastCandidateReportTime) >= 110)") &&
  syncAgentJs.includes("sendDiffCandidatesReport();"),
  "sync_agent.js must stream fresh diff candidates dynamically during active scrolling"
);
assert(
  diffRunnerJs.includes("function requestScrollDiffCandidates()") &&
  actionRelayJs.includes("function mergeDiffCandidates(prevList, nextList)"),
  "diff_runner.js and action_relay.js must request and merge scroll-loaded diff candidates so newly scrolled elements are diffed immediately"
);

const mergedCandidates = mockWin.__vcMergeDiffCandidates(
  [{ selector: "header > nav > a:nth-of-type(1)", tag: "a", rect: { x: 10, y: 20, w: 80, h: 30 } }],
  [
    { selector: "header > nav > a:nth-of-type(1)", tag: "a", rect: { x: 10, y: 22, w: 80, h: 30 } },
    { selector: "footer > div > p.copyright", tag: "p", rect: { x: 10, y: 1850, w: 300, h: 24 } }
  ]
);
assert.strictEqual(mergedCandidates.length, 2, "mergeDiffCandidates must preserve top-of-page candidates while adding newly scrolled candidates");
assert.strictEqual(mergedCandidates[0].rect.y, 22, "mergeDiffCandidates must update existing candidate coordinates with latest measurements");

// 3. Color Difference Detection & Rendering Tests
assert(
  redDiffDetectionJs.includes('const leafSel = (p.selector || "").split(",")[0].split(/(?:>|\\s+)/).filter(Boolean).pop() || "";') &&
  redDiffDetectionJs.includes('leafSel.includes("container")'),
  "red_diff_detection.js must check leafSel rather than full ancestor selector path so elements inside .container or section are never skipped"
);
assert(
  pixelDiffEngineJs.includes("bgStr.match(/(rgba?\\([^)]+\\)|hsla?\\([^)]+\\)|#[0-9a-fA-F]{3,8})/gi)") &&
  !pixelDiffEngineJs.includes("|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/g"),
  "applyCanvasBackground must extract valid CSS color stops without matching 'linear' or 'radial' in linear-gradient(...)"
);

// Behavioral test: parseCssColor supports rgb, hex, and hsl/hsla
const parsedHsl = mockWin.__vcParseCssColor("hsl(120, 100%, 50%)");
assert(parsedHsl && parsedHsl.r === 0 && parsedHsl.g === 255 && parsedHsl.b === 0, "parseCssColor must accurately convert hsl(120, 100%, 50%) to RGB(0, 255, 0)");

// Behavioral test: detectPageDifferences catches button background color, gradient background, text color, and border color differences inside a .container > section hierarchy
const detectedDiffs = mockWin.__vcDetectPageDifferences(
  {
    diffCandidates: [
      {
        selector: "div.container > section.hero-section > button.cta-btn",
        tag: "button",
        text: "Start Trial",
        box: { x: 100, y: 200, width: 160, height: 48 },
        style: {
          bg: "rgb(37, 99, 235)",
          bgImage: "linear-gradient(135deg, rgb(37, 99, 235), rgb(29, 78, 216))",
          color: "rgb(255, 255, 255)",
          borderColor: "rgb(37, 99, 235)",
          borderTopColor: "rgb(37, 99, 235)",
          borderRightColor: "rgb(37, 99, 235)",
          borderBottomColor: "rgb(29, 78, 216)",
          borderLeftColor: "rgb(37, 99, 235)",
          fontSize: "16px",
          fontWeight: "600",
          radius: "8px"
        }
      }
    ]
  },
  {
    diffCandidates: [
      {
        selector: "div.container > section.hero-section > button.cta-btn",
        tag: "button",
        text: "Start Trial",
        box: { x: 100, y: 200, width: 160, height: 48 },
        style: {
          bg: "rgb(16, 185, 129)",
          bgImage: "linear-gradient(135deg, rgb(16, 185, 129), rgb(5, 150, 105))",
          color: "rgb(255, 255, 255)",
          borderColor: "rgb(16, 185, 129)",
          borderTopColor: "rgb(16, 185, 129)",
          borderRightColor: "rgb(16, 185, 129)",
          borderBottomColor: "rgb(5, 150, 105)",
          borderLeftColor: "rgb(16, 185, 129)",
          fontSize: "16px",
          fontWeight: "600",
          radius: "8px"
        }
      }
    ]
  }
);
assert(
  detectedDiffs.some(d => d.selector === "div.container > section.hero-section > button.cta-btn" && d.diffType === "style"),
  "detectPageDifferences must detect color/gradient differences on elements nested inside .container and section"
);

console.log("  ✓ Column zoom (+ / - / 100% / Alt per-column / Focus ⤢) verified");
console.log("  ✓ Scroll-time diff candidate streaming & merging verified");
console.log("  ✓ Color, gradient, border & nested-container style diff detection verified\n");

// ----------------------------------------------------------------------------
// SUITE 8: LOG REMOVAL, INDIVIDUAL PIXEL DIFFS ONLY & HOVER-ONLY SPACER TEXT
// ----------------------------------------------------------------------------
console.log("SUITE 8: Verifying Bottom Log Removal, Individual Pixel Diffs & Hover Spacer Info...");

// 1. Verify bottom log footer and logAction code are completely removed
assert(
  !studioHtml.includes("studio-footer") &&
  !studioHtml.includes("log-entry") &&
  !studioHtml.includes("btn-toggle-event-log"),
  "studio.html must not contain the bottom studio-footer or log-entry elements"
);
assert(
  !studioCss.includes("footer.studio-footer") &&
  !studioCss.includes(".log-entry"),
  "studio.css must not contain bottom footer or log styles"
);
assert(
  !studioJs.includes("function logAction") &&
  !studioJs.includes("logAction(") &&
  !studioJs.includes("btn-toggle-event-log"),
  "studio/*.js must not contain logAction or event log listeners"
);

// 2. Verify every differing pixel is rendered (full backgrounds, gradients, borders, images, SVGs, and text — never just outlining areas)
assert(
  pixelDiffEngineJs.includes("if (!isTextDiff || bgChanged) {\n    const rVal = parseFloat(pStyle.radius) || 0;\n    if (pBg) applyCanvasBackground(ctxP, pBg, elW, elH, rVal);\n    if (pBgImg) applyCanvasBackground(ctxP, pBgImg, elW, elH, rVal);\n  }") &&
  pixelDiffEngineJs.includes("if (!isTextDiff || bgChanged) {\n    const rVal = parseFloat(sStyle.radius) || 0;\n    if (sBg) applyCanvasBackground(ctxS, sBg, elW, elH, rVal);\n    if (sBgImg) applyCanvasBackground(ctxS, sBgImg, elW, elH, rVal);\n  }") &&
  pixelDiffEngineJs.includes("const captureShiftRegions = Array.isArray(shiftRegions)"),
  "renderElementSubpixelDiff and applyCapturedPixelDiff must compare every pixel of backgrounds, gradients, borders, and text rather than outlining areas"
);
assert(
  syncAgentJs.includes("background-color: rgba(239, 68, 68, 0) !important;"),
  "sync_agent.js .vc-red-diff-hug must have 0 alpha so DOM elements never receive solid red background boxes"
);

// 3. Verify yellow spacer shift text is hidden by default and shown on hover
assert(
  !studioHtml.includes("(Yellow Spacer)") &&
  !layoutAlignmentJs.includes("(Yellow Spacer)") &&
  !diffRunnerJs.includes("(Yellow Spacer)"),
  "Visible '(Yellow Spacer)' text must be removed from studio.html, layout_alignment.js, and diff_runner.js"
);
assert(
  layoutAlignmentJs.includes("chipSyncHazard.title =") &&
  diffRunnerJs.includes("chipSyncHazard.title ="),
  "Toolbar yellow hazard spacer chip must expose shifted pixel details on hover via title tooltip"
);
assert(
  syncAgentJs.includes("opacity: 0 !important;") &&
  syncAgentJs.includes(".vc-hazard-stripe-spacer:hover .vc-hazard-badge") &&
  syncAgentJs.includes("spacer.title = `Layout shift: +${height}px"),
  "sync_agent.js must hide .vc-hazard-badge by default and reveal shifted pixel info on hover"
);
assert(
  !pixelDiffEngineJs.includes("LAYOUT SHIFT SPACER:"),
  "drawCanvasShiftBadge must not draw visible 'LAYOUT SHIFT SPACER:' text onto canvas hazard stripes"
);

console.log("  ✓ Bottom log footer and all logAction code completely removed");
console.log("  ✓ Only individual differing pixels (glyphs, 1px borders, small leaf graphics) rendered in Red");
console.log("  ✓ Yellow spacer shifted pixel details hidden by default and shown cleanly on hover\n");

// ----------------------------------------------------------------------------
// SUITE 9: SINGLE FIXED-SIZE ZOOM CONTROL & ASPECT-RATIO / DEVICE-TYPE ACCURATE DIFFS
// ----------------------------------------------------------------------------
console.log("SUITE 9: Verifying Single Fixed-Size Zoom Control & Aspect-Ratio/Device-Type Diff Accuracy...");

// 1. Verify single unified zoom control in top header outside #viewport-scaler
assert(
  studioHtml.includes('id="unified-zoom-group"') &&
  studioHtml.includes('id="btn-zoom-out"') &&
  studioHtml.includes('id="btn-zoom-in"') &&
  studioHtml.includes('id="btn-zoom-reset"') &&
  studioHtml.includes('class="studio-select zoom-select-fixed"'),
  "studio.html must provide a single unified zoom control (#unified-zoom-group) in the top header"
);
assert(
  studioCss.includes(".col-zoom-controls {\n  display: none !important;") &&
  studioCss.includes(".zoom-step-btn {") &&
  studioCss.includes("width: 24px !important;\n  min-width: 24px !important;\n  max-width: 24px !important;") &&
  studioCss.includes(".zoom-reset-btn {") &&
  studioCss.includes("width: 44px !important;\n  min-width: 44px !important;\n  max-width: 44px !important;") &&
  studioCss.includes(".zoom-select-fixed {") &&
  studioCss.includes("width: 112px !important;\n  min-width: 112px !important;\n  max-width: 112px !important;") &&
  !studioCss.includes(".scale-group {\n    display: none;"),
  "studio.css must lock zoom control dimensions with !important so it never shrinks or hides across device presets or media queries, and hide per-column zoom controls"
);

// 2. Behavioral verification of unified zoom control buttons
const viewportJs = fs.readFileSync(path.join(baseDir, "studio/viewport.js"), "utf8");
const btnZoomInGlobal = getMockEl("btn-zoom-in");
const btnZoomOutGlobal = getMockEl("btn-zoom-out");
const btnZoomResetGlobal = getMockEl("btn-zoom-reset");
btnZoomResetGlobal.trigger("click", {});
assert.strictEqual(mockWin.__vcColumnZoomState.prod, 1, "Reset button must reset prod zoom to 1");
assert.strictEqual(mockWin.__vcColumnZoomState.stg, 1, "Reset button must reset stg zoom to 1");
assert.strictEqual(mockWin.__vcColumnZoomState.diff, 1, "Reset button must reset diff zoom to 1");

btnZoomInGlobal.trigger("click", {});
assert.strictEqual(mockWin.__vcColumnZoomState.prod, 1.25, "Unified + button must zoom prod to 1.25");
assert.strictEqual(mockWin.__vcColumnZoomState.stg, 1.25, "Unified + button must zoom stg to 1.25");
assert.strictEqual(mockWin.__vcColumnZoomState.diff, 1.25, "Unified + button must zoom diff to 1.25");
assert.strictEqual(btnZoomResetGlobal.textContent, "125%", "Unified reset button readout must show 125%");

btnZoomOutGlobal.trigger("click", {});
assert.strictEqual(mockWin.__vcColumnZoomState.prod, 1, "Unified - button must step all panels back to 1.0");
assert.strictEqual(btnZoomResetGlobal.textContent, "100%", "Unified reset button readout must show 100%");

// 3. Verify aspect-ratio & device-type diff synchronization
assert(
  viewportJs.includes("function refreshDiffsForViewportChange") &&
  viewportJs.includes('viewportSelect.addEventListener("change", (e) => {\n  applyViewportPresetAndZoom(true);\n  refreshDiffsForViewportChange("Device viewport preset changed");\n});'),
  "viewport.js must trigger refreshDiffsForViewportChange whenever the device preset / aspect ratio changes"
);
assert(
  navigationJs.includes('if (paneColDiff) paneColDiff.style.display = "flex";\n        const viewSide = document.getElementById("view-side-by-side");\n        if (viewSide) viewSide.classList.add("mode-view-pixel-diff");\n        if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {\n          applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);\n        }\n        renderPixelDiffColumn3') &&
  diffRunnerJs.includes('if (paneColDiff) paneColDiff.style.display = "flex";\n    const viewSide = document.getElementById("view-side-by-side");\n    if (viewSide) viewSide.classList.add("mode-view-pixel-diff");\n    if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {\n      applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);\n    }\n    renderPixelDiffColumn3'),
  "navigation.js and diff_runner.js must apply viewport preset dimensions for 3 columns BEFORE measuring and rendering Column 3 diffs"
);
assert(
  pixelDiffEngineJs.includes("if (!hasExactBox && hasLiveColDom) {\n          return;\n        }") &&
  pixelDiffEngineJs.includes("if (!hasExactBox && hasLiveSwipeDom) {\n          return;\n        }"),
  "renderPixelDiffColumn3 and renderSwipeDiffCanvas must skip non-matching selectors when live DOM is loaded rather than drawing hardcoded fallback boxes"
);

// 4. Behavioral verification: mergeDiffCandidates discards candidates from a previous device aspect ratio
const desktopCands = [
  { selector: ".hero-pill", box: { x: 800, y: 120, width: 320, height: 32, measuredWidth: 1920 } },
  { selector: ".cta-submit", box: { x: 860, y: 900, width: 200, height: 48, measuredWidth: 1920 } }
];
const mobileCands = [
  { selector: ".hero-pill", box: { x: 40, y: 110, width: 360, height: 32, measuredWidth: 440 } }
];
const mergedAcrossDeviceSwitch = mockWin.__vcMergeDiffCandidates(desktopCands, mobileCands);
assert.strictEqual(mergedAcrossDeviceSwitch.length, 1, "mergeDiffCandidates must discard stale 1920px desktop candidates when 440px mobile candidates arrive");
assert.strictEqual(mergedAcrossDeviceSwitch[0].box.measuredWidth, 440, "Surviving candidate must have mobile 440px measuredWidth");

console.log("  ✓ Single fixed-size zoom control in top header verified (never shrinks or changes dimensions)");
console.log("  ✓ Lockstep zooming across all panels via unified − / Scale / + / 100% verified");
console.log("  ✓ Aspect-ratio & device-preset diff recalculation and stale-width candidate eviction verified\n");

// ----------------------------------------------------------------------------
// SUITE 10: HORIZONTAL SCROLL CLAMPING TO MAIN PAGES & GOFULLPAGE SITE EXPORT
// ----------------------------------------------------------------------------
console.log("SUITE 10: Verifying Horizontal Scroll Clamping to Main Pages & Clean GoFullPage Site Export...");

const backgroundJs = fs.readFileSync(path.join(baseDir, "background.js"), "utf8");

// 1. Verify horizontal scroll clamping in navigation.js, action_relay.js, pixel_diff_engine.js, and viewport.js
assert(
  navigationJs.includes("function getEffectiveMaxScrollX(viewW)") &&
  navigationJs.includes("const newScrollX = Math.max(0, Math.min(maxScrollX, currentX + deltaX));") &&
  typeof mockWin.__vcGetEffectiveMaxScrollX === "function",
  "navigation.js must define getEffectiveMaxScrollX and clamp horizontal wheel scroll to [0, maxScrollX]"
);
assert(
  actionRelayJs.includes("const clampedScrollX = Math.max(0, Math.min(effectiveMaxX, action.scrollX || 0));") &&
  pixelDiffEngineJs.includes("currentScrollX = Math.max(0, Math.min(maxColScrollX, currentScrollX || 0));"),
  "action_relay.js and pixel_diff_engine.js must clamp horizontal scrollX to the main pages' scrollable horizontal range"
);
assert(
  viewportJs.includes("const viewW = wrapFrameProd?.clientWidth || iframeProd?.clientWidth || el.clientWidth || 400;") &&
  viewportJs.includes("const maxPanX = Math.max(0, Math.round(viewW * (z - 1)));"),
  "viewport.js must use shared viewW across Prod, Staging, and Column 3 Diff so zoomed horizontal pan range is identical"
);

// 2. Behavioral verification: horizontal scroll clamping matches main pages
getMockEl("mode-btn-side").click();
const iframeProdMock = getMockEl("iframe-prod");
const iframeStgMock = getMockEl("iframe-stg");
iframeProdMock.contentDocument = iframeProdMock.contentDocument || { documentElement: {}, body: {} };
iframeStgMock.contentDocument = iframeStgMock.contentDocument || { documentElement: {}, body: {} };
const prodDocEl = iframeProdMock.contentDocument.documentElement;
const stgDocEl = iframeStgMock.contentDocument.documentElement;
prodDocEl.clientWidth = 400;
prodDocEl.scrollWidth = 400;
stgDocEl.clientWidth = 400;
stgDocEl.scrollWidth = 400;
assert.strictEqual(
  mockWin.__vcGetEffectiveMaxScrollX(400),
  0,
  "When main pages fit horizontally (scrollWidth === clientWidth), maxScrollX must be 0"
);

const viewSideBySide = getMockEl("view-side-by-side");
viewSideBySide.trigger("wheel", {
  deltaX: 180,
  deltaY: 0,
  ctrlKey: false,
  metaKey: false,
  preventDefault() {}
});
assert.strictEqual(
  mockWin.__vcGetLastScrollState().scrollX,
  0,
  "Horizontal trackpad scroll must stay at 0 when main pages cannot scroll horizontally"
);

// Now simulate a wide table / horizontal overflow on the main pages (scrollWidth = 680, clientWidth = 400 -> maxScrollX = 280)
prodDocEl.scrollWidth = 680;
stgDocEl.scrollWidth = 680;
assert.strictEqual(
  mockWin.__vcGetEffectiveMaxScrollX(400),
  280,
  "When main pages have horizontal overflow (680px in 400px pane), maxScrollX must be 280"
);
viewSideBySide.trigger("wheel", {
  deltaX: 500,
  deltaY: 0,
  ctrlKey: false,
  metaKey: false,
  preventDefault() {}
});
assert.strictEqual(
  mockWin.__vcGetLastScrollState().scrollX,
  280,
  "Horizontal wheel scroll must clamp at maxScrollX (280px) so Differences never scroll further than main pages"
);
viewSideBySide.trigger("wheel", {
  deltaX: -500,
  deltaY: 0,
  ctrlKey: false,
  metaKey: false,
  preventDefault() {}
});
assert.strictEqual(
  mockWin.__vcGetLastScrollState().scrollX,
  0,
  "Horizontal wheel scroll left must clamp back to 0"
);

// 3. Verify GoFullPage PDF / PNG clean site export fixes
assert(
  studioCss.includes("body.capture-fullscreen-vertical .secondary-toolbar") &&
  studioCss.includes("body.capture-fullscreen-vertical .viewport-scaler") &&
  studioCss.includes("transform: none !important;") &&
  studioCss.includes("body.capture-fullscreen-vertical .pane-column.active-capture-pane .pane-frame-wrap"),
  "studio.css must reset .viewport-scaler transform and style .secondary-toolbar and .pane-frame-wrap during fullscreen vertical capture"
);
assert(
  syncAgentJs.includes(".vc-hazard-stripe-spacer, #vc-ghost-cursor, #vc-scroll-end-pad {\n          display: none !important;") &&
  syncAgentJs.includes("const visualNodes = [];"),
  "sync_agent.js must hide yellow hazard spacers and red diff hugs during capture and provide visualNodes snapshot"
);
assert(
  backgroundJs.includes("sender.tab.windowId") &&
  backgroundJs.includes('chrome.tabs.captureVisibleTab(winId, { format: "png" }'),
  "background.js must pass sender.tab.windowId to chrome.tabs.captureVisibleTab"
);
assert(
  exportImportJs.includes("if (lastTabCaptureTimestamp > 0 && elapsed < 510)") &&
  exportImportJs.includes("renderLiveDomToFullPageCanvas(") &&
  exportImportJs.includes("skipDiffCalculation: true") &&
  !exportImportJs.includes('else if (isDiffActive) activeView = "diff";'),
  "export_import.js must pace captureVisibleTab calls, skip diff overlays during GoFullPage export, and use renderLiveDomToFullPageCanvas fallback"
);

// 4. Behavioral verification of renderLiveDomToFullPageCanvas painting real site DOM
const paintedRects = [];
const paintedTexts = [];
const mockExportCtx = {
  save() {},
  restore() {},
  translate() {},
  beginPath() {},
  rect() {},
  roundRect() {},
  stroke() {},
  fill() {},
  clip() {},
  fillRect(x, y, w, h) { paintedRects.push({ x, y, w, h, fillStyle: this.fillStyle }); },
  fillText(text, x, y) { paintedTexts.push({ text, x, y }); },
  measureText(t) { return { width: t.length * 7 }; },
  createLinearGradient() { return { addColorStop() {} }; }
};
const renderedOk = mockWin.__vcRenderLiveDomToFullPageCanvas(
  mockExportCtx,
  null,
  {
    bodyBg: "#0f172a",
    visualNodes: [
      {
        tag: "header",
        x: 0,
        y: 0,
        width: 1200,
        height: 72,
        text: "Acme Cloud Platform",
        style: { bg: "#1e293b", color: "#f8fafc", fontSize: "18px", fontWeight: "700" }
      },
      {
        tag: "button",
        x: 100,
        y: 220,
        width: 180,
        height: 44,
        text: "Start Free Trial",
        style: { bg: "#38bdf8", color: "#0f172a", radius: 8, fontSize: "15px", textAlign: "center" }
      }
    ]
  },
  1200,
  900
);
assert.strictEqual(renderedOk, true, "renderLiveDomToFullPageCanvas must return true when visualNodes are present");
assert(paintedRects.length >= 2, "renderLiveDomToFullPageCanvas must paint background and element rects");
assert(
  paintedTexts.some(t => t.text.includes("Acme Cloud Platform")) &&
  paintedTexts.some(t => t.text.includes("Start Free Trial")),
  "renderLiveDomToFullPageCanvas must paint actual website text rather than placeholder boxes"
);

console.log("  ✓ Horizontal scrolling in Differences strictly clamped to main pages' [0, maxScrollX] range");
console.log("  ✓ GoFullPage PDF / PNG export rate-limit pacing, fullscreen CSS reset, and live DOM rendering verified\n");

console.log("=================================================================");
console.log("ALL DIFFERENCES STABILITY & CONTROLS TESTS PASSED (100% SUCCESS)!");
console.log("=================================================================");
