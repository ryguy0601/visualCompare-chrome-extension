/**
 * VisualCompare Live - Studio: URL-param init and iframe lifecycle
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

// ----------------------------------------------------
// 1. INITIALIZE FROM URL PARAMS
// ----------------------------------------------------
const params = new URLSearchParams(window.location.search);
const hasChromeRuntime = typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function";
const defaultProd = hasChromeRuntime ? chrome.runtime.getURL("demo/demo_prod.html") : "demo/demo_prod.html";
const defaultStg = hasChromeRuntime ? chrome.runtime.getURL("demo/demo_stg.html") : "demo/demo_stg.html";
const initialProd = params.get("prod") || defaultProd;
const initialStg = params.get("stg") || defaultStg;

prodUrlInput.value = initialProd;
stgUrlInput.value = initialStg;

if (params.get("device")) {
  viewportSelect.value = params.get("device");
} else if (viewportSelect) {
  viewportSelect.value = "1920x1080";
}
if (params.get("syncHazard") !== null) checkSyncHazard.checked = params.get("syncHazard") === "true";
if (params.get("syncRedDiff") !== null) {
  checkSyncRedDiff.checked = params.get("syncRedDiff") === "true";
} else {
  checkSyncRedDiff.checked = false;
}
if (params.get("syncClicks") !== null) checkSyncClicks.checked = params.get("syncClicks") === "true";
if (params.get("syncScroll") !== null) checkSyncScroll.checked = params.get("syncScroll") === "true";
if (params.get("syncHover") !== null) checkSyncHover.checked = params.get("syncHover") === "true";
if (params.get("syncInputs") !== null) checkSyncInputs.checked = params.get("syncInputs") === "true";

// (Startup calls that need functions from later files live in studio/main.js.)

// ----------------------------------------------------
// 2. FRAME LOADING & LIFECYCLE
// ----------------------------------------------------
function loadAllFrames(prodUrl, stgUrl) {
  if (!prodUrl && !stgUrl) return;

  prodUrl = normalizeUrl(prodUrl);
  stgUrl = normalizeUrl(stgUrl);

  hasAlignedCurrentPage = false;
  lastProdLandmarks = null;
  lastStgLandmarks = null;
  clearTimeout(alignDebounceTimer);
  clearAllHazardSpacers(false);

  // Update Side-by-Side
  if (iframeProd) iframeProd.src = prodUrl;
  if (iframeStg) iframeStg.src = stgUrl;
  if (iframeDiffBase) iframeDiffBase.src = stgUrl;

  // Update Swipe
  if (iframeSwipeProd) iframeSwipeProd.src = prodUrl;
  if (iframeSwipeStg) iframeSwipeStg.src = stgUrl;
  if (iframeSwipeDiff) iframeSwipeDiff.src = stgUrl;

  // Update Flicker
  if (iframeFlickerProd) iframeFlickerProd.src = prodUrl;
  if (iframeFlickerStg) iframeFlickerStg.src = stgUrl;

  // Update Overlay
  if (iframeOverlayProd) iframeOverlayProd.src = prodUrl;
  if (iframeOverlayStg) iframeOverlayStg.src = stgUrl;
}

// Frame Load Listeners to Handshake with Agent
function attachFrameHandshake(iframe, paneId) {
  iframe.addEventListener("load", () => {
    try {
      iframe.contentWindow.postMessage({ type: "VC_INIT_AGENT", paneId }, "*");
    } catch (e) {}
  });
}

attachFrameHandshake(iframeProd, "PROD");
attachFrameHandshake(iframeStg, "STG");
attachFrameHandshake(iframeDiffBase, "STG");
attachFrameHandshake(iframeSwipeProd, "PROD");
attachFrameHandshake(iframeSwipeStg, "STG");
attachFrameHandshake(iframeSwipeDiff, "STG");
attachFrameHandshake(iframeFlickerProd, "PROD");
attachFrameHandshake(iframeFlickerStg, "STG");
attachFrameHandshake(iframeOverlayProd, "PROD");
attachFrameHandshake(iframeOverlayStg, "STG");

let lastCaptureReadyProd = null;
let lastCaptureReadyStg = null;
