/**
 * VisualCompare Live - Studio: DOM references and shared state
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

// Query Elements
const prodUrlInput = document.getElementById("studio-prod-url");
const stgUrlInput = document.getElementById("studio-stg-url");
const btnNavigateAll = document.getElementById("btn-navigate-all");
const btnSwapUrls = document.getElementById("btn-swap-urls");
const btnReloadProd = document.getElementById("btn-reload-prod");
const btnReloadStg = document.getElementById("btn-reload-stg");
const btnProdPopout = document.getElementById("btn-prod-popout");
const btnStgPopout = document.getElementById("btn-stg-popout");

const viewportSelect = document.getElementById("viewport-select");
const zoomSelect = document.getElementById("zoom-select");
const viewportScaler = document.getElementById("viewport-scaler");
const syncStatusLabel = document.getElementById("sync-status-label");

// Sync Checkboxes & Layout Shift Spacers
const checkSyncHazard = document.getElementById("check-sync-hazard");
const chipSyncHazard = document.getElementById("chip-sync-hazard");
const checkSyncRedDiff = document.getElementById("check-sync-red-diff");
const chipSyncRedDiff = document.getElementById("chip-sync-red-diff");
const btnToggleRedDiffs = document.getElementById("btn-toggle-red-diffs");
const checkSyncClicks = document.getElementById("check-sync-clicks");
const checkSyncScroll = document.getElementById("check-sync-scroll");
const checkSyncHover = document.getElementById("check-sync-hover");
const checkSyncInputs = document.getElementById("check-sync-inputs");

// View Mode Elements
const modeBtns = document.querySelectorAll(".mode-btn");
const stageViews = document.querySelectorAll(".stage-view");
const flickerControls = document.getElementById("flicker-controls");
const overlayControls = document.getElementById("overlay-controls");
const metricDiffBadge = document.getElementById("metric-diff-badge");
const metricDiffPct = document.getElementById("metric-diff-pct");
const metricShiftBadge = document.getElementById("metric-shift-badge");
const metricShiftVal = document.getElementById("metric-shift-val");
const metricRedBadge = document.getElementById("metric-red-badge");
const metricRedVal = document.getElementById("metric-red-val");
const diffLegendPill = document.getElementById("diff-legend-pill");

// Iframes
const iframeProd = document.getElementById("iframe-prod");
const iframeStg = document.getElementById("iframe-stg");
const iframeSwipeProd = document.getElementById("iframe-swipe-prod");
const iframeSwipeStg = document.getElementById("iframe-swipe-stg");
const iframeSwipeDiff = document.getElementById("iframe-swipe-diff");
const iframeFlickerProd = document.getElementById("iframe-flicker-prod");
const iframeFlickerStg = document.getElementById("iframe-flicker-stg");
const iframeOverlayProd = document.getElementById("iframe-overlay-prod");
const iframeOverlayStg = document.getElementById("iframe-overlay-stg");
const viewFlicker = document.getElementById("view-flicker");
const flickerContainer = document.getElementById("flicker-container");
const viewOverlay = document.getElementById("view-overlay");
const overlayContainer = document.getElementById("overlay-container");

// Mode Specific & 3-Column Pixel Diff
const sideControls = document.getElementById("side-controls");
const btnToggleColDiff = document.getElementById("btn-toggle-col-diff");
const paneColProd = document.getElementById("pane-col-prod");
const paneColStg = document.getElementById("pane-col-stg");
const paneColDiff = document.getElementById("pane-col-diff");
const colDiffPct = document.getElementById("col-diff-pct");
const colDiffOpacitySlider = document.getElementById("col-diff-opacity-slider");
const colDiffOpacityVal = document.getElementById("col-diff-opacity-val");
const btnColDiffRefresh = document.getElementById("btn-col-diff-refresh");
const wrapFrameProd = document.getElementById("wrap-frame-prod");
const wrapFrameStg = document.getElementById("wrap-frame-stg");
const wrapFrameDiff = document.getElementById("wrap-frame-diff");
const pixelDiffViewport = document.getElementById("pixel-diff-viewport");
const iframeDiffBase = document.getElementById("iframe-diff-base");
const pixelDiffCanvas = document.getElementById("pixel-diff-canvas");
const btnColDiffBase = document.getElementById("btn-col-diff-base");
let isDiffBasePageVisible = false; // Default: black page with red spots for differing pixels

function updateDiffBaseVisibility(visible = isDiffBasePageVisible) {
  isDiffBasePageVisible = visible;
  if (btnColDiffBase) {
    if (!isDiffBasePageVisible) {
      btnColDiffBase.classList.add("active");
      btnColDiffBase.title = "Current: Black Canvas (Differing Pixels Only). Click to show underlaid page.";
      const iconSpan = btnColDiffBase.querySelector(".btn-diff-base-icon");
      const textSpan = btnColDiffBase.querySelector(".btn-diff-base-text");
      if (iconSpan) iconSpan.textContent = "⬛";
      if (textSpan) textSpan.textContent = "Black Canvas";
    } else {
      btnColDiffBase.classList.remove("active");
      btnColDiffBase.title = "Current: Underlaid Page visible. Click to show black canvas only.";
      const iconSpan = btnColDiffBase.querySelector(".btn-diff-base-icon");
      const textSpan = btnColDiffBase.querySelector(".btn-diff-base-text");
      if (iconSpan) iconSpan.textContent = "📄";
      if (textSpan) textSpan.textContent = "Show Page";
    }
  }
  if (pixelDiffViewport) {
    if (!isDiffBasePageVisible) {
      pixelDiffViewport.classList.add("black-page");
      pixelDiffViewport.style.backgroundColor = "#000000";
    } else {
      pixelDiffViewport.classList.remove("black-page");
      pixelDiffViewport.style.backgroundColor = "";
    }
  }
  if (iframeDiffBase) {
    iframeDiffBase.style.display = isDiffBasePageVisible ? "block" : "none";
  }
}

// Swipe Mode Controls
const swipeControls = document.getElementById("swipe-controls");
const btnSwipeTargetProd = document.getElementById("btn-swipe-target-prod");
const btnSwipeTargetDiff = document.getElementById("btn-swipe-target-diff");
const swipeDiffCanvas = document.getElementById("swipe-diff-canvas");
const swipeBaseTag = document.getElementById("swipe-base-tag");
const swipeOverlayTag = document.getElementById("swipe-overlay-tag");
let swipeCompareMode = "prod"; // "prod" (Prod <-> Stage) or "diff" (Stage <-> Diff)
let isColDiffActive = false;    // 3rd Column toggle state in Side-by-Side (defaults to 2-column view)

const swipeContainer = document.getElementById("swipe-container");
const swipeOverlayLayer = document.getElementById("swipe-overlay-layer");
const swipeDivider = document.getElementById("swipe-divider");
const swipeHandlePill = document.getElementById("swipe-handle-pill");
const swipeHandleLabel = document.getElementById("swipe-handle-label");
const btnFlickerPlay = document.getElementById("btn-flicker-play");
const flickerSpeedSelect = document.getElementById("flicker-speed");
const flickerLabel = document.getElementById("flicker-label");
const sliderOverlayOpacity = document.getElementById("slider-overlay-opacity");
const labelOpacityVal = document.getElementById("label-opacity-val");
const overlayGhostPane = document.getElementById("overlay-ghost-pane");
const overlayBlendSelect = document.getElementById("overlay-blend-mode");
const btnRunDiff = document.getElementById("btn-run-diff");
const diffCanvas = document.getElementById("diff-output-canvas");
const btnExportZip = document.getElementById("btn-export-zip");
const btnImportZip = document.getElementById("btn-import-zip");
const fileImportZip = document.getElementById("file-import-zip");
const importToast = document.getElementById("import-notification-toast");
const toastTitle = document.getElementById("toast-title");
const toastDesc = document.getElementById("toast-desc");
const btnCloseToast = document.getElementById("btn-close-toast");

// PDF Export & Enhancement Controls
const btnExportPdf = document.getElementById("btn-export-pdf");
const diffToleranceGroup = document.getElementById("diff-tolerance-group");
const diffToleranceSelect = document.getElementById("diff-tolerance-select");
const captureProgressOverlay = document.getElementById("capture-progress-overlay");
const captureProgressTitle = document.getElementById("capture-progress-title");
const captureProgressStatus = document.getElementById("capture-progress-status");
const captureProgressBar = document.getElementById("capture-progress-bar");
const pdfExportModal = document.getElementById("pdf-export-modal");
const btnClosePdfModal = document.getElementById("btn-close-pdf-modal");
const btnDownloadPdfMaster = document.getElementById("btn-download-pdf-master");
const btnDownloadPdfDiff = document.getElementById("btn-download-pdf-diff");
const btnDownloadPdfProd = document.getElementById("btn-download-pdf-prod");
const btnDownloadPdfStg = document.getElementById("btn-download-pdf-stg");
const btnDownloadAllZip = document.getElementById("btn-download-all-zip");
const btnExportPng = document.getElementById("btn-export-png");
const gofullpageViewerModal = document.getElementById("gofullpage-viewer-modal");
const gofullpageViewerTitle = document.getElementById("gofullpage-viewer-title");
const gofullpageViewerDims = document.getElementById("gofullpage-viewer-dims");
const btnGofullpageViewStg = document.getElementById("btn-gofullpage-view-stg");
const btnGofullpageViewProd = document.getElementById("btn-gofullpage-view-prod");
const btnGofullpageViewDiff = document.getElementById("btn-gofullpage-view-diff");
const btnGofullpageDlPdf = document.getElementById("btn-gofullpage-dl-pdf");
const btnGofullpageDlPng = document.getElementById("btn-gofullpage-dl-png");
const btnGofullpageClose = document.getElementById("btn-gofullpage-close");
const gofullpageBodyWrap = document.getElementById("gofullpage-body-wrap");
const gofullpagePreviewCanvas = document.getElementById("gofullpage-preview-canvas");
const shortcutsModal = document.getElementById("shortcuts-modal");
const btnCloseShortcutsModal = document.getElementById("btn-close-shortcuts-modal");
const btnShowShortcuts = document.getElementById("btn-show-shortcuts");
let currentDiffTolerance = 20;

// Current State
let currentMode = "side-by-side";
let flickerInterval = null;
let flickerShowingProd = true;
let isDraggingSwipe = false;
let lastProdLandmarks = null;
let lastStgLandmarks = null;
let colProdLandmarks = null;
let colStgLandmarks = null;
let swipeProdLandmarks = null;
let swipeStgLandmarks = null;
let colRedDiffs = [];
let swipeRedDiffs = [];
let hasAlignedCurrentPage = false;
let alignDebounceTimer = null;
let realignDebounceTimer = null;
let studioResizeTimer = null;
let activeHazardSpacers = {
  PROD: [],
  STG: []
};
let activeShiftRegions = [];
let activeRedDiffs = [];
let lastScrollState = { scrollX: 0, scrollY: 0, pctX: 0, pctY: 0 };
let activeScrollLeader = null;
let scrollLeaderTimer = null;
let lastCapturedScrollY = 0;
let lastCapturedScrollX = 0;
let lastAccuratePixelDiffPct = null;
if (typeof window !== "undefined") {
  window.__vcGetLastScrollState = () => lastScrollState;
}
