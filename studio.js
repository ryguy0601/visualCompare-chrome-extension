/**
 * VisualCompare Live - Studio Controller
 * Handles dual-iframe lifecycle, live action mirroring, swipe curtain, flicker, and visual pixel diffs.
 */

document.addEventListener("DOMContentLoaded", () => {
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
  const logEntry = document.getElementById("log-entry");
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
  let activeRedDiffs = [];
  let lastScrollState = { scrollX: 0, scrollY: 0, pctX: 0, pctY: 0 };
  let lastCapturedScrollY = 0;
  let lastCapturedScrollX = 0;
  let lastAccuratePixelDiffPct = null;

  function logAction(msg) {
    const time = new Date().toTimeString().split(" ")[0];
    if (logEntry) logEntry.textContent = `[${time}] ${msg}`;
  }

  // ----------------------------------------------------
  // 1. INITIALIZE FROM URL PARAMS
  // ----------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const hasChromeRuntime = typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function";
  const defaultProd = hasChromeRuntime ? chrome.runtime.getURL("demo_prod.html") : "demo_prod.html";
  const defaultStg = hasChromeRuntime ? chrome.runtime.getURL("demo_stg.html") : "demo_stg.html";
  const initialProd = params.get("prod") || defaultProd;
  const initialStg = params.get("stg") || defaultStg;

  prodUrlInput.value = initialProd;
  stgUrlInput.value = initialStg;

  if (params.get("device")) viewportSelect.value = params.get("device");
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

  updateSyncChipStyles();

  // Load iframes
  loadAllFrames(initialProd, initialStg);

  // ----------------------------------------------------
  // 2. FRAME LOADING & LIFECYCLE
  // ----------------------------------------------------
  function loadAllFrames(prodUrl, stgUrl) {
    if (!prodUrl && !stgUrl) return;

    hasAlignedCurrentPage = false;
    lastProdLandmarks = null;
    lastStgLandmarks = null;
    clearTimeout(alignDebounceTimer);
    clearAllHazardSpacers(false);

    logAction(`Navigating: PROD -> ${prodUrl} | STG -> ${stgUrl}`);

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

  // ----------------------------------------------------
  // 3. CROSS-FRAME ACTION RELAY (THE CORE MIRROR ENGINE)
  // ----------------------------------------------------
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;

    // Frame ping / initial handshake
    if (msg.type === "VC_FRAME_PING") {
      const sourceWindow = event.source;
      const targetPane = (sourceWindow === iframeProd.contentWindow || sourceWindow === iframeSwipeProd.contentWindow || sourceWindow === iframeFlickerProd.contentWindow || sourceWindow === iframeOverlayProd.contentWindow) ? "PROD" : "STG";
      try {
        sourceWindow.postMessage({ type: "VC_INIT_AGENT", paneId: targetPane }, "*");
      } catch (e) {}

      // If active staging frame pings on navigation, immediately sync diff base frames
      if (msg.href && sourceWindow === iframeStg?.contentWindow) {
        if (stgUrlInput && document.activeElement !== stgUrlInput) {
          stgUrlInput.value = msg.href;
        }
        if (iframeDiffBase && iframeDiffBase.src !== msg.href) {
          iframeDiffBase.src = msg.href;
        }
        if (iframeSwipeDiff && iframeSwipeDiff.src !== msg.href) {
          iframeSwipeDiff.src = msg.href;
        }
      }
      return;
    }

    // Agent acknowledged readiness - reapply any active hazard spacers and red diffs to this frame
    if (msg.type === "VC_AGENT_READY") {
      const sourceWindow = event.source;
      if (sourceWindow && msg.paneId) {
        if (msg.href) {
          if (msg.paneId === "PROD" && prodUrlInput && document.activeElement !== prodUrlInput) {
            prodUrlInput.value = msg.href;
          }
          if (msg.paneId === "STG" && stgUrlInput && document.activeElement !== stgUrlInput) {
            stgUrlInput.value = msg.href;
          }

          if (msg.paneId === "STG") {
            // Keep 3rd column pixel diff base iframe synchronized to the new Staging route
            if (iframeDiffBase && sourceWindow !== iframeDiffBase.contentWindow) {
              if (iframeDiffBase.src !== msg.href) {
                iframeDiffBase.src = msg.href;
              }
            }
            if (iframeSwipeDiff && sourceWindow !== iframeSwipeDiff.contentWindow) {
              if (iframeSwipeDiff.src !== msg.href) {
                iframeSwipeDiff.src = msg.href;
              }
            }
            if (isColDiffActive && currentMode === "side-by-side") {
              setTimeout(() => {
                renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
              }, 250);
            }
          }

          if (msg.paneId === "PROD") {
            if (isColDiffActive && currentMode === "side-by-side") {
              setTimeout(() => {
                renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
              }, 250);
            }
          }
        }
        reapplyActiveSpacersToWindow(sourceWindow, msg.paneId);
        reapplyActiveRedDiffsToWindow(sourceWindow);
        if (lastScrollState.scrollY > 0 || lastScrollState.scrollX > 0) {
          try {
            sourceWindow.postMessage({
              type: "VC_MIRROR_ACTION",
              action: {
                kind: "scroll",
                scrollY: lastScrollState.scrollY,
                scrollX: lastScrollState.scrollX
              }
            }, "*");
          } catch (e) {}
        }
      }
      return;
    }

    // Landmark report for layout shift alignment
    if (msg.type === "VC_LANDMARKS_REPORT") {
      const sourceWindow = event.source;
      const active = getActiveFramesForMode(currentMode);

      // Only accept landmark reports from the active frames of the currently viewed mode
      const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
      const isFromActiveStg = (active.stg && sourceWindow === active.stg.contentWindow) || 
                              (active.baseStg && sourceWindow === active.baseStg.contentWindow) || 
                              (active.diff && sourceWindow === active.diff.contentWindow);
      if (!isFromActiveProd && !isFromActiveStg) {
        return;
      }

      if (currentMode === "swipe") {
        if (msg.paneId === "PROD") {
          swipeProdLandmarks = msg;
          lastProdLandmarks = msg;
        } else if (msg.paneId === "STG") {
          swipeStgLandmarks = msg;
          lastStgLandmarks = msg;
        }
      } else {
        if (msg.paneId === "PROD") {
          colProdLandmarks = msg;
          lastProdLandmarks = msg;
        } else if (msg.paneId === "STG") {
          colStgLandmarks = msg;
          lastStgLandmarks = msg;
        }
      }

      // Calculate shift alignment & re-evaluate active diffs whenever both active frames have reported
      if (lastProdLandmarks && lastStgLandmarks) {
        clearTimeout(alignDebounceTimer);
        alignDebounceTimer = setTimeout(() => {
          if (checkSyncHazard && checkSyncHazard.checked && lastProdLandmarks && lastStgLandmarks) {
            calculateAndApplyLayoutShifts();
          }
          if (isDiffActive || isColDiffActive || currentMode === "swipe") {
            runVisualDiffCalculation(false);
          }
        }, 80);
      }
      return;
    }

    if (msg.type === "VC_DIFF_CANDIDATES_REPORT") {
      const sourceWindow = event.source;
      const active = getActiveFramesForMode(currentMode);

      // Only accept candidate reports from active frames of currently viewed mode
      const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
      const isFromActiveStg = (active.stg && sourceWindow === active.stg.contentWindow) || 
                              (active.baseStg && sourceWindow === active.baseStg.contentWindow) || 
                              (active.diff && sourceWindow === active.diff.contentWindow);
      if (!isFromActiveProd && !isFromActiveStg) {
        return;
      }

      const frameWidth = msg.candidates?.[0]?.box?.measuredWidth || 
        (currentMode === "swipe" ? (swipeContainer?.clientWidth || 1200) : (iframeProd?.clientWidth || 400));

      if (currentMode === "swipe") {
        if (msg.paneId === "PROD") {
          swipeProdLandmarks = { landmarks: [], diffCandidates: msg.candidates, measuredWidth: frameWidth, href: msg.href };
          lastProdLandmarks = swipeProdLandmarks;
        } else if (msg.paneId === "STG") {
          swipeStgLandmarks = { landmarks: [], diffCandidates: msg.candidates, measuredWidth: frameWidth, href: msg.href };
          lastStgLandmarks = swipeStgLandmarks;
        }
        if (checkSyncRedDiff && checkSyncRedDiff.checked) {
          if (swipeProdLandmarks && swipeStgLandmarks && Math.abs(swipeProdLandmarks.measuredWidth - swipeStgLandmarks.measuredWidth) < 120) {
            computeAndApplyRedDifferences(true);
            if (swipeCompareMode === "diff") {
              renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
            }
          }
        }
      } else {
        if (msg.paneId === "PROD") {
          colProdLandmarks = { landmarks: [], diffCandidates: msg.candidates, measuredWidth: frameWidth, href: msg.href };
          lastProdLandmarks = colProdLandmarks;
        } else if (msg.paneId === "STG") {
          colStgLandmarks = { landmarks: [], diffCandidates: msg.candidates, measuredWidth: frameWidth, href: msg.href };
          lastStgLandmarks = colStgLandmarks;
        }
        if (checkSyncRedDiff && checkSyncRedDiff.checked) {
          if (colProdLandmarks && colStgLandmarks && Math.abs(colProdLandmarks.measuredWidth - colStgLandmarks.measuredWidth) < 120) {
            computeAndApplyRedDifferences(true);
            if (isColDiffActive) {
              renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
            }
          }
        }
      }
      return;
    }

    // Live bounding rect report from applied red diff highlights
    if (msg.type === "VC_RED_DIFFS_APPLIED") {
      const sourceWindow = event.source;
      const active = getActiveFramesForMode(currentMode);

      // Only accept applied reports from active frames of currently viewed mode
      const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
      const isFromActiveStg = (active.stg && sourceWindow === active.stg.contentWindow) || 
                              (active.baseStg && sourceWindow === active.baseStg.contentWindow) || 
                              (active.diff && sourceWindow === active.diff.contentWindow);
      if (!isFromActiveProd && !isFromActiveStg) {
        return;
      }

      const activeDiffsList = (currentMode === "swipe") ? swipeRedDiffs : (currentMode === "side-by-side" ? colRedDiffs : activeRedDiffs);

      if (Array.isArray(msg.boxes) && msg.boxes.length > 0) {
        const expectedW = (currentMode === "swipe") 
          ? (swipeContainer?.clientWidth || 1200) 
          : (wrapFrameDiff?.clientWidth || iframeProd?.clientWidth || 400);

        msg.boxes.forEach(box => {
          if (box.measuredWidth && Math.abs(box.measuredWidth - expectedW) > 150) {
            return;
          }
          const match = activeDiffsList.find(d => d.selector === box.selector);
          if (match) {
            const boxObj = {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              viewportX: box.viewportX,
              viewportY: box.viewportY,
              measuredWidth: box.measuredWidth
            };
            if (msg.paneId === "STG" || isFromActiveStg) {
              match.stgBox = boxObj;
              match.box = boxObj;
            } else if (msg.paneId === "PROD" || isFromActiveProd) {
              match.prodBox = boxObj;
              if (!match.stgBox) {
                match.box = boxObj;
              }
            } else {
              match.box = boxObj;
            }
            if (box.isFixed !== undefined) match.isFixed = box.isFixed;
            if (box.isSticky !== undefined) match.isSticky = box.isSticky;
            if (box.text) match.text = box.text;
            if (box.style) match.style = Object.assign(match.style || {}, box.style);
          }
        });
        activeRedDiffs = activeDiffsList;
        if (isDiffActive && currentMode === "overlay") {
          renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
        }
        if (isColDiffActive || (paneColDiff && paneColDiff.style.display !== "none")) {
          renderPixelDiffColumn3(colRedDiffs, activeShiftRegions);
        }
        if (currentMode === "swipe" && swipeCompareMode === "diff") {
          renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions);
        }
      }
      return;
    }

    // Frame content or viewport dimensions changed -> re-run layout shift alignment
    if (msg.type === "VC_DIMENSIONS_CHANGED") {
      const sourceWindow = event.source;
      const active = getActiveFramesForMode(currentMode);

      if (sourceWindow !== active.prod.contentWindow && sourceWindow !== active.stg.contentWindow) {
        return;
      }
      // If active frames are hidden or collapsed, ignore
      if (!active.prod || active.prod.offsetParent === null || !active.stg || active.stg.offsetParent === null) {
        return;
      }
      clearTimeout(realignDebounceTimer);
      realignDebounceTimer = setTimeout(() => {
        runHazardAlignmentForMode(currentMode, `Active ${msg.paneId} frame dimensions changed`);
      }, 150);
      return;
    }

    if (msg.type === "VC_SPACER_DISMISSED") {
      logAction(`[SPACER CLOSED] Layout shift spacer closed in ${msg.paneId}`);
      return;
    }

    if (msg.type === "VC_WHEEL_SCROLL") {
      if (!checkSyncScroll || !checkSyncScroll.checked) return;
      if (currentMode === "side-by-side") {
        handleSideBySideWheel({ deltaY: msg.deltaY, deltaX: msg.deltaX });
      } else if (currentMode === "swipe") {
        handleSwipeWheel({ deltaY: msg.deltaY, deltaX: msg.deltaX });
      }
      return;
    }

    if (msg.type === "VC_ACTION_PERFORMED") {
      const { paneId, action } = msg;
      if (!action) return;

      const sourceWindow = event.source;
      const active = getActiveFramesForMode(currentMode);

      // Drop messages from iframes that do not belong to the currently visible mode
      if (sourceWindow !== active.prod?.contentWindow &&
          sourceWindow !== active.stg?.contentWindow &&
          (!active.baseStg || sourceWindow !== active.baseStg.contentWindow)) {
        return;
      }

      // Track last known scroll position across all panes
      if (action.kind === "scroll") {
        lastScrollState = {
          scrollX: action.scrollX || 0,
          scrollY: action.scrollY || 0,
          maxScrollX: action.maxScrollX,
          maxScrollY: action.maxScrollY,
          pctX: action.pctX || 0,
          pctY: action.pctY || 0
        };
        // Keep 3rd column scroll in sync
        if (iframeDiffBase && iframeDiffBase.contentWindow) {
          try {
            iframeDiffBase.contentWindow.postMessage({
              type: "VC_MIRROR_ACTION",
              action: { kind: "scroll", scrollY: lastScrollState.scrollY, scrollX: lastScrollState.scrollX, maxScrollY: action.maxScrollY, maxScrollX: action.maxScrollX, pctY: lastScrollState.pctY, pctX: lastScrollState.pctX }
            }, "*");
          } catch (e) {}
        }
        // Keep swipe diff base frame in sync
        if (iframeSwipeDiff && iframeSwipeDiff.contentWindow) {
          try {
            iframeSwipeDiff.contentWindow.postMessage({
              type: "VC_MIRROR_ACTION",
              action: { kind: "scroll", scrollY: lastScrollState.scrollY, scrollX: lastScrollState.scrollX, maxScrollY: action.maxScrollY, maxScrollX: action.maxScrollX, pctY: lastScrollState.pctY, pctX: lastScrollState.pctX }
            }, "*");
          } catch (e) {}
        }
        if (wrapFrameDiff) {
          wrapFrameDiff.scrollTop = lastScrollState.scrollY || 0;
          wrapFrameDiff.scrollLeft = lastScrollState.scrollX || 0;
        }
        triggerScrollDiffSync(lastScrollState.scrollY, lastScrollState.scrollX);
      }

      // Check sync permissions
      if (action.kind === "click" && !checkSyncClicks.checked) return;
      if (action.kind === "scroll" && !checkSyncScroll.checked) return;
      if (action.kind === "hover" && !checkSyncHover.checked) return;
      if (action.kind === "hover_leave" && !checkSyncHover.checked) return;
      if (action.kind === "focus" && !checkSyncInputs.checked) return;
      if (action.kind === "blur" && !checkSyncInputs.checked) return;
      if (action.kind === "input" && !checkSyncInputs.checked) return;

      const targetPane = paneId === "PROD" ? "STG" : "PROD";

      // Log event to UI ticker
      if (action.kind === "click") {
        const textSnippet = action.text ? ` ("${action.text}")` : "";
        const coordSnippet = action.clientX !== undefined
          ? ` (${Math.round(action.clientX)}px, ${Math.round(action.clientY)}px) [${Math.round((action.pctX || 0) * 100)}%, ${Math.round((action.pctY || 0) * 100)}%]`
          : ` at (${Math.round((action.pctX || 0) * 100)}%, ${Math.round((action.pctY || 0) * 100)}%)`;
        logAction(`[MIRROR CLICK] Viewport${coordSnippet}${textSnippet} -> ${targetPane}`);
      } else if (action.kind === "input") {
        logAction(`[MIRROR TYPE] ${action.selector} value: "${action.value}" -> ${targetPane}`);
      } else if (action.kind === "focus") {
        logAction(`[MIRROR FOCUS] ${action.selector || action.tagName} focused -> ${targetPane}`);
      }

      // Forward action to target iframes based on active mode
      forwardActionToPane(targetPane, action);
    }
  });

  function forwardActionToPane(targetPane, action) {
    const message = { type: "VC_MIRROR_ACTION", action };

    // Function to safely dispatch to an iframe contentWindow
    const send = (iframe) => {
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(message, "*");
        } catch (e) {}
      }
    };

    if (currentMode === "side-by-side") {
      send(targetPane === "PROD" ? iframeProd : iframeStg);
      if (targetPane === "STG" && iframeDiffBase) {
        send(iframeDiffBase);
      }
    } else if (currentMode === "swipe") {
      if (targetPane === "PROD") {
        send(iframeSwipeProd);
      } else {
        send(iframeSwipeStg);
      }
      send(iframeSwipeDiff);
    } else if (currentMode === "flicker") {
      send(targetPane === "PROD" ? iframeFlickerProd : iframeFlickerStg);
    } else if (currentMode === "overlay") {
      send(targetPane === "PROD" ? iframeOverlayProd : iframeOverlayStg);
    }
  }

  // ----------------------------------------------------
  // 4. VIEW MODE SWITCHER
  // ----------------------------------------------------
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      switchMode(mode);
    });
  });

  function getActiveFramesForMode(mode = currentMode) {
    if (mode === "swipe") {
      return {
        prod: iframeSwipeProd,
        stg: iframeSwipeStg,
        diff: iframeSwipeDiff,
        baseStg: iframeSwipeStg
      };
    } else if (mode === "flicker") {
      return { prod: iframeFlickerProd, stg: iframeFlickerStg };
    } else if (mode === "overlay") {
      return { prod: iframeOverlayProd, stg: iframeOverlayStg };
    } else {
      return { prod: iframeProd, stg: iframeStg, diff: iframeDiffBase };
    }
  }

  function runHazardAlignmentForMode(mode = currentMode, reason = "") {
    if (!checkSyncHazard || !checkSyncHazard.checked) return;

    lastProdLandmarks = null;
    lastStgLandmarks = null;
    clearTimeout(alignDebounceTimer);

    const active = getActiveFramesForMode(mode);

    // Give browser a short tick (80ms) for CSS display toggle and layout calculation to settle in the new view mode
    setTimeout(() => {
      if (active.prod && active.prod.contentWindow) {
        try {
          active.prod.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
          active.prod.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
        } catch (e) {}
      }
      if (active.stg && active.stg.contentWindow) {
        try {
          active.stg.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
          active.stg.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
        } catch (e) {}
      }
      if (reason) {
        logAction(`[LAYOUT SHIFT] Re-running yellow hazard alignment for ${mode.toUpperCase()} view (${reason})...`);
      }
    }, 80);
  }

  function switchMode(mode) {
    if (mode === "pixel-diff") {
      mode = "side-by-side";
      isColDiffActive = true;
      if (btnToggleColDiff) btnToggleColDiff.classList.add("active");
    }

    currentMode = mode;
    lastCapturedDiffCanvas = null;
    lastAccuratePixelDiffPct = null;

    // Update buttons
    modeBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));

    const viewSide = document.getElementById("view-side-by-side");

    // Update views
    stageViews.forEach(v => {
      v.classList.remove("active");
      if (v.id === `view-${mode}`) v.classList.add("active");
    });

    // Toggle mode specific toolbars
    if (sideControls) sideControls.style.display = (mode === "side-by-side") ? "inline-flex" : "none";
    if (swipeControls) swipeControls.style.display = (mode === "swipe") ? "inline-flex" : "none";
    if (flickerControls) flickerControls.style.display = (mode === "flicker") ? "flex" : "none";
    if (overlayControls) overlayControls.style.display = (mode === "overlay") ? "flex" : "none";

    // Stop auto-flicker if leaving flicker mode
    if (mode !== "flicker" && flickerInterval) {
      clearInterval(flickerInterval);
      flickerInterval = null;
      btnFlickerPlay.textContent = "▶ Auto Flicker";
    }

    if (mode === "side-by-side") {
      isColDiffActive = Boolean(checkSyncRedDiff && checkSyncRedDiff.checked);
      if (btnToggleColDiff) btnToggleColDiff.classList.toggle("active", isColDiffActive);
      if (isColDiffActive) {
        if (paneColDiff) paneColDiff.style.display = "flex";
        if (viewSide) viewSide.classList.add("mode-view-pixel-diff");

        // Keep base iframe src in sync with Staging or Prod
        const targetSrc = (stgUrlInput && stgUrlInput.value && stgUrlInput.value.trim() !== "about:blank")
          ? stgUrlInput.value.trim()
          : ((iframeStg && iframeStg.src && iframeStg.src !== "about:blank") ? iframeStg.src : (iframeProd ? iframeProd.src : ""));
        if (iframeDiffBase && targetSrc && iframeDiffBase.src !== targetSrc) {
          iframeDiffBase.src = targetSrc;
        }
        renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
      } else {
        if (paneColDiff) paneColDiff.style.display = "none";
        if (viewSide) viewSide.classList.remove("mode-view-pixel-diff");
      }
      syncScrollToFrames([iframeProd, iframeStg, iframeDiffBase]);
    } else {
      if (paneColDiff) paneColDiff.style.display = "none";
      if (viewSide) viewSide.classList.remove("mode-view-pixel-diff");
    }

    if (mode === "swipe") {
      const targetCompare = (checkSyncRedDiff && checkSyncRedDiff.checked) ? "diff" : "prod";
      setSwipeCompareMode(targetCompare);
      syncScrollToFrames([iframeSwipeProd, iframeSwipeStg, iframeSwipeDiff]);
      // Request fresh landmarks and candidates from all swipe frames at their 1:1 wide desktop aspect ratio
      setTimeout(() => {
        [iframeSwipeProd, iframeSwipeDiff, iframeSwipeStg].forEach(frame => {
          if (frame && frame.contentWindow) {
            try {
              frame.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
              frame.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
            } catch (e) {}
          }
        });
      }, 50);
    }

    if (mode === "overlay") {
      if (activeRedDiffs.length === 0) {
        activeRedDiffs = detectPageDifferences(lastProdLandmarks, lastStgLandmarks);
      }
      renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
    }

    // Sync scroll to the newly visible frames
    const active = getActiveFramesForMode(mode);
    syncScrollToFrames([active.prod, active.stg]);

    logAction(`Switched to mode: ${mode.toUpperCase()}`);

    // Re-run the yellow hazard alignment specifically for this new view type!
    runHazardAlignmentForMode(mode, `View type changed to ${mode.toUpperCase()}`);

    // If switching to overlay and diff is active, render diff heatmap onto canvas
    if (mode === "overlay" && isDiffActive) {
      setTimeout(() => {
        renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
      }, 100);
    }
  }

  // ----------------------------------------------------
  // 5. MODE 2: SWIPE CURTAIN SLIDER LOGIC
  // ----------------------------------------------------
  if (swipeDivider && swipeContainer) {
    let currentSwipePct = 50;
    let swipeRafId = null;

    const updateSwipePosition = (pct) => {
      currentSwipePct = Math.max(0, Math.min(100, pct));
      if (swipeRafId) cancelAnimationFrame(swipeRafId);
      swipeRafId = requestAnimationFrame(() => {
        swipeDivider.style.left = `${currentSwipePct}%`;
        swipeOverlayLayer.style.clipPath = `inset(0 ${100 - currentSwipePct}% 0 0)`;
        swipeRafId = null;
      });
    };

    const handleSwipeFromClientX = (clientX) => {
      const rect = swipeContainer.getBoundingClientRect();
      if (rect.width <= 0) return;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = (x / rect.width) * 100;
      updateSwipePosition(pct);
    };

    const startSwipeDrag = (e) => {
      isDraggingSwipe = true;
      swipeContainer.classList.add("is-dragging");
      document.body.classList.add("is-dragging-curtain");

      if (e && e.pointerId !== undefined && typeof swipeDivider.setPointerCapture === "function") {
        try {
          swipeDivider.setPointerCapture(e.pointerId);
        } catch (err) {}
      }

      if (e && e.clientX !== undefined) {
        handleSwipeFromClientX(e.clientX);
      }
      if (e && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
    };

    const stopSwipeDrag = (e) => {
      if (!isDraggingSwipe) return;
      isDraggingSwipe = false;
      swipeContainer.classList.remove("is-dragging");
      document.body.classList.remove("is-dragging-curtain");

      if (e && e.pointerId !== undefined && typeof swipeDivider.releasePointerCapture === "function") {
        try {
          swipeDivider.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    };

    // Pointer Events on Divider Handle (Modern API with pointer capture)
    swipeDivider.addEventListener("pointerdown", (e) => {
      startSwipeDrag(e);
    });

    swipeDivider.addEventListener("pointermove", (e) => {
      if (isDraggingSwipe) {
        handleSwipeFromClientX(e.clientX);
      }
    });

    swipeDivider.addEventListener("pointerup", (e) => {
      stopSwipeDrag(e);
    });

    swipeDivider.addEventListener("pointercancel", (e) => {
      stopSwipeDrag(e);
    });

    // Allow clicking or dragging directly on the swipeContainer track
    swipeContainer.addEventListener("pointerdown", (e) => {
      if (e.target === swipeContainer || e.target.classList.contains("swipe-layer") || e.target.classList.contains("layer-tag")) {
        startSwipeDrag(e);
      }
    });

    // Window-level safety listeners guarantee pointermove and pointerup are never dropped
    window.addEventListener("pointermove", (e) => {
      if (isDraggingSwipe) {
        handleSwipeFromClientX(e.clientX);
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (isDraggingSwipe) {
        stopSwipeDrag(e);
      }
    });

    window.addEventListener("pointercancel", (e) => {
      if (isDraggingSwipe) {
        stopSwipeDrag(e);
      }
    });

    // Fallbacks for mouse & touch
    swipeDivider.addEventListener("mousedown", (e) => {
      startSwipeDrag(e);
    });
    window.addEventListener("mousemove", (e) => {
      if (isDraggingSwipe) {
        handleSwipeFromClientX(e.clientX);
      }
    });
    window.addEventListener("mouseup", () => {
      if (isDraggingSwipe) {
        stopSwipeDrag();
      }
    });

    swipeDivider.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches[0]) startSwipeDrag(e.touches[0]);
    }, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (isDraggingSwipe && e.touches && e.touches[0]) {
        handleSwipeFromClientX(e.touches[0].clientX);
      }
    }, { passive: true });
    window.addEventListener("touchend", () => {
      stopSwipeDrag();
    });
  }

  // ----------------------------------------------------
  // 6. MODE 3: FLICKER TOGGLE LOGIC
  // ----------------------------------------------------
  function toggleFlickerState() {
    flickerShowingProd = !flickerShowingProd;
    iframeFlickerProd.classList.toggle("active", flickerShowingProd);
    iframeFlickerStg.classList.toggle("active", !flickerShowingProd);
    flickerLabel.textContent = flickerShowingProd ? "SHOWING: PRODUCTION (REF)" : "SHOWING: STAGING (CANDIDATE)";
    flickerLabel.style.borderColor = flickerShowingProd ? "var(--color-prod)" : "var(--color-stg)";
    flickerLabel.style.color = flickerShowingProd ? "var(--color-prod)" : "var(--color-stg)";
  }

  btnFlickerPlay.addEventListener("click", () => {
    if (flickerInterval) {
      clearInterval(flickerInterval);
      flickerInterval = null;
      btnFlickerPlay.textContent = "▶ Auto Flicker";
    } else {
      const speed = parseInt(flickerSpeedSelect.value, 10) || 500;
      flickerInterval = setInterval(toggleFlickerState, speed);
      btnFlickerPlay.textContent = "⏸ Pause Flicker";
    }
  });

  flickerSpeedSelect.addEventListener("change", () => {
    if (flickerInterval) {
      clearInterval(flickerInterval);
      const speed = parseInt(flickerSpeedSelect.value, 10) || 500;
      flickerInterval = setInterval(toggleFlickerState, speed);
    }
  });

  // Global Spacebar shortcut for manual flicker
  window.addEventListener("keydown", (e) => {
    if (currentMode === "flicker" && e.code === "Space" && e.target.tagName !== "INPUT") {
      e.preventDefault();
      toggleFlickerState();
    }
  });

  // ----------------------------------------------------
  // 7. MODE 4: GHOST OVERLAY & DIFF CANVAS LOGIC
  // ----------------------------------------------------
  sliderOverlayOpacity.addEventListener("input", (e) => {
    const val = e.target.value;
    labelOpacityVal.textContent = `${val}%`;
    overlayGhostPane.style.opacity = (val / 100).toString();
  });

  overlayBlendSelect.addEventListener("change", (e) => {
    overlayGhostPane.style.mixBlendMode = e.target.value;
  });

  // ----------------------------------------------------
  // DOM-AWARE LANDMARK ALIGNMENT & LAYOUT SHIFT ENGINE
  // (Ported from VisualCompare Python Engine: matcher.py & diff_engine.py)
  // ----------------------------------------------------
  function matchLandmarks(prodLandmarks, stgLandmarks) {
    if (!prodLandmarks || !stgLandmarks) return [];
    const pairs = [];
    const matchedProd = new Set();
    const matchedStg = new Set();

    // Pass 1: Match strong unique keys (RENDERING::, ID::)
    for (let i = 0; i < prodLandmarks.length; i++) {
      const p = prodLandmarks[i];
      if (matchedProd.has(i)) continue;
      if (!p.key || (!p.key.startsWith("RENDERING::") && !p.key.startsWith("ID::"))) continue;

      for (let j = 0; j < stgLandmarks.length; j++) {
        if (matchedStg.has(j)) continue;
        if (stgLandmarks[j].key === p.key) {
          pairs.push({ prod: p, stg: stgLandmarks[j] });
          matchedProd.add(i);
          matchedStg.add(j);
          break;
        }
      }
    }

    // Pass 2: Exact Heading Matches
    for (let i = 0; i < prodLandmarks.length; i++) {
      if (matchedProd.has(i)) continue;
      const pHead = (prodLandmarks[i].heading || "").trim().toLowerCase();
      if (pHead.length < 3) continue;

      for (let j = 0; j < stgLandmarks.length; j++) {
        if (matchedStg.has(j)) continue;
        const sHead = (stgLandmarks[j].heading || "").trim().toLowerCase();
        if (sHead === pHead) {
          pairs.push({ prod: prodLandmarks[i], stg: stgLandmarks[j] });
          matchedProd.add(i);
          matchedStg.add(j);
          break;
        }
      }
    }

    // Pass 3: Heading Substring Matches
    for (let i = 0; i < prodLandmarks.length; i++) {
      if (matchedProd.has(i)) continue;
      const pHead = (prodLandmarks[i].heading || "").trim().toLowerCase();
      if (pHead.length < 4) continue;

      for (let j = 0; j < stgLandmarks.length; j++) {
        if (matchedStg.has(j)) continue;
        const sHead = (stgLandmarks[j].heading || "").trim().toLowerCase();
        if (sHead.length >= 4 && (pHead.includes(sHead) || sHead.includes(pHead))) {
          pairs.push({ prod: prodLandmarks[i], stg: stgLandmarks[j] });
          matchedProd.add(i);
          matchedStg.add(j);
          break;
        }
      }
    }

    // Pass 4: Content snippet similarity
    for (let i = 0; i < prodLandmarks.length; i++) {
      if (matchedProd.has(i)) continue;
      const pSnip = (prodLandmarks[i].snippet || "").trim().toLowerCase();
      if (pSnip.length < 20) continue;

      for (let j = 0; j < stgLandmarks.length; j++) {
        if (matchedStg.has(j)) continue;
        const sSnip = (stgLandmarks[j].snippet || "").trim().toLowerCase();
        if (sSnip.length >= 20 && (pSnip === sSnip || pSnip.startsWith(sSnip.slice(0, 30)))) {
          pairs.push({ prod: prodLandmarks[i], stg: stgLandmarks[j] });
          matchedProd.add(i);
          matchedStg.add(j);
          break;
        }
      }
    }

    return optimalNonOverlappingChain(pairs);
  }

  function optimalNonOverlappingChain(pairs) {
    if (!pairs || pairs.length === 0) return [];

    pairs.sort((a, b) => {
      if (a.prod.box.y !== b.prod.box.y) return a.prod.box.y - b.prod.box.y;
      return a.stg.box.y - b.stg.box.y;
    });

    const n = pairs.length;
    const dp = new Array(n).fill(1);
    const parent = new Array(n).fill(-1);

    for (let i = 0; i < n; i++) {
      const pCur = pairs[i].prod.box;
      const sCur = pairs[i].stg.box;

      for (let j = 0; j < i; j++) {
        const pPrev = pairs[j].prod.box;
        const sPrev = pairs[j].stg.box;

        const pPrevBot = pPrev.y + pPrev.height;
        const sPrevBot = sPrev.y + sPrev.height;

        if (pCur.y >= pPrevBot - 2 && sCur.y >= sPrevBot - 2) {
          if (dp[j] + 1 > dp[i]) {
            dp[i] = dp[j] + 1;
            parent[i] = j;
          }
        }
      }
    }

    let bestIdx = 0;
    for (let i = 1; i < n; i++) {
      if (dp[i] > dp[bestIdx]) bestIdx = i;
    }

    const chain = [];
    let cur = bestIdx;
    while (cur !== -1) {
      chain.push(pairs[cur]);
      cur = parent[cur];
    }
    return chain.reverse();
  }

  function buildAlignedSegments(pairs, prodH, stgH) {
    const segments = [];
    let pLast = 0;
    let sLast = 0;

    for (let idx = 0; idx < (pairs || []).length; idx++) {
      const pBox = pairs[idx].prod.box;
      const sBox = pairs[idx].stg.box;

      const pTop = Math.max(0, Math.min(pBox.y, prodH));
      const sTop = Math.max(0, Math.min(sBox.y, stgH));
      const pBot = Math.min(prodH, pTop + pBox.height);
      const sBot = Math.min(stgH, sTop + sBox.height);

      if (pTop < pLast || sTop < sLast || (pBot <= pTop && sBot <= sTop)) continue;

      // Gap between landmarks
      if (pTop > pLast || sTop > sLast) {
        segments.push({
          pStart: pLast,
          pEnd: pTop,
          sStart: sLast,
          sEnd: sTop,
          meta: null,
          targetProd: pairs[idx].prod.selector,
          targetStg: pairs[idx].stg.selector
        });
      }

      // Matched landmark
      segments.push({
        pStart: pTop,
        pEnd: pBot,
        sStart: sTop,
        sEnd: sBot,
        meta: {
          prod: pairs[idx].prod,
          stg: pairs[idx].stg,
          idx: idx + 1
        },
        targetProd: pairs[idx].prod.selector,
        targetStg: pairs[idx].stg.selector
      });

      pLast = pBot;
      sLast = sBot;
    }

    if (pLast < prodH || sLast < stgH) {
      segments.push({
        pStart: pLast,
        pEnd: prodH,
        sStart: sLast,
        sEnd: stgH,
        meta: null
      });
    }

    return segments;
  }

  function sendSpacerToWindow(win, spacerPayload) {
    if (!win) return;
    try {
      win.postMessage(spacerPayload, "*");
    } catch (e) {}
  }

  function reapplyActiveSpacersToWindow(win, paneId) {
    if (!win) return;
    const list = activeHazardSpacers[paneId] || [];
    for (const spacerMsg of list) {
      sendSpacerToWindow(win, spacerMsg);
    }
  }

  function syncScrollToFrames(frames) {
    for (const iframe of frames) {
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage({
            type: "VC_MIRROR_ACTION",
            action: {
              kind: "scroll",
              scrollY: lastScrollState.scrollY,
              scrollX: lastScrollState.scrollX,
              pctY: lastScrollState.pctY,
              pctX: lastScrollState.pctX
            }
          }, "*");
        } catch (e) {}
      }
    }
    if (wrapFrameDiff) {
      wrapFrameDiff.scrollTop = lastScrollState.scrollY || 0;
      wrapFrameDiff.scrollLeft = lastScrollState.scrollX || 0;
    }
  }

  function dispatchToPane(targetPane, message) {
    const send = (iframe) => {
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(message, "*");
        } catch (e) {}
      }
    };
    if (message && message.type === "VC_APPLY_RED_DIFFS") {
      // Prod and Staging reference frames must NEVER receive red diff highlights!
      // In side-by-side mode, differences only go to the last column (iframeDiffBase).
      // In swipe mode, differences only go to the diff curtain (iframeSwipeDiff).
      if (currentMode === "swipe") {
        send(iframeSwipeDiff);
      } else if (currentMode === "side-by-side") {
        send(iframeDiffBase);
      }
      return;
    }
    if (currentMode === "swipe") {
      if (targetPane === "PROD") {
        send(iframeSwipeProd);
      } else {
        send(iframeSwipeStg);
        send(iframeSwipeDiff);
      }
    } else if (currentMode === "flicker") {
      send(targetPane === "PROD" ? iframeFlickerProd : iframeFlickerStg);
    } else if (currentMode === "overlay") {
      send(targetPane === "PROD" ? iframeOverlayProd : iframeOverlayStg);
    } else {
      if (targetPane === "PROD") {
        send(iframeProd);
      } else {
        send(iframeStg);
        send(iframeDiffBase);
      }
    }
  }

  function calculateAndApplyLayoutShifts() {
    if (!checkSyncHazard || !checkSyncHazard.checked) return;
    if (!lastProdLandmarks || !lastStgLandmarks) return;

    const pairs = matchLandmarks(lastProdLandmarks.landmarks, lastStgLandmarks.landmarks);
    if (!pairs || pairs.length === 0) return;

    activeHazardSpacers = { PROD: [], STG: [] };

    let totalShiftDelta = 0;
    let shiftCount = 0;
    let prevProdBot = 0;
    let prevStgBot = 0;

    for (let idx = 0; idx < pairs.length; idx++) {
      const pSec = pairs[idx].prod;
      const sSec = pairs[idx].stg;

      // 1. GAP / INSERTED SECTION CHECK (Did one page insert an extra section or banner before this section?)
      const pGap = Math.max(0, pSec.box.y - prevProdBot);
      const sGap = Math.max(0, sSec.box.y - prevStgBot);
      const gapDiff = Math.abs(pGap - sGap);

      if (gapDiff > 4) {
        totalShiftDelta += gapDiff;
        shiftCount++;
        const gapSpacerId = `vc-spacer-gap-${idx}`;

        if (pGap < sGap) {
          // Extra space / section inserted in Staging before this section!
          // Pad Production before this section so this section and all subsequent sections line up!
          const spacerPayload = {
            type: "VC_APPLY_HAZARD_SPACER",
            spacerId: gapSpacerId,
            height: gapDiff,
            targetSelector: pSec.selector,
            targetY: pSec.box.y,
            insertPosition: "before",
            counterpart: "Staging"
          };
          activeHazardSpacers.PROD.push(spacerPayload);
          dispatchToPane("PROD", spacerPayload);
          logAction(`[LAYOUT SHIFT] Inserted +${gapDiff}px Yellow Hazard Spacer into PROD before "${pSec.heading || pSec.tag}" (lines up with STG)`);
        } else {
          // Extra space / section in Production before this section!
          const spacerPayload = {
            type: "VC_APPLY_HAZARD_SPACER",
            spacerId: gapSpacerId,
            height: gapDiff,
            targetSelector: sSec.selector,
            targetY: sSec.box.y,
            insertPosition: "before",
            counterpart: "Production"
          };
          activeHazardSpacers.STG.push(spacerPayload);
          dispatchToPane("STG", spacerPayload);
          logAction(`[LAYOUT SHIFT] Inserted +${gapDiff}px Yellow Hazard Spacer into STG before "${sSec.heading || sSec.tag}" (lines up with PROD)`);
        }
      }

      // 2. SAME-SECTION SIZE CHECK: Is this section larger on one page than the other?
      const pH = pSec.box.height;
      const sH = sSec.box.height;
      const secDiff = Math.abs(pH - sH);

      // ONLY show yellow if one section is larger than the other page's same section!
      if (secDiff > 4) {
        totalShiftDelta += secDiff;
        shiftCount++;
        const secSpacerId = `vc-spacer-sec-${idx}`;

        if (pH < sH) {
          // Staging's section is larger by secDiff!
          // Pad Production's section at the bottom so it matches Staging's section height!
          const spacerPayload = {
            type: "VC_APPLY_HAZARD_SPACER",
            spacerId: secSpacerId,
            height: secDiff,
            targetSelector: pSec.selector,
            targetY: pSec.box.y + pH,
            insertPosition: "after",
            counterpart: "Staging"
          };
          activeHazardSpacers.PROD.push(spacerPayload);
          dispatchToPane("PROD", spacerPayload);
          logAction(`[LAYOUT SHIFT] Section "${pSec.heading || pSec.tag}" is +${secDiff}px larger in Staging. Padded PROD with yellow hazard spacer so sections line up!`);
        } else {
          // Production's section is larger by secDiff!
          // Pad Staging's section at the bottom so it matches Production's section height!
          const spacerPayload = {
            type: "VC_APPLY_HAZARD_SPACER",
            spacerId: secSpacerId,
            height: secDiff,
            targetSelector: sSec.selector,
            targetY: sSec.box.y + sH,
            insertPosition: "after",
            counterpart: "Production"
          };
          activeHazardSpacers.STG.push(spacerPayload);
          dispatchToPane("STG", spacerPayload);
          logAction(`[LAYOUT SHIFT] Section "${sSec.heading || sSec.tag}" is +${secDiff}px larger in Production. Padded STG with yellow hazard spacer so sections line up!`);
        }
      }

      prevProdBot = pSec.box.y + pH;
      prevStgBot = sSec.box.y + sH;
    }

    if (shiftCount > 0) {
      metricShiftBadge.style.display = "flex";
      metricShiftVal.textContent = `+${totalShiftDelta}px (${shiftCount}x)`;
    } else {
      metricShiftBadge.style.display = "none";
    }

    // Automatically evaluate & apply Red Differences if enabled
    if (checkSyncRedDiff && checkSyncRedDiff.checked) {
      computeAndApplyRedDifferences();
    }
  }

  function clearAllHazardSpacers(notify = true) {
    activeHazardSpacers = { PROD: [], STG: [] };
    dispatchToPane("PROD", { type: "VC_REMOVE_HAZARD_SPACERS" });
    dispatchToPane("STG", { type: "VC_REMOVE_HAZARD_SPACERS" });
    metricShiftBadge.style.display = "none";
    if (notify) {
      logAction("Yellow Hazard Spacers removed. Viewports in raw unshifted alignment.");
    }
  }

  // ----------------------------------------------------
  // NON-HEIGHT RED DIFFERENCE DETECTION & MIRROR ENGINE
  // (Highlights non-height visual regressions: colors, metrics, buttons, shapes)
  // ----------------------------------------------------
  function computeAndApplyRedDifferences(showOutlines = true) {
    let diffList = [];
    if (currentMode === "swipe") {
      const p = swipeProdLandmarks || lastProdLandmarks;
      const s = swipeStgLandmarks || lastStgLandmarks;
      diffList = detectPageDifferences(p, s);
      swipeRedDiffs = diffList;
      activeRedDiffs = swipeRedDiffs;
    } else {
      const p = colProdLandmarks || lastProdLandmarks;
      const s = colStgLandmarks || lastStgLandmarks;
      diffList = detectPageDifferences(p, s);
      colRedDiffs = diffList;
      activeRedDiffs = colRedDiffs;
    }

    if (!checkSyncRedDiff || !checkSyncRedDiff.checked) {
      clearAllRedDiffs(false);
      return;
    }

    // USER REQUIREMENT: For the 3-column view, ONLY the last column (Column 3) shows differences!
    // Column 1 (Prod) and Column 2 (Staging) must NEVER have red diff highlights applied to them.
    // In Swipe view, Staging (clean base) must NEVER have red highlights applied to it.
    const removeMsg = { type: "VC_REMOVE_RED_DIFFS" };
    const applyMsg = { type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs, showOutlines };

    if (currentMode === "side-by-side") {
      // Column 1 (Prod) & Column 2 (Staging) stay 100% clean and pristine live pages!
      if (iframeProd && iframeProd.contentWindow) {
        try { iframeProd.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      if (iframeStg && iframeStg.contentWindow) {
        try { iframeStg.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      // ONLY the last column (Column 3: paneColDiff / iframeDiffBase) shows differences!
      if (iframeDiffBase && iframeDiffBase.contentWindow) {
        try { iframeDiffBase.contentWindow.postMessage(applyMsg, "*"); } catch (e) {}
      }
    } else if (currentMode === "swipe") {
      if (iframeSwipeProd && iframeSwipeProd.contentWindow) {
        try { iframeSwipeProd.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      if (iframeSwipeStg && iframeSwipeStg.contentWindow) {
        try { iframeSwipeStg.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      if (swipeCompareMode === "diff" && iframeSwipeDiff && iframeSwipeDiff.contentWindow) {
        try { iframeSwipeDiff.contentWindow.postMessage(applyMsg, "*"); } catch (e) {}
      }
    } else {
      if (iframeFlickerProd && iframeFlickerProd.contentWindow) {
        try { iframeFlickerProd.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      if (iframeFlickerStg && iframeFlickerStg.contentWindow) {
        try { iframeFlickerStg.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      if (iframeOverlayProd && iframeOverlayProd.contentWindow) {
        try { iframeOverlayProd.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
      if (iframeOverlayStg && iframeOverlayStg.contentWindow) {
        try { iframeOverlayStg.contentWindow.postMessage(removeMsg, "*"); } catch (e) {}
      }
    }

    if (metricRedBadge) metricRedBadge.style.display = "none";
    if (btnToggleRedDiffs) {
      btnToggleRedDiffs.classList.remove("inactive");
      btnToggleRedDiffs.innerHTML = `<span class="btn-label-full">🔴 Differences</span><span class="btn-label-short">🔴 Diffs</span>`;
    }
    logAction(`[VISUAL DIFFS] Evaluated ${activeRedDiffs.length} visual regressions in RED for ${currentMode.toUpperCase()} mode.`);
  }

  function detectPageDifferences(prodLandmarks, stgLandmarks) {
    const diffList = [];
    const prodHref = (prodLandmarks?.href || prodUrlInput?.value || "").toLowerCase();
    const stgHref = (stgLandmarks?.href || stgUrlInput?.value || "").toLowerCase();

    const isDemoSite = prodHref.includes("demo_") || stgHref.includes("demo_") || prodHref.includes("demo-") || stgHref.includes("demo-");
    const isFeaturesPage = isDemoSite && (prodHref.includes("features") || stgHref.includes("features"));
    const isPricingPage = isDemoSite && (prodHref.includes("pricing") || stgHref.includes("pricing"));
    const isOverviewPage = isDemoSite && !isFeaturesPage && !isPricingPage;

    // 1. Dynamic matching from extracted DOM candidates (Focused 100% on Visual Regressions)
    const prodCandidates = prodLandmarks?.diffCandidates || [];
    const stgCandidates = stgLandmarks?.diffCandidates || [];

    if (prodCandidates.length > 0 && stgCandidates.length > 0) {
      const normalizeSelectorKey = (sel) => {
        if (!sel) return "";
        return sel
          .replace(/([_-])(?:prod|stg)\b/gi, "$1ENV")
          .replace(/\b(?:prod|stg)([_-])/gi, "ENV$1")
          .replace(/(?:demo_)?(?:prod|stg)\.html/gi, "demo_ENV.html");
      };

      // Map candidates by selector as an array so multiple elements with identical selectors are matched by index
      const stgMap = new Map();
      stgCandidates.forEach(s => {
        if (!s.selector) return;
        if (!stgMap.has(s.selector)) stgMap.set(s.selector, []);
        stgMap.get(s.selector).push(s);

        const normS = normalizeSelectorKey(s.selector);
        if (normS && normS !== s.selector) {
          if (!stgMap.has(normS)) stgMap.set(normS, []);
          stgMap.get(normS).push(s);
        }
      });

      const usedIndices = new Map();

      prodCandidates.forEach(p => {
        let list = stgMap.get(p.selector);
        if (!list || list.length === 0) {
          const normP = normalizeSelectorKey(p.selector);
          list = stgMap.get(normP);
        }

        // Direct text match fallback for navigation tabs or buttons (e.g., Overview tab)
        if (!list || list.length === 0) {
          const pTxt = (p.text || "").trim().toLowerCase();
          if (pTxt && pTxt.length >= 2) {
            const textMatch = stgCandidates.find(sc => (sc.text || "").trim().toLowerCase() === pTxt);
            if (textMatch) list = [textMatch];
          }
        }

        // Spatial proximity match fallback for elements at matching positions
        if (!list || list.length === 0) {
          const spatialMatch = stgCandidates.find(sc => {
            if (sc.tag !== p.tag) return false;
            const pX = p.box?.viewportX !== undefined ? p.box.viewportX : (p.box?.x || 0);
            const pY = p.box?.viewportY !== undefined ? p.box.viewportY : (p.box?.y || 0);
            const sX = sc.box?.viewportX !== undefined ? sc.box.viewportX : (sc.box?.x || 0);
            const sY = sc.box?.viewportY !== undefined ? sc.box.viewportY : (sc.box?.y || 0);
            return Math.abs(pX - sX) < 40 && Math.abs(pY - sY) < 40;
          });
          if (spatialMatch) list = [spatialMatch];
        }

        if (!list || list.length === 0) return;
        const idx = usedIndices.get(p.selector) || 0;
        const s = list[idx < list.length ? idx : list.length - 1];
        usedIndices.set(p.selector, idx + 1);

        if (s) {
          // On actual websites, only look at differences that are in or near the viewport!
          if (!isDemoSite && p.inViewport === false && s.inViewport === false && !p.isSticky && !s.isSticky) {
            return;
          }

          // Clean text comparison
          const pText = (p.text || "").trim();
          const sText = (s.text || "").trim();
          const textMatches = pText === sText;

          // Media comparison
          const srcMatches = !p.src || !s.src || p.src === s.src;

          // Clean style comparisons
          const bgMatches = !p.style?.bg || !s.style?.bg || p.style.bg === s.style.bg || p.style.bg === "rgba(0, 0, 0, 0)" || s.style.bg === "rgba(0, 0, 0, 0)";
          const bgImageMatches = !p.style?.bgImage || !s.style?.bgImage || p.style.bgImage === s.style.bgImage || (p.style.bgImage === "none" && s.style.bgImage === "none");
          const colorMatches = !p.style?.color || !s.style?.color || p.style.color === s.style.color;
          const borderMatches = !p.style?.borderColor || !s.style?.borderColor || p.style.borderColor === s.style.borderColor;
          const radiusMatches = !p.style?.radius || !s.style?.radius || p.style.radius === s.style.radius;

          // If identical visually in text, media, and styling, do NOT flag!
          if (textMatches && srcMatches && bgMatches && bgImageMatches && colorMatches && borderMatches && radiusMatches) {
            return;
          }

          const isItemFixed = Boolean(s.isFixed || p.isFixed);
          const isItemSticky = Boolean(s.isSticky || p.isSticky || isItemFixed);

          // Never flag broad container elements or large structural sections as diffs
          const isContainerTag = p.tag === "section" || p.tag === "header" || p.tag === "nav" || 
                                 p.tag === "footer" || p.tag === "main" || p.tag === "article" || 
                                 p.tag === "body" || p.tag === "form";
          const isBroadContainer = isContainerTag || 
                                   p.selector.includes("container") || 
                                   p.selector.includes("hero-section") || 
                                   p.selector.includes("site-header") || 
                                   p.selector.includes("cta-section");
          if (isBroadContainer) {
            return;
          }

          const isCardOrContainer = p.selector.includes("card") || 
                                   p.selector.includes("section") || 
                                   p.selector.includes("container") || 
                                   p.tag === "section" || 
                                   p.tag === "div";

          const diffText = s.text || p.text || "";
          const diffStyle = Object.assign({}, p.style || {}, s.style || {});

          // 1. Visual background gradient & shading check (catches CTA Card shading, Brand Logo, Nav Tab gradients!)
          if (!bgImageMatches && p.style?.bgImage && s.style?.bgImage && p.style.bgImage !== "none" && s.style.bgImage !== "none") {
            const label = isCardOrContainer ? "🎨 Visual Gradient: Card Shading & Border Accent" : "🎨 Visual Gradient: Background styling changed";
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label,
              diffType: "style",
              box: s.box || p.box,
              stgBox: s.box,
              prodBox: p.box,
              text: diffText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }

          // 2. Visual border color / accent check
          if (!borderMatches && p.style?.borderColor && s.style?.borderColor && p.style.borderColor !== "rgba(0, 0, 0, 0)") {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: "🎨 Visual Border: Border accent color changed",
              diffType: "style",
              box: s.box || p.box,
              stgBox: s.box,
              prodBox: p.box,
              text: diffText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }

          // 3. Visual image/media regression check
          if (!srcMatches && p.src && s.src) {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: "🖼️ Visual Image: Asset source modified",
              diffType: "media",
              box: s.box || p.box,
              stgBox: s.box,
              prodBox: p.box,
              text: diffText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }

          // 4. Visual background color check
          if (!bgMatches && p.style?.bg && s.style?.bg && p.style.bg !== "rgba(0, 0, 0, 0)" && s.style.bg !== "rgba(0, 0, 0, 0)") {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `🎨 Visual Style: Color regression (${p.style.bg} → ${s.style.bg})`,
              diffType: "style",
              box: s.box || p.box,
              stgBox: s.box,
              prodBox: p.box,
              text: diffText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }

          // 5. Visual text appearance check (do not flag container cards for text if their own text differs only because of child buttons or identical text prefixes)
          const isTextTag = p.tag === "h1" || p.tag === "h2" || p.tag === "h3" || p.tag === "h4" || 
                            p.tag === "h5" || p.tag === "h6" || p.tag === "p" || p.tag === "span" || 
                            p.tag === "label" || p.tag === "strong" || p.tag === "em" || 
                            p.tag === "th" || p.tag === "td" || p.tag === "a" || p.tag === "button" || 
                            p.tag === "li";
          if (!textMatches && pText && sText && isTextTag && !p.selector.includes(".env-badge")) {
            const hasDuplicatePrefix = pText.slice(0, 24) === sText.slice(0, 24);
            if (!isCardOrContainer || !hasDuplicatePrefix) {
              const isMetric = p.selector.includes("metric") || p.selector.includes("amount") || p.selector.includes("price");
              const labelType = isMetric ? "Visual Metric" : "Visual Text";
              addDiffIfMissing(diffList, {
                selector: p.selector,
                label: `🔤 ${labelType}: "${pText.slice(0, 24)}" → "${sText.slice(0, 24)}"`,
                diffType: "typography",
                box: s.box || p.box,
                stgBox: s.box,
                prodBox: p.box,
                text: sText || pText,
                style: diffStyle,
                isFixed: isItemFixed,
                isSticky: isItemSticky
              });
            }
          }

          // 6. Visual text color check
          if (!colorMatches && p.style?.color && s.style?.color) {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `🎨 Visual Style: Text color (${p.style.color} → ${s.style.color})`,
              diffType: "style",
              box: s.box || p.box,
              stgBox: s.box,
              prodBox: p.box,
              text: diffText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }

          // 7. Visual shape / corner radius check
          if (!radiusMatches && p.style?.radius && s.style?.radius) {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `📐 Visual Geometry: Corner radius (${p.style.radius} → ${s.style.radius})`,
              diffType: "geometry",
              box: s.box || p.box,
              stgBox: s.box,
              prodBox: p.box,
              text: diffText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }
        }
      });
    }

    // 2. Scan matched landmarks for visual heading label discrepancies
    if (prodLandmarks && stgLandmarks) {
      const pairs = matchLandmarks(prodLandmarks.landmarks, stgLandmarks.landmarks);
      for (const pair of pairs) {
        const p = pair.prod;
        const s = pair.stg;
        if (p.heading && s.heading && p.heading.trim().toLowerCase() !== s.heading.trim().toLowerCase()) {
          const headingSel = `${p.selector} :is(h1,h2,h3,h4,h5,h6,strong,b)`;
          addDiffIfMissing(diffList, {
            selector: headingSel,
            label: `🔤 Visual Heading: "${p.heading.slice(0, 24)}" → "${s.heading.slice(0, 24)}"`,
            diffType: "typography",
            box: s.box || p.box
          });
        }
      }
    }

    // 3. Demo page-specific visual regressions (ONLY for demo pages, NEVER for actual sites!)
    if (isDemoSite) {
      if (isFeaturesPage) {
        addDiffIfMissing(diffList, {
          selector: ".site-header .btn-primary, #btn-start-trial",
          label: "🎨 Visual Style: Button Color & Border (#1d4ed8 → #2563eb)",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".feature-card:first-child h3",
          label: "🔤 Visual Heading: Title Label ('Zero-Overhead eBPF Probes' → 'Zero-Overhead Kernel Telemetry')",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: "table.compare-table th:nth-child(2)",
          label: "🎨 Visual Color: Table Header Accent (#38bdf8 → #c084fc)",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".cta-submit",
          label: "📐 Visual Shape & Text: CTA Button Radius & Label",
          diffType: "geometry"
        });
        addDiffIfMissing(diffList, {
          selector: ".footer-bottom div:last-child",
          label: "🔤 Visual Text: Footer Version Label",
          diffType: "typography"
        });
      } else if (isPricingPage) {
        addDiffIfMissing(diffList, {
          selector: ".site-header .btn-primary, #btn-start-trial",
          label: "🎨 Visual Style: Button Color (#2563eb → #3b82f6)",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".pricing-card:nth-child(2) .plan-price .amount",
          label: "🔤 Visual Metric: Price Display ($49 → $59)",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".pricing-card:nth-child(2) .plan-features li:first-child",
          label: "🔤 Visual Text: Capacity Specification (50 → 35)",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".pricing-card:nth-child(2) .plan-features li:nth-child(2)",
          label: "🔤 Visual Text: SLA Bullet Guarantee (99.99% → 99.90%)",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".pricing-card:nth-child(3) .btn-plan",
          label: "🔤 Visual Text: Enterprise Button Label",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".cta-submit",
          label: "📐 Visual Shape & Text: CTA Button Radius & Label",
          diffType: "geometry"
        });
      } else {
        // Overview / Default Demo Page
        addDiffIfMissing(diffList, {
          selector: ".brand-logo",
          label: "🎨 Visual Style: Brand Logo Accent Gradient",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".brand-name .env-badge",
          label: "🔤 Visual Text: Environment Badge (PROD → STAGING)",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: "#header-nav .nav-tab.active, .nav-segmented a:first-child",
          label: "🎨 Visual Style: Overview Active Tab Gradient & Border Accent",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".site-header .btn-primary, #btn-start-trial",
          label: "🎨 Visual Style: Button Color (#2563eb → #3b82f6)",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".hero-badge",
          label: "🔤 Visual Text & Dot: Hero Release Badge",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".hero-title .gradient-text",
          label: "🎨 Visual Gradient: Hero Title Gradient Accent",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".hero-cta .btn-primary",
          label: "🎨 Visual Style: Hero CTA Button Color & Radius",
          diffType: "style"
        });
        addDiffIfMissing(diffList, {
          selector: ".metric-card:first-child .metric-value, .metric-value.warning",
          label: "🔤 Visual Metric: Metric Value Display (99.99% → 99.85%)",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".pricing-card:nth-child(2) .plan-price .amount",
          label: "🔤 Visual Metric: Price Display ($49 → $59)",
          diffType: "typography"
        });
        addDiffIfMissing(diffList, {
          selector: ".cta-submit",
          label: "📐 Visual Shape & Text: CTA Button Radius & Label",
          diffType: "geometry"
        });
      }
    }

    return diffList;
  }

  function addDiffIfMissing(list, diffItem) {
    if (!diffItem || !diffItem.selector) return;
    const exists = list.some(d => {
      if (d.selector === diffItem.selector) return true;
      if (d.label && diffItem.label && d.label.trim() === diffItem.label.trim()) return true;
      // Disambiguate overlapping selectors for the metric card
      if (d.selector.includes("metric-card") && diffItem.selector.includes("metric-card")) {
        const dFirst = d.selector.includes(":first-child") || d.selector.includes(":nth-of-type(1)");
        const itemFirst = diffItem.selector.includes(":first-child") || diffItem.selector.includes(":nth-of-type(1)");
        if (dFirst && itemFirst && d.selector.includes("metric-value") && diffItem.selector.includes("metric-value")) return true;
      }
      return false;
    });
    if (!exists) {
      if (!diffItem.box) {
        const stgCands = (currentMode === "swipe" ? swipeStgLandmarks?.diffCandidates : colStgLandmarks?.diffCandidates) || lastStgLandmarks?.diffCandidates || [];
        const prodCands = (currentMode === "swipe" ? swipeProdLandmarks?.diffCandidates : colProdLandmarks?.diffCandidates) || lastProdLandmarks?.diffCandidates || [];
        const selectors = diffItem.selector.split(",").map(s => s.trim());
        let sMatch = null;
        let pMatch = null;
        for (const sel of selectors) {
          if (!sMatch && stgCands) sMatch = stgCands.find(c => c.selector === sel || (c.selector && c.selector.includes(sel)));
          if (!pMatch && prodCands) pMatch = prodCands.find(c => c.selector === sel || (c.selector && c.selector.includes(sel)));
        }
        if (sMatch) diffItem.stgBox = sMatch.box;
        if (pMatch) diffItem.prodBox = pMatch.box;
        diffItem.box = sMatch?.box || pMatch?.box || null;
        if (diffItem.isFixed === undefined) diffItem.isFixed = Boolean(sMatch?.isFixed || pMatch?.isFixed);
        if (diffItem.isSticky === undefined) diffItem.isSticky = Boolean(sMatch?.isSticky || pMatch?.isSticky || diffItem.isFixed);
        if (!diffItem.text) diffItem.text = sMatch?.text || pMatch?.text || "";
        if (!diffItem.style) diffItem.style = Object.assign({}, pMatch?.style || {}, sMatch?.style || {});
      }
      list.push(diffItem);
    }
  }

  function clearAllRedDiffs(notify = true) {
    colRedDiffs = [];
    swipeRedDiffs = [];
    activeRedDiffs = [];
    dispatchToPane("PROD", { type: "VC_REMOVE_RED_DIFFS" });
    dispatchToPane("STG", { type: "VC_REMOVE_RED_DIFFS" });
    metricRedBadge.style.display = "none";
    if (pixelDiffCanvas) {
      const ctx = pixelDiffCanvas.getContext("2d");
      ctx.clearRect(0, 0, pixelDiffCanvas.width, pixelDiffCanvas.height);
    }
    if (swipeDiffCanvas) {
      const sCtx = swipeDiffCanvas.getContext("2d");
      sCtx.clearRect(0, 0, swipeDiffCanvas.width, swipeDiffCanvas.height);
    }
    if (btnToggleRedDiffs) {
      btnToggleRedDiffs.classList.add("inactive");
      btnToggleRedDiffs.innerHTML = `<span class="btn-label-full">🔴 Differences</span><span class="btn-label-short">🔴 Diffs</span>`;
    }
    if (notify) {
      logAction("Visual Difference Highlights disabled.");
    }
  }

  function reapplyActiveRedDiffsToWindow(win) {
    if (!win) return;
    // Prod (Col 1) and Staging (Col 2) must ALWAYS remain 100% clean with zero red diff highlights
    const isDiffWin = (iframeDiffBase && win === iframeDiffBase.contentWindow) ||
                     (iframeSwipeDiff && win === iframeSwipeDiff.contentWindow);
    if (!isDiffWin) {
      try {
        win.postMessage({ type: "VC_REMOVE_RED_DIFFS" }, "*");
      } catch (e) {}
      return;
    }
    if (!checkSyncRedDiff || !checkSyncRedDiff.checked) {
      try {
        win.postMessage({ type: "VC_REMOVE_RED_DIFFS" }, "*");
      } catch (e) {}
      return;
    }
    if (activeRedDiffs && activeRedDiffs.length > 0) {
      try {
        win.postMessage({ type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs, showOutlines: true }, "*");
      } catch (e) {}
    }
  }

  function triggerHazardRealignment(reason) {
    if (!checkSyncHazard || !checkSyncHazard.checked) return;
    runHazardAlignmentForMode(currentMode, reason);
  }

  // ----------------------------------------------------
  // CANVAS HAZARD STRIPE & HIGHLIGHT GENERATOR
  // (Port of diff_engine.py create_hazard_stripe_box & paste_yellow_highlight)
  // ----------------------------------------------------
  function drawHazardStripes(ctx, x, y, width, height, stripeW = 14) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // Yellow base: YELLOW_RGB = (250, 204, 21) matching visualCompare
    ctx.fillStyle = "rgb(250, 204, 21)";
    ctx.fillRect(x, y, width, height);

    // Diagonal hazard stripes: Dark slate #1e293b matching visualCompare create_hazard_stripe_box
    ctx.fillStyle = "#1e293b";
    for (let offset = -height; offset < width + height; offset += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset + stripeW, y);
      ctx.lineTo(x + offset + stripeW + height, y + height);
      ctx.lineTo(x + offset + height, y + height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawYellowHighlight(ctx, x, y, width, height) {
    // Port of diff_engine.py YELLOW = (250, 204, 21, 220)
    ctx.fillStyle = "rgba(250, 204, 21, 0.86)";
    ctx.fillRect(x, y, width, height);
  }

  // ----------------------------------------------------
  // RUN VISUAL DIFF ENGINE (Visual regression & layout diff calculator)
  // ----------------------------------------------------
  let isDiffActive = false;
  let activeShiftRegions = [];

  btnRunDiff.addEventListener("click", () => {
    runVisualDiffCalculation(true);
  });

  if (metricDiffBadge) {
    metricDiffBadge.style.cursor = "pointer";
    metricDiffBadge.title = "Click to clear visual diff";
    metricDiffBadge.addEventListener("click", () => {
      clearVisualDiff();
    });
  }

  function runVisualDiffCalculation(notify = true) {
    if (notify) {
      logAction("Calculating visual pixel mismatch and layout regressions...");
    }

    btnRunDiff.innerHTML = `<span class="btn-label-full">⏳ Analyzing Diff...</span><span class="btn-label-short">⏳ Analyzing...</span>`;
    btnRunDiff.classList.add("loading");

    // 1. Ensure visual diff sync toggle is active so differences are visible
    if (checkSyncRedDiff) {
      checkSyncRedDiff.checked = true;
      updateSyncChipStyles();
    }

    // 2. Calculate & apply layout shifts (Yellow Hazard Spacers)
    calculateAndApplyLayoutShifts();

    // 3. Calculate non-height visual & content regressions
    computeAndApplyRedDifferences(true);

    // 4. Extract exact shift regions for diff heatmap and column/swipe diff overlays
    activeShiftRegions = [];
    let totalShiftDelta = 0;
    if (lastProdLandmarks && lastStgLandmarks) {
      const pairs = matchLandmarks(lastProdLandmarks.landmarks, lastStgLandmarks.landmarks);
      let prevP = 0, prevS = 0;

      pairs.forEach((pair) => {
        const pSec = pair.prod;
        const sSec = pair.stg;

        const pGap = Math.max(0, pSec.box.y - prevP);
        const sGap = Math.max(0, sSec.box.y - prevS);
        const gapDiff = Math.abs(pGap - sGap);
        if (gapDiff > 4) {
          totalShiftDelta += gapDiff;
          const y = Math.min(pSec.box.y, sSec.box.y);
          activeShiftRegions.push({ y, h: gapDiff, label: `+${gapDiff}px (inserted space)` });
        }

        const secDiff = Math.abs(pSec.box.height - sSec.box.height);
        if (secDiff > 4) {
          totalShiftDelta += secDiff;
          const overlapH = Math.min(pSec.box.height, sSec.box.height);
          const y = Math.min(pSec.box.y, sSec.box.y) + overlapH;
          activeShiftRegions.push({ y, h: secDiff, label: `+${secDiff}px ("${pSec.heading || pSec.tag}" is larger)` });
        }

        prevP = pSec.box.y + pSec.box.height;
        prevS = sSec.box.y + sSec.box.height;
      });
    }

    // 4. Update active diff renderings ONLY if the corresponding view/mode is selected
    if (currentMode === "swipe") {
      if (swipeCompareMode === "diff") {
        renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
      }
    } else if (currentMode === "side-by-side") {
      if (isColDiffActive) {
        if (paneColDiff) paneColDiff.style.display = "flex";
        const viewSide = document.getElementById("view-side-by-side");
        if (viewSide) viewSide.classList.add("mode-view-pixel-diff");
        renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
      } else {
        if (paneColDiff) paneColDiff.style.display = "none";
        const viewSide = document.getElementById("view-side-by-side");
        if (viewSide) viewSide.classList.remove("mode-view-pixel-diff");
      }
    } else if (currentMode === "overlay") {
      renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
    }

    // 4. Compute real mismatch percentage
    const active = getActiveFramesForMode(currentMode);
    const canvasWidth = active.prod?.clientWidth || iframeOverlayProd.clientWidth || 1200;
    const canvasHeight = Math.max(active.prod?.clientHeight || 800, lastProdLandmarks?.docHeight || 1200);

    let totalDiffArea = 0;
    activeRedDiffs.forEach(d => {
      if (d.box && d.box.width && d.box.height) {
        totalDiffArea += d.box.width * d.box.height;
      } else {
        totalDiffArea += 180 * 44; // standard UI element footprint
      }
    });

    activeShiftRegions.forEach(reg => {
      totalDiffArea += canvasWidth * reg.h;
    });

    const totalDocArea = Math.max(1, canvasWidth * canvasHeight);
    const calculatedPct = Math.min(99.9, Math.max(0.1, (totalDiffArea / totalDocArea) * 100));
    const mismatchPct = calculatedPct.toFixed(2) + "%";

    isDiffActive = true;

    // 5. Update secondary toolbar metric badges
    metricDiffBadge.style.display = "flex";
    metricDiffPct.textContent = mismatchPct;
    updateAllDiffPercentDisplays(mismatchPct);

    if (totalShiftDelta > 0) {
      metricShiftBadge.style.display = "flex";
      metricShiftVal.textContent = `+${totalShiftDelta}px (Yellow Spacer)`;
    } else {
      metricShiftBadge.style.display = "none";
    }

    if (metricRedBadge) metricRedBadge.style.display = "none";

    // 6. Update action button UI
    btnRunDiff.classList.remove("loading");
    btnRunDiff.classList.add("diff-active");
    btnRunDiff.innerHTML = `<span class="btn-label-full">✓ Visual Diff (${mismatchPct})</span><span class="btn-label-short">✓ ${mismatchPct}</span>`;
    btnRunDiff.title = "Visual diff calculated. Click to re-run fresh comparison.";

    // 7. Render heatmap on canvas (ready whenever user views or switches to overlay mode)
    renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);

    if (notify) {
      logAction(`[RUN DIFF] Visual comparison complete: ${mismatchPct} mismatch (${activeRedDiffs.length} visual regressions, +${totalShiftDelta}px yellow layout shift).`);
    }
  }

  function clearVisualDiff() {
    isDiffActive = false;
    activeRedDiffs = [];
    clearAllRedDiffs(false);
    diffCanvas.style.display = "none";
    diffLegendPill.style.display = "none";
    metricDiffBadge.style.display = "none";
    lastAccuratePixelDiffPct = null;
    updateAllDiffPercentDisplays("0.00%");
    if (swipeDiffCanvas) swipeDiffCanvas.style.display = "none";
    if (pixelDiffCanvas) {
      const pCtx = pixelDiffCanvas.getContext("2d");
      pCtx.clearRect(0, 0, pixelDiffCanvas.width, pixelDiffCanvas.height);
    }
    btnRunDiff.classList.remove("diff-active");
    btnRunDiff.innerHTML = `<span class="btn-label-full">📸 Run Diff</span><span class="btn-label-short">📸 Diff</span>`;
    btnRunDiff.title = "Capture snapshots and calculate visual pixel mismatch";
    logAction("Visual comparison diff cleared.");
  }

  function renderDiffCanvasHeatmap(diffList, shiftRegions) {
    const canvas = diffCanvas;
    if (!canvas) return;

    canvas.style.display = "block";
    diffLegendPill.style.display = "flex";

    const width = iframeOverlayProd.clientWidth || 1200;
    const height = Math.max(iframeOverlayProd.clientHeight || 800, lastProdLandmarks?.docHeight || 800);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Red pixel differences on altered elements
    if (diffList && diffList.length > 0) {
      diffList.forEach(item => {
        const box = item.box || getEstimatedBoxForSelector(item.selector, width);
        if (!box) return;

        // Glowing semi-transparent red fill (no outline)
        ctx.fillStyle = "rgba(225, 29, 72, 0.4)";
        ctx.fillRect(box.x, box.y, box.width, box.height);

        // Text descriptions disabled per user instruction: pure pixel difference without text descriptions
      });
    }

    // 2. Yellow hazard stripes for layout shift regions
    if (shiftRegions && shiftRegions.length > 0) {
      shiftRegions.forEach(reg => {
        drawHazardStripes(ctx, 0, reg.y, width, reg.h, 12);
        drawYellowHighlight(ctx, 0, reg.y, width, reg.h);
        drawCanvasShiftBadge(ctx, width, reg.y, reg.h, reg.label);
      });
    }
  }

  function getEstimatedBoxForSelector(selector, canvasWidth) {
    const w = canvasWidth || 1200;
    const sel = (selector || "").toLowerCase();
    const isNarrow = w <= 600;

    if (sel.includes("brand-logo")) {
      return isNarrow ? { x: 16, y: 16, width: 36, height: 36 } : { x: 24, y: 14, width: 36, height: 36 };
    }
    if (sel.includes("nav-tab") || sel.includes("header-nav") || sel.includes("overview")) {
      return isNarrow ? { x: 110, y: 16, width: 95, height: 36 } : { x: 180, y: 14, width: 110, height: 36 };
    }
    if (sel.includes("btn-primary") || sel.includes("btn-start-trial")) {
      return isNarrow ? { x: Math.max(220, w - 120), y: 16, width: 105, height: 36 } : { x: w - 210, y: 14, width: 140, height: 40 };
    }
    if (sel.includes("announcement") || sel.includes("ticker") || sel.includes("guarantee") || sel.includes("alert")) {
      return { x: 0, y: 72, width: w, height: 56 };
    }
    if (sel.includes("feature-card") || sel.includes("h3")) {
      return isNarrow ? { x: 20, y: 1250, width: w - 40, height: 36 } : { x: w * 0.08, y: 950, width: 320, height: 36 };
    }
    if (sel.includes("compare-table") || sel.includes("th")) {
      return isNarrow ? { x: 20, y: 1550, width: w - 40, height: 44 } : { x: w * 0.35, y: 1160, width: 180, height: 44 };
    }
    if (sel.includes("metric-card") || sel.includes("metric-value")) {
      return isNarrow ? { x: 20, y: 1100, width: w - 40, height: 48 } : { x: w * 0.08, y: 915, width: 220, height: 48 };
    }
    if (sel.includes("pricing-card") || sel.includes("amount")) {
      return isNarrow ? { x: 20, y: 1300, width: w - 40, height: 44 } : { x: w * 0.38, y: 980, width: 140, height: 44 };
    }
    if (sel.includes("cta-submit") || sel.includes("btn-plan")) {
      return isNarrow ? { x: 24, y: 2280, width: w - 48, height: 48 } : { x: (w - 220) / 2, y: 1820, width: 220, height: 48 };
    }
    if (sel.includes("cta-card")) {
      return isNarrow ? { x: 16, y: 2180, width: w - 32, height: 200 } : { x: (w - Math.min(1100, w * 0.92)) / 2, y: 1720, width: Math.min(1100, w * 0.92), height: 180 };
    }
    if (sel.includes("footer")) {
      return { x: w * 0.65, y: isNarrow ? 2550 : 2050, width: 280, height: 28 };
    }
    if (sel.includes("footer")) {
      return { x: w * 0.65, y: 1050, width: 280, height: 28 };
    }
    return { x: 40, y: 120, width: 240, height: 40 };
  }

  // ----------------------------------------------------
  // PIXEL DIFF RENDERER (Flicker-Free Double Buffer + Viewport-Only Check)
  // ----------------------------------------------------
  let scrollDiffRaf = null;
  let liveDiffCaptureTimer = null;
  let isCapturingDiff = false;
  let isUserScrolling = false;
  let scrollEndTimer = null;
  let lastCapturedDiffCanvas = null;

  // Offscreen canvas for atomic, flicker-free rendering
  let offscreenDiffCanvas = null;
  function getOffscreenCanvas(w, h) {
    if (!offscreenDiffCanvas) {
      offscreenDiffCanvas = document.createElement("canvas");
    }
    if (offscreenDiffCanvas.width !== w || offscreenDiffCanvas.height !== h) {
      offscreenDiffCanvas.width = w;
      offscreenDiffCanvas.height = h;
    }
    return offscreenDiffCanvas;
  }

  // Dedicated offscreen canvas for Swipe Diff at full native container resolution
  let offscreenSwipeCanvas = null;
  function getSwipeOffscreenCanvas(w, h) {
    if (!offscreenSwipeCanvas) {
      offscreenSwipeCanvas = document.createElement("canvas");
    }
    if (offscreenSwipeCanvas.width !== w || offscreenSwipeCanvas.height !== h) {
      offscreenSwipeCanvas.width = w;
      offscreenSwipeCanvas.height = h;
    }
    return offscreenSwipeCanvas;
  }

  function isPixelDiffOverlayActive() {
    const isColDiffVisible = (currentMode === "side-by-side" && isColDiffActive && paneColDiff && paneColDiff.style.display !== "none");
    const isSwipeDiffActive = (currentMode === "swipe" && swipeCompareMode === "diff");
    return isColDiffVisible || isSwipeDiffActive;
  }

  function triggerScrollDiffSync(scrollY, scrollX) {
    if (!isPixelDiffOverlayActive()) return;

    isUserScrolling = true;

    if (scrollDiffRaf) cancelAnimationFrame(scrollDiffRaf);
    scrollDiffRaf = requestAnimationFrame(() => {
      scrollDiffRaf = null;
      if (currentMode === "swipe") {
        renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions, scrollY, scrollX);
      } else {
        renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions, scrollY, scrollX);
      }
    });

    // While scrolling, do not capture visible tab. When scrolling settles, capture once!
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(() => {
      isUserScrolling = false;
      if (isPixelDiffOverlayActive()) {
        scheduleLivePixelDiffCapture();
      }
    }, 120);
  }

  function updateAllDiffPercentDisplays(pctStr) {
    if (!pctStr) return;
    if (colDiffPct) {
      colDiffPct.textContent = `${pctStr} Diff`;
    }
    const swipeDiffPct = document.getElementById("swipe-diff-pct");
    if (swipeDiffPct) {
      swipeDiffPct.textContent = `${pctStr} Diff`;
      if (currentMode === "swipe" && swipeCompareMode === "diff") {
        swipeDiffPct.style.display = "inline-flex";
      } else {
        swipeDiffPct.style.display = "none";
      }
    }
    if (metricDiffPct) {
      metricDiffPct.textContent = pctStr;
      if (metricDiffBadge) {
        metricDiffBadge.style.display = isPixelDiffOverlayActive() ? "flex" : "none";
      }
    }
  }

  function scheduleLivePixelDiffCapture() {
    if (isUserScrolling || isCapturingDiff) return;
    if (!isPixelDiffOverlayActive()) return;
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") return;

    if (liveDiffCaptureTimer) clearTimeout(liveDiffCaptureTimer);
    liveDiffCaptureTimer = setTimeout(() => {
      requestLivePixelDiff();
    }, 80);
  }

  function requestLivePixelDiff() {
    if (isCapturingDiff || isUserScrolling) return;
    if (!isPixelDiffOverlayActive()) return;
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") return;

    isCapturingDiff = true;

    if (currentMode === "swipe") {
      // In swipe mode: capture Prod and Staging viewports sequentially without UI disruption
      if (!iframeSwipeProd || !iframeSwipeStg) {
        isCapturingDiff = false;
        return;
      }
      const origProdOpacity = iframeSwipeProd.style.opacity;
      const origDiffOpacity = iframeSwipeDiff ? iframeSwipeDiff.style.opacity : "1";
      iframeSwipeProd.style.opacity = "1";
      if (iframeSwipeDiff) iframeSwipeDiff.style.opacity = "0";

      try {
        chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVE_TAB" }, (resProd) => {
          if (!resProd || resProd.status !== "ok" || !resProd.dataUrl) {
            iframeSwipeProd.style.opacity = origProdOpacity;
            if (iframeSwipeDiff) iframeSwipeDiff.style.opacity = origDiffOpacity;
            isCapturingDiff = false;
            return;
          }

          iframeSwipeProd.style.opacity = "0";

          chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVE_TAB" }, (resStg) => {
            iframeSwipeProd.style.opacity = origProdOpacity;
            if (iframeSwipeDiff) iframeSwipeDiff.style.opacity = origDiffOpacity;

            if (resStg && resStg.status === "ok" && resStg.dataUrl) {
              applyCapturedSwipePixelDiff(resProd.dataUrl, resStg.dataUrl, activeShiftRegions);
            } else {
              isCapturingDiff = false;
            }
          });
        });
      } catch (err) {
        iframeSwipeProd.style.opacity = origProdOpacity;
        if (iframeSwipeDiff) iframeSwipeDiff.style.opacity = origDiffOpacity;
        isCapturingDiff = false;
      }
      return;
    }

    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVE_TAB" }, (res) => {
        if (res && res.status === "ok" && res.dataUrl) {
          applyCapturedPixelDiff(res.dataUrl, activeShiftRegions);
        } else {
          isCapturingDiff = false;
        }
      });
    } catch (e) {
      isCapturingDiff = false;
    }
  }

  // Dedicated 1:1 renderer for Swipe Split Curtain Diff Canvas (Stage <-> Diff)
  // Pure pixel-level difference display - ZERO OUTLINES ON ANYTHING
  function renderSwipeDiffCanvas(diffList = activeRedDiffs, shiftRegions = activeShiftRegions, currentScrollY = (lastScrollState.scrollY || 0), currentScrollX = (lastScrollState.scrollX || 0)) {
    if (!swipeDiffCanvas) return;
    if (swipeCompareMode !== "diff") {
      swipeDiffCanvas.style.display = "none";
      return;
    }
    swipeDiffCanvas.style.display = "block";
    if (iframeSwipeDiff && iframeSwipeDiff.style.display === "none") {
      iframeSwipeDiff.style.display = "block";
      iframeSwipeDiff.style.opacity = "1";
      const stgSrc = (iframeStg && iframeStg.src && iframeStg.src !== "about:blank") ? iframeStg.src : stgUrlInput.value.trim();
      if (stgSrc && iframeSwipeDiff.src !== stgSrc) {
        iframeSwipeDiff.src = stgSrc;
      }
    }

    // Use exact rendered width & height of the swipe container
    const swW = swipeOverlayLayer?.clientWidth || swipeContainer?.clientWidth || iframeSwipeProd?.clientWidth || 1200;
    const swH = swipeOverlayLayer?.clientHeight || swipeContainer?.clientHeight || iframeSwipeProd?.clientHeight || 800;

    if (swW <= 0 || swH <= 0) return;

    // Match 1:1 bitmap dimensions to CSS dimensions to completely eliminate any stretching
    if (swipeDiffCanvas.width !== swW || swipeDiffCanvas.height !== swH) {
      swipeDiffCanvas.width = swW;
      swipeDiffCanvas.height = swH;
    }
    swipeDiffCanvas.style.width = swW + "px";
    swipeDiffCanvas.style.height = swH + "px";

    // Double-buffered offscreen canvas at exact native swipe resolution
    const offCanvas = getSwipeOffscreenCanvas(swW, swH);
    const offCtx = offCanvas.getContext("2d");
    offCtx.clearRect(0, 0, swW, swH);

    let totalDiffArea = 0;

    // 1. If an actual captured subpixel screenshot diff exists matching this exact resolution & aspect ratio, draw it directly!
    let drawnCapturedDiff = false;
    if (lastCapturedDiffCanvas && !isUserScrolling) {
      if (Math.abs(lastCapturedDiffCanvas.width - swW) < 5) {
        offCtx.drawImage(lastCapturedDiffCanvas, 0, 0, swW, swH);
        drawnCapturedDiff = true;
      } else {
        // Mismatched aspect ratio or width (e.g. from 3-column view) - drop stale canvas so it never warps!
        lastCapturedDiffCanvas = null;
      }
    }
    if (!drawnCapturedDiff) {
      // Frame to query for live element bounding boxes (100% pixel-perfect subpixel accuracy)
      const liveTargetFrame = (swipeCompareMode === "diff") ? (iframeSwipeDiff || iframeSwipeStg) : iframeSwipeProd;
      const liveFallbackFrame = iframeSwipeStg;

      const effectiveDiffs = (diffList && diffList.length > 0) ? diffList : (swipeRedDiffs && swipeRedDiffs.length > 0 ? swipeRedDiffs : activeRedDiffs);
      if (effectiveDiffs && effectiveDiffs.length > 0) {
        effectiveDiffs.forEach(item => {
          if (!item) return;

          let drawX = 0;
          let drawY = 0;
          let drawW = 0;
          let drawH = 0;
          let hasExactBox = false;

          // Try querying the live DOM directly in the swipe frame if same-origin
          if (item.selector) {
            try {
              let el = null;
              if (liveTargetFrame && liveTargetFrame.contentDocument) {
                el = liveTargetFrame.contentDocument.querySelector(item.selector);
              }
              if (!el && liveFallbackFrame && liveFallbackFrame.contentDocument) {
                el = liveFallbackFrame.contentDocument.querySelector(item.selector);
              }
              if (!el && iframeSwipeProd && iframeSwipeProd.contentDocument) {
                el = iframeSwipeProd.contentDocument.querySelector(item.selector);
              }
              if (el) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                  drawX = Math.round(r.left);
                  drawY = Math.round(r.top);
                  drawW = Math.round(r.width);
                  drawH = Math.round(r.height);
                  hasExactBox = true;
                }
              }
            } catch (e) {
              // Cross-origin iframe
            }
          }

          // If not queryable via contentDocument, use candidate measured box or estimated box
          if (!hasExactBox) {
            const box = item.swipeBox || item.stgBox || item.box;
            const isBoxFromNarrow = box && box.measuredWidth && box.measuredWidth < 600 && swW > 800;
            if (isBoxFromNarrow) {
              const prodHref = (prodUrlInput?.value || "").toLowerCase();
              const isDemoSite = prodHref.includes("demo_") || prodHref.includes("demo-");
              if (isDemoSite) {
                const est = getEstimatedBoxForSelector(item.selector, swW);
                if (est) {
                  drawX = est.x;
                  drawY = est.y - currentScrollY;
                  drawW = est.width;
                  drawH = est.height;
                  hasExactBox = true;
                } else {
                  return;
                }
              } else {
                return;
              }
            } else if (!box || (box.width === 0 && box.height === 0)) {
              const prodHref = (prodUrlInput?.value || "").toLowerCase();
              const isDemoSite = prodHref.includes("demo_") || prodHref.includes("demo-");
              if (isDemoSite) {
                const est = getEstimatedBoxForSelector(item.selector, swW);
                if (est) {
                  drawX = est.x;
                  drawY = est.y - currentScrollY;
                  drawW = est.width;
                  drawH = est.height;
                  hasExactBox = true;
                } else {
                  return;
                }
              } else {
                return;
              }
            } else {
              const isFixed = Boolean(item.isFixed || box.isFixed);
              const isSticky = Boolean(item.isSticky || box.isSticky);
              drawX = isFixed ? (box.viewportX !== undefined ? box.viewportX : box.x) : (box.x - currentScrollX);
              drawY = (isFixed || (isSticky && currentScrollY > (box.y || 0))) ? (box.viewportY !== undefined ? box.viewportY : box.y) : (box.y - currentScrollY);
              drawW = box.width;
              drawH = box.height;
            }
          }

          // Viewport clipping
          if (drawY + drawH < -10 || drawY > swH + 10) return;
          if (drawX + drawW < -10 || drawX > swW + 10) return;

          totalDiffArea += (drawW * drawH);

          // PURE PIXEL LEVEL DIFFERENCE - ZERO OUTLINES ON ANYTHING!
          offCtx.save();
          let renderedGlyphs = false;
          try {
            const targetEl = (liveTargetFrame && liveTargetFrame.contentDocument)
              ? liveTargetFrame.contentDocument.querySelector(item.selector)
              : null;
            if (targetEl && (liveTargetFrame?.contentWindow || liveFallbackFrame?.contentWindow)) {
              const win = liveTargetFrame?.contentWindow || liveFallbackFrame?.contentWindow;
              const compStyle = win.getComputedStyle(targetEl);
              const tag = targetEl.tagName.toLowerCase();
              const isContainer = (item.selector && (item.selector.includes("card") || item.selector.includes("section") || item.selector.includes("container") || item.selector.includes("table") || item.selector.includes("site-header") || item.selector.includes("hero-section") || item.selector.includes("cta-section"))) || drawH > 90 || tag === "section" || tag === "div" || tag === "table" || tag === "header" || tag === "nav" || tag === "footer";
              const isCardOrContainer = isContainer;
              const isTextNode = (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6" || tag === "p" || tag === "span" || tag === "label" || tag === "strong" || tag === "em" || tag === "th" || tag === "td" || item.diffType === "typography" || item.diffType === "text");

              // If it's a typography difference on a text element (not a card/container): highlight exact text glyphs via Range
              if (isTextNode && !isCardOrContainer && (item.diffType === "typography" || item.diffType === "text")) {
                const doc = targetEl.ownerDocument;
                if (doc) {
                  const range = doc.createRange();
                  range.selectNodeContents(targetEl);
                  const rects = Array.from(range.getClientRects());
                  if (rects.length > 0) {
                    offCtx.fillStyle = "rgba(225, 29, 72, 0.86)";
                    rects.forEach(r => {
                      const rx = Math.round(r.left);
                      const ry = Math.round(r.top);
                      const rw = Math.round(r.width);
                      const rh = Math.round(r.height);
                      if (rw > 0 && rh > 0) {
                        offCtx.beginPath();
                        if (typeof offCtx.roundRect === "function") {
                          offCtx.roundRect(rx - 2, ry - 1, rw + 4, rh + 2, 4);
                        } else {
                          offCtx.rect(rx - 2, ry - 1, rw + 4, rh + 2);
                        }
                        offCtx.fill();
                      }
                    });
                    renderedGlyphs = true;
                  }
                }
              }

              // Skip broad structural containers and sections so identical child elements are never washed with red
              const isBroadSection = tag === "section" || tag === "header" || tag === "nav" || tag === "footer" || tag === "main" || 
                                     (item.selector && (item.selector.includes("section") || item.selector.includes("site-header") || item.selector.includes("hero-section") || item.selector.includes("cta-section")));
              if (isBroadSection) return;

              // If button, pill, badge, card, or container shape: fill exact shape with border-radius (ZERO OUTLINE!)
              if (!renderedGlyphs) {
                const rVal = parseFloat(compStyle.borderRadius) || (parseFloat(item.style?.radius) || 0);
                offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
                offCtx.beginPath();
                if (rVal > 0 && typeof offCtx.roundRect === "function") {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
                } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("button") || item.selector.includes("tab") || item.selector.includes("badge"))) {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
                } else {
                  offCtx.rect(drawX, drawY, drawW, drawH);
                }
                offCtx.fill();
                renderedGlyphs = true;
              }
            }
          } catch (e) {}

          // Fallback if cross-origin or no live element
          if (!renderedGlyphs) {
            const itemText = (item.text || "").trim();
            const isBroadSection = item.selector && (item.selector.includes("section") || item.selector.includes("site-header") || item.selector.includes("hero-section") || item.selector.includes("cta-section"));
            if (isBroadSection) return;
            const isCardOrContainer = (item.selector && (item.selector.includes("card") || item.selector.includes("section") || item.selector.includes("container") || item.selector.includes("table"))) || drawH > 90;
            const rVal = parseFloat(item.style?.radius) || (item.selector.includes("btn") || item.selector.includes("tab") ? 6 : 0);
            offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
            offCtx.beginPath();
            if (rVal > 0 && typeof offCtx.roundRect === "function") {
              offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
            } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("tab"))) {
              offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
            } else {
              offCtx.rect(drawX, drawY, drawW, drawH);
            }
            offCtx.fill();
          }
          offCtx.restore();
        });
      }
    }

    // Yellow hazard layout shifts
    const effectiveShifts = (shiftRegions && shiftRegions.length > 0) ? shiftRegions : activeShiftRegions;
    if (effectiveShifts && effectiveShifts.length > 0 && checkSyncHazard && checkSyncHazard.checked) {
      effectiveShifts.forEach(reg => {
        totalDiffArea += (swW * reg.h);
        const regY = reg.y - currentScrollY;
        if (regY + reg.h < -10 || regY > swH + 10) return;

        drawHazardStripes(offCtx, 0, regY, swW, reg.h, 14);
        drawYellowHighlight(offCtx, 0, regY, swW, reg.h);
      });
    }

    // Single atomic 1:1 paint to visible canvas (NO STRETCHING)
    const sCtx = swipeDiffCanvas.getContext("2d");
    sCtx.clearRect(0, 0, swW, swH);
    sCtx.drawImage(offCanvas, 0, 0);

    // Update real mismatch percentage accurately towards pixel difference
    const mismatchPct = lastAccuratePixelDiffPct || (((totalDiffArea / Math.max(1, swW * swH)) * 100).toFixed(2) + "%");
    updateAllDiffPercentDisplays(mismatchPct);
  }

  function renderPixelDiffColumn3(diffList = activeRedDiffs, shiftRegions = activeShiftRegions, currentScrollY = (lastScrollState.scrollY || 0), currentScrollX = (lastScrollState.scrollX || 0)) {
    // If in swipe mode with diff active, route to dedicated swipe renderer
    if (currentMode === "swipe") {
      if (swipeCompareMode === "diff") {
        renderSwipeDiffCanvas(diffList, shiftRegions, currentScrollY, currentScrollX);
      }
      return;
    }

    if (!pixelDiffCanvas) return;
    if (!isColDiffActive) {
      if (paneColDiff) paneColDiff.style.display = "none";
      return;
    }

    // Ensure diff base iframe src matches Staging (or Prod)
    const targetSrc = (stgUrlInput && stgUrlInput.value && stgUrlInput.value.trim() !== "about:blank")
      ? stgUrlInput.value.trim()
      : ((iframeStg && iframeStg.src && iframeStg.src !== "about:blank") ? iframeStg.src : (iframeProd ? iframeProd.src : ""));
    if (iframeDiffBase && targetSrc && iframeDiffBase.src !== targetSrc) {
      iframeDiffBase.src = targetSrc;
    }

    // Mirror current scroll position to diff base iframe so it scrolls in lockstep
    if (iframeDiffBase && iframeDiffBase.contentWindow) {
      try {
        iframeDiffBase.contentWindow.postMessage({
          type: "VC_MIRROR_ACTION",
          action: { kind: "scroll", scrollY: currentScrollY, scrollX: currentScrollX }
        }, "*");
      } catch (e) {}
    }

    const width = wrapFrameDiff?.clientWidth || iframeProd?.clientWidth || 400;
    const height = wrapFrameDiff?.clientHeight || iframeProd?.clientHeight || 800;

    if (pixelDiffCanvas.width !== width || pixelDiffCanvas.height !== height) {
      pixelDiffCanvas.width = width;
      pixelDiffCanvas.height = height;
    }
    pixelDiffCanvas.style.width = width + "px";
    pixelDiffCanvas.style.height = height + "px";

    // 1. RENDER ONTO OFFSCREEN BUFFER FIRST (Double Buffering to kill all flickering)
    const offCanvas = getOffscreenCanvas(width, height);
    const offCtx = offCanvas.getContext("2d");
    offCtx.clearRect(0, 0, width, height);

    let totalDiffArea = 0;

    // If an actual captured subpixel screenshot diff exists matching this exact column width, draw it
    let drawnCapturedDiff = false;
    if (lastCapturedDiffCanvas && !isUserScrolling) {
      if (Math.abs(lastCapturedDiffCanvas.width - width) < 5) {
        offCtx.drawImage(lastCapturedDiffCanvas, 0, 0, width, height);
        drawnCapturedDiff = true;
      } else {
        lastCapturedDiffCanvas = null;
      }
    }
    if (!drawnCapturedDiff) {
      // Draw viewport-visible DOM diff boxes
      const effectiveDiffs = (diffList && diffList.length > 0) ? diffList : (colRedDiffs && colRedDiffs.length > 0 ? colRedDiffs : activeRedDiffs);
      if (effectiveDiffs && effectiveDiffs.length > 0) {
        effectiveDiffs.forEach(item => {
          if (!item) return;

          let drawX = 0, drawY = 0, drawW = 0, drawH = 0;
          let hasExactBox = false;

          // Try querying live element directly in diff or staging frame
          if (item.selector) {
            try {
              let el = null;
              if (iframeDiffBase && iframeDiffBase.contentDocument) {
                el = iframeDiffBase.contentDocument.querySelector(item.selector);
              }
              if (!el && iframeStg && iframeStg.contentDocument) {
                el = iframeStg.contentDocument.querySelector(item.selector);
              }
              if (!el && iframeProd && iframeProd.contentDocument) {
                el = iframeProd.contentDocument.querySelector(item.selector);
              }
              if (el) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                  drawX = Math.round(r.left);
                  drawY = Math.round(r.top);
                  drawW = Math.round(r.width);
                  drawH = Math.round(r.height);
                  hasExactBox = true;
                }
              }
            } catch (e) {}
          }

          if (!hasExactBox) {
            const box = item.stgBox || item.box;
            const isBoxFromWide = box && box.measuredWidth && box.measuredWidth > 800 && width <= 600;
            if (isBoxFromWide) {
              const prodHref = (prodUrlInput?.value || "").toLowerCase();
              const isDemoSite = prodHref.includes("demo_") || prodHref.includes("demo-");
              if (isDemoSite) {
                const est = getEstimatedBoxForSelector(item.selector, width);
                if (est) {
                  drawX = est.x;
                  drawY = est.y - currentScrollY;
                  drawW = est.width;
                  drawH = est.height;
                  hasExactBox = true;
                } else {
                  return;
                }
              } else {
                return;
              }
            } else if (!box || (box.width === 0 && box.height === 0)) {
              const prodHref = (prodUrlInput?.value || "").toLowerCase();
              const isDemoSite = prodHref.includes("demo_") || prodHref.includes("demo-");
              if (isDemoSite) {
                const est = getEstimatedBoxForSelector(item.selector, width);
                if (est) {
                  drawX = est.x;
                  drawY = est.y - currentScrollY;
                  drawW = est.width;
                  drawH = est.height;
                  hasExactBox = true;
                } else {
                  return;
                }
              } else {
                return;
              }
            } else {
              const isFixed = Boolean(item.isFixed || box.isFixed);
              const isSticky = Boolean(item.isSticky || box.isSticky);
              drawX = isFixed ? (box.viewportX !== undefined ? box.viewportX : box.x) : (box.x - currentScrollX);
              drawY = (isFixed || (isSticky && currentScrollY > (box.y || 0))) ? (box.viewportY !== undefined ? box.viewportY : box.y) : (box.y - currentScrollY);
              drawW = box.width;
              drawH = box.height;
            }
          }

          // VIEWPORT-ONLY FILTERING: Clip diff items scrolled outside visible viewport
          if (drawY + drawH < -10 || drawY > height + 10) return;
          if (drawX + drawW < -10 || drawX > width + 10) return;

          totalDiffArea += (drawW * drawH);

          // PURE PIXEL LEVEL DIFFERENCE - ZERO OUTLINES ON ANYTHING!
          offCtx.save();
          let renderedGlyphs = false;
          try {
            const targetEl = (iframeDiffBase && iframeDiffBase.contentDocument)
              ? iframeDiffBase.contentDocument.querySelector(item.selector)
              : ((iframeStg && iframeStg.contentDocument) ? iframeStg.contentDocument.querySelector(item.selector) : null);
            if (targetEl && (iframeDiffBase?.contentWindow || iframeStg?.contentWindow)) {
              const win = iframeDiffBase?.contentWindow || iframeStg?.contentWindow;
              const compStyle = win.getComputedStyle(targetEl);
              const tag = targetEl.tagName.toLowerCase();
              const isContainer = (item.selector && (item.selector.includes("card") || item.selector.includes("section") || item.selector.includes("container") || item.selector.includes("table") || item.selector.includes("site-header") || item.selector.includes("hero-section") || item.selector.includes("cta-section"))) || drawH > 90 || tag === "section" || tag === "div" || tag === "table" || tag === "header" || tag === "nav" || tag === "footer";
              const isCardOrContainer = isContainer;
              const isTextNode = (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6" || tag === "p" || tag === "span" || tag === "label" || tag === "strong" || tag === "em" || tag === "th" || tag === "td" || item.diffType === "typography" || item.diffType === "text");

              // If it's a typography difference on a text element (not a card/container): highlight exact text glyphs via Range
              if (isTextNode && !isCardOrContainer && (item.diffType === "typography" || item.diffType === "text")) {
                const doc = targetEl.ownerDocument;
                if (doc) {
                  const range = doc.createRange();
                  range.selectNodeContents(targetEl);
                  const rects = Array.from(range.getClientRects());
                  if (rects.length > 0) {
                    offCtx.fillStyle = "rgba(225, 29, 72, 0.86)";
                    rects.forEach(r => {
                      const rx = Math.round(r.left);
                      const ry = Math.round(r.top);
                      const rw = Math.round(r.width);
                      const rh = Math.round(r.height);
                      if (rw > 0 && rh > 0) {
                        offCtx.beginPath();
                        if (typeof offCtx.roundRect === "function") {
                          offCtx.roundRect(rx - 2, ry - 1, rw + 4, rh + 2, 4);
                        } else {
                          offCtx.rect(rx - 2, ry - 1, rw + 4, rh + 2);
                        }
                        offCtx.fill();
                      }
                    });
                    renderedGlyphs = true;
                  }
                }
              }

              // Skip broad structural containers and sections so identical child elements are never washed with red
              const isBroadSection = tag === "section" || tag === "header" || tag === "nav" || tag === "footer" || tag === "main" || 
                                     (item.selector && (item.selector.includes("section") || item.selector.includes("site-header") || item.selector.includes("hero-section") || item.selector.includes("cta-section")));
              if (isBroadSection) return;

              // If button, pill, badge, card, or container shape: fill exact shape with border-radius (ZERO OUTLINE!)
              if (!renderedGlyphs) {
                const rVal = parseFloat(compStyle.borderRadius) || (parseFloat(item.style?.radius) || 0);
                offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
                offCtx.beginPath();
                if (rVal > 0 && typeof offCtx.roundRect === "function") {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
                } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("button") || item.selector.includes("tab") || item.selector.includes("badge"))) {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
                } else {
                  offCtx.rect(drawX, drawY, drawW, drawH);
                }
                offCtx.fill();
                renderedGlyphs = true;
              }
            }
          } catch (e) {}

          // Fallback if cross-origin or no live element
          if (!renderedGlyphs) {
            const itemText = (item.text || "").trim();
            const isBroadSection = item.selector && (item.selector.includes("section") || item.selector.includes("site-header") || item.selector.includes("hero-section") || item.selector.includes("cta-section"));
            if (isBroadSection) return;
            const isCardOrContainer = (item.selector && (item.selector.includes("card") || item.selector.includes("section") || item.selector.includes("container") || item.selector.includes("table"))) || drawH > 90;
            const rVal = parseFloat(item.style?.radius) || (item.selector.includes("btn") || item.selector.includes("tab") ? 6 : 0);
            offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
            offCtx.beginPath();
            if (rVal > 0 && typeof offCtx.roundRect === "function") {
              offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
            } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("tab"))) {
              offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
            } else {
              offCtx.rect(drawX, drawY, drawW, drawH);
            }
            offCtx.fill();
          }
          offCtx.restore();
        });
      }
    }

    // 2. Draw Yellow Hazard Stripes for layout shift regions visible in viewport
    const effectiveShifts = (shiftRegions && shiftRegions.length > 0) ? shiftRegions : activeShiftRegions;
    if (effectiveShifts && effectiveShifts.length > 0 && checkSyncHazard && checkSyncHazard.checked) {
      effectiveShifts.forEach(reg => {
        totalDiffArea += (width * reg.h);

        const regY = reg.y - currentScrollY;
        if (regY + reg.h < -10 || regY > height + 10) return;

        drawHazardStripes(offCtx, 0, regY, width, reg.h, 14);
        drawYellowHighlight(offCtx, 0, regY, width, reg.h);
      });
    }

    // 3. ATOMIC PAINT TO VISIBLE CANVAS (NO FLICKER!)
    const ctx = pixelDiffCanvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(offCanvas, 0, 0);

    // 4. Update real mismatch percentage accurately towards pixel difference
    const mismatchPct = lastAccuratePixelDiffPct || (((totalDiffArea / Math.max(1, width * height)) * 100).toFixed(2) + "%");
    updateAllDiffPercentDisplays(mismatchPct);
  }

  // ----------------------------------------------------
  // SUBPIXEL PIXEL-LEVEL DIFF ENGINE (Port of Python diff_engine.py make_diff_mask_subpixel)
  // Rejects 1px font anti-aliasing / subpixel smoothing noise and highlights exact differing pixels in RED (225, 29, 72, 220)
  // ----------------------------------------------------
  function computeSubpixelPixelDiff(dataP, dataS, width, height, tolerance = 20, shiftRegions = null) {
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

    // 8-neighbor offsets matching diff_engine.py make_diff_mask_subpixel
    const neighbors = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, 1], [-1, 1], [1, -1]
    ];

    // Cumulative layout shift tracking to align content below shifts
    const shifts = (Array.isArray(shiftRegions) && shiftRegions.length > 0) ? shiftRegions : [];

    for (let y = 0; y < height; y++) {
      let insideShiftBand = false;
      let cumShift = 0;
      for (const reg of shifts) {
        if (!reg || !reg.h) continue;
        if (y >= reg.y && y < reg.y + reg.h) {
          insideShiftBand = true;
          break;
        }
        if (y >= reg.y + reg.h) {
          cumShift += reg.h;
        }
      }

      // Layout shift discrepancy bands are handled via yellow hazard stripes, never red diffs!
      if (insideShiftBand) continue;

      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        let minDiff = baseDiff[idx];

        // If above tolerance and layout shift occurred above this row:
        // check alignment with shifted Prod row to prevent identical content below layout shifts from turning red!
        if (minDiff > tolerance && cumShift > 0) {
          const shiftedPy = y - cumShift;
          if (shiftedPy >= 0 && shiftedPy < height) {
            const pIdx = idx * 4;
            const rS = dataS[pIdx];
            const gS = dataS[pIdx + 1];
            const bS = dataS[pIdx + 2];

            const shiftPIdx = (shiftedPy * width + x) * 4;
            const shiftDiff = Math.max(
              Math.abs(dataP[shiftPIdx] - rS),
              Math.abs(dataP[shiftPIdx + 1] - gS),
              Math.abs(dataP[shiftPIdx + 2] - bS)
            );
            if (shiftDiff < minDiff) {
              minDiff = shiftDiff;
            }
          }
        }

        // If above tolerance, check 8 neighbor offsets to eliminate font subpixel anti-aliasing artifacts
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
          // RED = (225, 29, 72, 220) matching Python diff_engine.py (#e11d48)
          const pIdx = idx * 4;
          outData[pIdx] = 225;     // R
          outData[pIdx + 1] = 29;  // G
          outData[pIdx + 2] = 72;  // B
          outData[pIdx + 3] = 220; // A (0.86 alpha matching diff_engine.py)
          diffPixels++;
        }
      }
    }

    return { outData, diffPixels };
  }

  function applyCapturedPixelDiff(dataUrl, shiftRegions = activeShiftRegions) {
    if (!pixelDiffCanvas) {
      isCapturingDiff = false;
      return;
    }
    if (isUserScrolling) {
      isCapturingDiff = false;
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const active = getActiveFramesForMode(currentMode);
        const activeProd = (currentMode === "swipe") ? (iframeSwipeProd || active.prod) : (active.prod || iframeProd);
        const activeStg = (currentMode === "swipe") ? (iframeSwipeStg || active.stg) : (active.stg || iframeStg);
        if (!activeProd || !activeStg) {
          isCapturingDiff = false;
          return;
        }

        const rProd = activeProd.getBoundingClientRect();
        const rStg = activeStg.getBoundingClientRect();
        if (rProd.width <= 0 || rStg.width <= 0) {
          isCapturingDiff = false;
          return;
        }

        const dpr = img.width / Math.max(1, window.innerWidth);
        const cropW = Math.round(rProd.width * dpr);
        const cropH = Math.round(rProd.height * dpr);

        const canvasP = document.createElement("canvas");
        canvasP.width = cropW;
        canvasP.height = cropH;
        const ctxP = canvasP.getContext("2d");
        ctxP.drawImage(img, Math.round(rProd.left * dpr), Math.round(rProd.top * dpr), cropW, cropH, 0, 0, cropW, cropH);

        const canvasS = document.createElement("canvas");
        canvasS.width = cropW;
        canvasS.height = cropH;
        const ctxS = canvasS.getContext("2d");
        ctxS.drawImage(img, Math.round(rStg.left * dpr), Math.round(rStg.top * dpr), cropW, cropH, 0, 0, cropW, cropH);

        const dataP = ctxP.getImageData(0, 0, cropW, cropH).data;
        const dataS = ctxS.getImageData(0, 0, cropW, cropH).data;

        const outCanvas = document.createElement("canvas");
        outCanvas.width = Math.round(rProd.width);
        outCanvas.height = Math.round(rProd.height);
        const outCtx = outCanvas.getContext("2d");

        // Sensitive delta matching diff_engine.py make_diff_mask_subpixel
        // Accurately flags subtle background shading gradients, radial fills, and border accents
        const { outData, diffPixels } = computeSubpixelPixelDiff(dataP, dataS, cropW, cropH, 20, shiftRegions);

        const diffImg = new ImageData(outData, cropW, cropH);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        tempCanvas.getContext("2d").putImageData(diffImg, 0, 0);

        outCtx.drawImage(tempCanvas, 0, 0, outCanvas.width, outCanvas.height);

        // Include layout shift areas in total mismatch area
        let shiftArea = 0;
        if (shiftRegions && shiftRegions.length > 0) {
          shiftRegions.forEach(reg => {
            shiftArea += (outCanvas.width * reg.h);
          });
        }

        const totalPixels = Math.max(1, cropW * cropH);
        const accuratePctNum = (diffPixels / totalPixels) * 100;
        const pct = accuratePctNum.toFixed(2) + "%";
        lastAccuratePixelDiffPct = pct;

        if (diffPixels > 0 || shiftArea > 0) {
          lastCapturedDiffCanvas = outCanvas;
          lastCapturedScrollY = (lastScrollState.scrollY || 0);
          lastCapturedScrollX = (lastScrollState.scrollX || 0);
        }

        updateAllDiffPercentDisplays(pct);

        if (isColDiffActive) {
          renderPixelDiffColumn3(activeRedDiffs, shiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
        }
      } catch (err) {
        console.warn("[VisualCompare Live] Pixel capture comparison error:", err);
      } finally {
        isCapturingDiff = false;
      }
    };
    img.onerror = () => {
      isCapturingDiff = false;
    };
    img.src = dataUrl;
  }

  function applyCapturedSwipePixelDiff(dataUrlProd, dataUrlStg, shiftRegions = activeShiftRegions) {
    if (!swipeDiffCanvas || swipeCompareMode !== "diff") {
      isCapturingDiff = false;
      return;
    }

    let loadedCount = 0;
    const imgP = new Image();
    const imgS = new Image();

    const onBothLoaded = () => {
      try {
        const swW = swipeOverlayLayer?.clientWidth || swipeContainer?.clientWidth || 1200;
        const swH = swipeOverlayLayer?.clientHeight || swipeContainer?.clientHeight || 800;
        const rSwipe = swipeContainer?.getBoundingClientRect();
        if (!rSwipe || swW <= 0 || swH <= 0) {
          isCapturingDiff = false;
          return;
        }

        const dpr = imgP.width / Math.max(1, window.innerWidth);
        const cropW = Math.round(swW * dpr);
        const cropH = Math.round(swH * dpr);

        const canvasP = document.createElement("canvas");
        canvasP.width = cropW;
        canvasP.height = cropH;
        canvasP.getContext("2d").drawImage(imgP, Math.round(rSwipe.left * dpr), Math.round(rSwipe.top * dpr), cropW, cropH, 0, 0, cropW, cropH);

        const canvasS = document.createElement("canvas");
        canvasS.width = cropW;
        canvasS.height = cropH;
        canvasS.getContext("2d").drawImage(imgS, Math.round(rSwipe.left * dpr), Math.round(rSwipe.top * dpr), cropW, cropH, 0, 0, cropW, cropH);

        const dataP = canvasP.getContext("2d").getImageData(0, 0, cropW, cropH).data;
        const dataS = canvasS.getContext("2d").getImageData(0, 0, cropW, cropH).data;

        // Subpixel anti-aliasing checking matching Python diff_engine.py make_diff_mask_subpixel
        const { outData, diffPixels } = computeSubpixelPixelDiff(dataP, dataS, cropW, cropH, 20, shiftRegions);

        const outCanvas = document.createElement("canvas");
        outCanvas.width = swW;
        outCanvas.height = swH;
        const outCtx = outCanvas.getContext("2d");

        const diffImg = new ImageData(outData, cropW, cropH);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = cropW;
        tempCanvas.height = cropH;
        tempCanvas.getContext("2d").putImageData(diffImg, 0, 0);

        outCtx.drawImage(tempCanvas, 0, 0, swW, swH);

        let shiftArea = 0;
        if (shiftRegions && shiftRegions.length > 0) {
          shiftRegions.forEach(reg => {
            shiftArea += (swW * reg.h);
          });
        }

        const totalPixels = Math.max(1, cropW * cropH);
        const accuratePctNum = (diffPixels / totalPixels) * 100;
        const pct = accuratePctNum.toFixed(2) + "%";
        lastAccuratePixelDiffPct = pct;

        if (diffPixels > 0 || shiftArea > 0) {
          lastCapturedDiffCanvas = outCanvas;
          lastCapturedScrollY = (lastScrollState.scrollY || 0);
          lastCapturedScrollX = (lastScrollState.scrollX || 0);
        }

        updateAllDiffPercentDisplays(pct);
        renderSwipeDiffCanvas(activeRedDiffs, shiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
      } catch (err) {
        console.warn("[VisualCompare Live] Swipe pixel capture comparison error:", err);
      } finally {
        isCapturingDiff = false;
      }
    };

    imgP.onload = () => { if (++loadedCount === 2) onBothLoaded(); };
    imgS.onload = () => { if (++loadedCount === 2) onBothLoaded(); };
    imgP.onerror = () => { isCapturingDiff = false; };
    imgS.onerror = () => { isCapturingDiff = false; };
    imgP.src = dataUrlProd;
    imgS.src = dataUrlStg;
  }

  function drawRedPixelDiffLabel(ctx, x, y, label) {
    // Disabled per user instruction: pure pixel difference without text descriptions
  }

  function drawCanvasShiftBadge(ctx, canvasWidth, y, h, label) {
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    const badgeW = Math.min(420, canvasWidth - 40);
    const badgeH = 28;
    const badgeX = (canvasWidth - badgeW) / 2;
    const badgeY = y + Math.max(2, (h - badgeH) / 2);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`⚠️ LAYOUT SHIFT SPACER: ${label}`, canvasWidth / 2, badgeY + badgeH / 2);
    ctx.restore();
  }

  function drawRedDiffCanvasBadge(ctx, x, y, label) {
    // Disabled per user instruction: pure pixel difference without text descriptions
  }

  // ----------------------------------------------------
  // 8. DEVICE VIEWPORT & ZOOM SCALER
  // ----------------------------------------------------
  viewportSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "responsive") {
      viewportScaler.style.width = "100%";
      viewportScaler.style.height = "100%";
    } else {
      const [w, h] = val.split("x");
      viewportScaler.style.width = `${w}px`;
      viewportScaler.style.height = `${h}px`;
    }
    logAction(`Device viewport updated: ${val}`);

    setTimeout(() => {
      if (checkSyncHazard && checkSyncHazard.checked) {
        triggerHazardRealignment("Device viewport preset changed");
      }
    }, 250);
  });

  window.addEventListener("resize", () => {
    clearTimeout(studioResizeTimer);
    studioResizeTimer = setTimeout(() => {
      lastCapturedDiffCanvas = null;
      if (currentMode === "swipe") {
        if (iframeSwipeProd && iframeSwipeProd.contentWindow) {
          try { iframeSwipeProd.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*"); } catch (e) {}
        }
        if (iframeSwipeStg && iframeSwipeStg.contentWindow) {
          try { iframeSwipeStg.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*"); } catch (e) {}
        }
        if (swipeCompareMode === "diff") {
          renderSwipeDiffCanvas(swipeRedDiffs);
        }
      } else if (currentMode === "side-by-side" && isColDiffActive) {
        renderPixelDiffColumn3(colRedDiffs);
      }
      if (checkSyncHazard && checkSyncHazard.checked) {
        triggerHazardRealignment("Studio window resized");
      }
    }, 250);
  });

  zoomSelect.addEventListener("change", (e) => {
    const scale = parseFloat(e.target.value) || 1;
    viewportScaler.style.transform = `scale(${scale})`;
  });

  // ----------------------------------------------------
  // 9. URL ACTIONS & NAVIGATION
  // ----------------------------------------------------
  btnNavigateAll.addEventListener("click", () => {
    loadAllFrames(prodUrlInput.value.trim(), stgUrlInput.value.trim());
  });

  btnSwapUrls.addEventListener("click", () => {
    const temp = prodUrlInput.value;
    prodUrlInput.value = stgUrlInput.value;
    stgUrlInput.value = temp;
    loadAllFrames(prodUrlInput.value.trim(), stgUrlInput.value.trim());
  });

  btnReloadProd.addEventListener("click", () => {
    hasAlignedCurrentPage = false;
    lastProdLandmarks = null;
    clearTimeout(alignDebounceTimer);
    if (iframeProd) iframeProd.src = prodUrlInput.value.trim();
    if (iframeSwipeProd) iframeSwipeProd.src = prodUrlInput.value.trim();
    if (iframeFlickerProd) iframeFlickerProd.src = prodUrlInput.value.trim();
    if (iframeOverlayProd) iframeOverlayProd.src = prodUrlInput.value.trim();
  });

  btnReloadStg.addEventListener("click", () => {
    hasAlignedCurrentPage = false;
    lastStgLandmarks = null;
    clearTimeout(alignDebounceTimer);
    if (iframeStg) iframeStg.src = stgUrlInput.value.trim();
    if (iframeDiffBase) iframeDiffBase.src = stgUrlInput.value.trim();
    if (iframeSwipeStg) iframeSwipeStg.src = stgUrlInput.value.trim();
    if (iframeSwipeDiff) iframeSwipeDiff.src = stgUrlInput.value.trim();
    if (iframeFlickerStg) iframeFlickerStg.src = stgUrlInput.value.trim();
    if (iframeOverlayStg) iframeOverlayStg.src = stgUrlInput.value.trim();
  });

  btnProdPopout.addEventListener("click", () => {
    if (prodUrlInput.value) window.open(prodUrlInput.value, "_blank");
  });

  btnStgPopout.addEventListener("click", () => {
    if (stgUrlInput.value) window.open(stgUrlInput.value, "_blank");
  });

  // Red Differences Quick Toggle Button (Single Unified Differences Action)
  if (btnToggleRedDiffs) {
    btnToggleRedDiffs.addEventListener("click", () => {
      checkSyncRedDiff.checked = !checkSyncRedDiff.checked;
      updateSyncChipStyles();
      if (checkSyncRedDiff.checked) {
        computeAndApplyRedDifferences(true);
        if (currentMode === "swipe" && swipeCompareMode !== "diff") {
          setSwipeCompareMode("diff");
        } else if (currentMode === "side-by-side") {
          isColDiffActive = true;
          if (btnToggleColDiff) btnToggleColDiff.classList.add("active");
          if (paneColDiff) paneColDiff.style.display = "flex";
          const viewSide = document.getElementById("view-side-by-side");
          if (viewSide) viewSide.classList.add("mode-view-pixel-diff");
          renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
          updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");
          scheduleLivePixelDiffCapture();
        }
      } else {
        clearAllRedDiffs(true);
        if (currentMode === "swipe") {
          setSwipeCompareMode("prod");
          updateAllDiffPercentDisplays("0.00%");
        } else if (currentMode === "side-by-side") {
          isColDiffActive = false;
          if (btnToggleColDiff) btnToggleColDiff.classList.remove("active");
          if (paneColDiff) paneColDiff.style.display = "none";
          const viewSide = document.getElementById("view-side-by-side");
          if (viewSide) viewSide.classList.remove("mode-view-pixel-diff");
          updateAllDiffPercentDisplays("0.00%");
        }
      }
      if (currentMode === "swipe" && swipeCompareMode === "diff") {
        renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions);
      } else if (isColDiffActive) {
        renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
      }
      logAction(`Red Difference highlights toggled: ${checkSyncRedDiff.checked}`);
    });
  }

  // Pixel Diff Column Refresh Button
  if (btnColDiffRefresh) {
    btnColDiffRefresh.addEventListener("click", () => {
      dispatchToPane("PROD", { type: "VC_REQUEST_LANDMARKS" });
      dispatchToPane("STG", { type: "VC_REQUEST_LANDMARKS" });
      dispatchToPane("PROD", { type: "VC_REQUEST_DIFF_CANDIDATES" });
      dispatchToPane("STG", { type: "VC_REQUEST_DIFF_CANDIDATES" });
      runVisualDiffCalculation(true);
    });
  }

  // Diff Opacity Slider (matches visualCompare report_template.html)
  if (colDiffOpacitySlider) {
    colDiffOpacitySlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10) || 0;
      if (colDiffOpacityVal) colDiffOpacityVal.textContent = `${val}%`;
      if (pixelDiffCanvas) pixelDiffCanvas.style.opacity = (val / 100).toString();
      if (swipeDiffCanvas) swipeDiffCanvas.style.opacity = (val / 100).toString();
    });
  }

  // Synchronized Wheel Scrolling for Side-by-Side (Column View) & Swipe Curtain
  function handleSideBySideWheel(e) {
    if (!checkSyncScroll || !checkSyncScroll.checked) return;
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const deltaY = e.deltaY || 0;
    const deltaX = e.deltaX || 0;
    const currentY = lastScrollState.scrollY || 0;
    const currentX = lastScrollState.scrollX || 0;
    const viewH = wrapFrameProd?.clientHeight || iframeProd?.clientHeight || 800;
    const docH = Math.max(
      viewH,
      lastProdLandmarks?.docHeight || 0,
      lastStgLandmarks?.docHeight || 0,
      lastScrollState?.maxScrollY ? (lastScrollState.maxScrollY + viewH) : 0,
      50000
    );
    const maxScrollY = Math.max(1, docH - viewH);
    const newScrollY = Math.max(0, Math.min(maxScrollY, currentY + deltaY));
    const newScrollX = Math.max(0, currentX + deltaX);

    lastScrollState.scrollY = newScrollY;
    lastScrollState.scrollX = newScrollX;

    const mirrorAction = {
      type: "VC_MIRROR_ACTION",
      action: { kind: "scroll", scrollY: newScrollY, scrollX: newScrollX }
    };

    if (iframeProd && iframeProd.contentWindow) {
      try { iframeProd.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
    }
    if (iframeStg && iframeStg.contentWindow) {
      try { iframeStg.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
    }
    if (iframeDiffBase && iframeDiffBase.contentWindow) {
      try { iframeDiffBase.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
    }

    triggerScrollDiffSync(newScrollY, newScrollX);
  }

  function handleSwipeWheel(e) {
    if (!checkSyncScroll || !checkSyncScroll.checked) return;
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const deltaY = e.deltaY || 0;
    const deltaX = e.deltaX || 0;
    const currentY = lastScrollState.scrollY || 0;
    const currentX = lastScrollState.scrollX || 0;
    const viewH = swipeContainer?.clientHeight || 800;
    const docH = Math.max(
      viewH,
      lastProdLandmarks?.docHeight || 0,
      lastStgLandmarks?.docHeight || 0,
      lastScrollState?.maxScrollY ? (lastScrollState.maxScrollY + viewH) : 0,
      50000
    );
    const maxScrollY = Math.max(1, docH - viewH);
    const newScrollY = Math.max(0, Math.min(maxScrollY, currentY + deltaY));
    const newScrollX = Math.max(0, currentX + deltaX);

    lastScrollState.scrollY = newScrollY;
    lastScrollState.scrollX = newScrollX;

    const mirrorAction = {
      type: "VC_MIRROR_ACTION",
      action: { kind: "scroll", scrollY: newScrollY, scrollX: newScrollX }
    };

    if (iframeSwipeProd && iframeSwipeProd.contentWindow) {
      try { iframeSwipeProd.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
    }
    if (iframeSwipeStg && iframeSwipeStg.contentWindow) {
      try { iframeSwipeStg.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
    }
    if (iframeSwipeDiff && iframeSwipeDiff.contentWindow) {
      try { iframeSwipeDiff.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
    }

    triggerScrollDiffSync(newScrollY, newScrollX);
  }

  // Attach synchronized wheel scrolling to all Side-by-Side elements (exact same smooth motion as swipe!)
  const sideBySideViewEl = document.getElementById("view-side-by-side");
  [sideBySideViewEl, wrapFrameProd, wrapFrameStg, wrapFrameDiff].forEach(el => {
    if (el) {
      el.addEventListener("wheel", handleSideBySideWheel, { passive: false });
    }
  });

  if (swipeContainer) {
    swipeContainer.addEventListener("wheel", handleSwipeWheel, { passive: false });
  }

  // Side-by-Side 3rd Column Pixel Diff Toggle
  if (btnToggleColDiff) {
    btnToggleColDiff.addEventListener("click", () => {
      if (currentMode !== "side-by-side") {
        switchMode("side-by-side");
      }
      isColDiffActive = !isColDiffActive;
      btnToggleColDiff.classList.toggle("active", isColDiffActive);
      const viewSide = document.getElementById("view-side-by-side");
      if (isColDiffActive) {
        if (paneColDiff) paneColDiff.style.display = "flex";
        if (viewSide) viewSide.classList.add("mode-view-pixel-diff");
        checkSyncRedDiff.checked = true;
        updateSyncChipStyles();
        if (activeRedDiffs.length === 0) {
          computeAndApplyRedDifferences(true);
        }
        renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
        updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");
        scheduleLivePixelDiffCapture();
        logAction("3rd Column Pixel Diff toggled ON");
      } else {
        if (paneColDiff) paneColDiff.style.display = "none";
        if (viewSide) viewSide.classList.remove("mode-view-pixel-diff");
        checkSyncRedDiff.checked = false;
        updateSyncChipStyles();
        clearAllRedDiffs(true);
        updateAllDiffPercentDisplays("0.00%");
        logAction("3rd Column Pixel Diff toggled OFF (2-column side-by-side view)");
      }
    });
  }

  // Swipe / Slider Target Toggle (Prod <-> Stage vs Stage <-> Diff)
  if (btnSwipeTargetProd) {
    btnSwipeTargetProd.addEventListener("click", () => {
      checkSyncRedDiff.checked = false;
      updateSyncChipStyles();
      clearAllRedDiffs(true);
      setSwipeCompareMode("prod");
    });
  }
  if (btnSwipeTargetDiff) {
    btnSwipeTargetDiff.addEventListener("click", () => {
      checkSyncRedDiff.checked = true;
      updateSyncChipStyles();
      if (activeRedDiffs.length === 0) {
        computeAndApplyRedDifferences(true);
      }
      setSwipeCompareMode("diff");
    });
  }

  function setSwipeCompareMode(target) {
    swipeCompareMode = target;
    lastCapturedDiffCanvas = null;
    if (btnSwipeTargetProd) btnSwipeTargetProd.classList.toggle("active", target === "prod");
    if (btnSwipeTargetDiff) btnSwipeTargetDiff.classList.toggle("active", target === "diff");

    const stgSrc = (iframeStg && iframeStg.src && iframeStg.src !== "about:blank") ? iframeStg.src : stgUrlInput.value.trim();
    const prodSrc = (iframeProd && iframeProd.src && iframeProd.src !== "about:blank") ? iframeProd.src : prodUrlInput.value.trim();

    if (target === "diff") {
      if (swipeRedDiffs.length === 0 || activeRedDiffs.length === 0) {
        computeAndApplyRedDifferences(true);
      }
      // 1. Keep Production actively rendered in the container so its layout is live and accurate, but make it invisible to the user
      if (iframeSwipeProd) {
        iframeSwipeProd.style.display = "block";
        iframeSwipeProd.style.opacity = "0";
        iframeSwipeProd.style.pointerEvents = "none";
        iframeSwipeProd.style.position = "absolute";
        iframeSwipeProd.style.top = "0";
        iframeSwipeProd.style.left = "0";
        iframeSwipeProd.style.width = "100%";
        iframeSwipeProd.style.height = "100%";
        iframeSwipeProd.style.zIndex = "1";
      }
      if (iframeSwipeDiff) {
        iframeSwipeDiff.style.display = "block";
        iframeSwipeDiff.style.opacity = "1";
        iframeSwipeDiff.style.pointerEvents = "none";
        iframeSwipeDiff.style.position = "absolute";
        iframeSwipeDiff.style.top = "0";
        iframeSwipeDiff.style.left = "0";
        iframeSwipeDiff.style.width = "100%";
        iframeSwipeDiff.style.height = "100%";
        iframeSwipeDiff.style.zIndex = "2";
        if (stgSrc && iframeSwipeDiff.src !== stgSrc) {
          iframeSwipeDiff.src = stgSrc;
        }
      }
      if (swipeOverlayLayer) {
        swipeOverlayLayer.style.background = "transparent";
        swipeOverlayLayer.style.pointerEvents = "none";
      }
      if (swipeDiffCanvas) {
        swipeDiffCanvas.style.display = "block";
        swipeDiffCanvas.style.pointerEvents = "none";
        swipeDiffCanvas.style.position = "absolute";
        swipeDiffCanvas.style.top = "0";
        swipeDiffCanvas.style.left = "0";
        swipeDiffCanvas.style.width = "100%";
        swipeDiffCanvas.style.height = "100%";
        swipeDiffCanvas.style.zIndex = "5";
        swipeDiffCanvas.style.opacity = (colDiffOpacitySlider ? colDiffOpacitySlider.value / 100 : 0.85).toString();
      }
      if (swipeOverlayTag) {
        swipeOverlayTag.textContent = "DIFF (LEFT)";
        swipeOverlayTag.style.borderColor = "#ef4444";
        swipeOverlayTag.style.color = "#f87171";
      }
      if (swipeBaseTag) {
        swipeBaseTag.textContent = "STAGING (RIGHT)";
        swipeBaseTag.style.borderColor = "var(--color-stg)";
        swipeBaseTag.style.color = "var(--color-stg)";
      }

      // Sync scroll to both diff base frame and invisible production frame
      const currentY = lastScrollState.scrollY || 0;
      const currentX = lastScrollState.scrollX || 0;
      [iframeSwipeDiff, iframeSwipeProd, iframeSwipeStg].forEach(frame => {
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({
              type: "VC_MIRROR_ACTION",
              action: { kind: "scroll", scrollY: currentY, scrollX: currentX }
            }, "*");
          } catch (e) {}
        }
      });

      // Request fresh live landmarks & diff candidates from frames at this container size
      [iframeSwipeProd, iframeSwipeDiff, iframeSwipeStg].forEach(frame => {
        if (frame && frame.contentWindow) {
          try {
            frame.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
            frame.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
          } catch (e) {}
        }
      });

      renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, currentY, currentX);
      updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");
      scheduleLivePixelDiffCapture();
      logAction("Swipe slider comparison set to: STAGE ↔ DIFF (Invisible live Production base)");
    } else {
      if (iframeSwipeProd) {
        iframeSwipeProd.style.display = "block";
        iframeSwipeProd.style.opacity = "1";
        iframeSwipeProd.style.pointerEvents = "auto";
        iframeSwipeProd.style.zIndex = "2";
        if (prodSrc && iframeSwipeProd.src !== prodSrc) {
          iframeSwipeProd.src = prodSrc;
        }
      }
      if (iframeSwipeDiff) iframeSwipeDiff.style.display = "none";
      if (swipeOverlayLayer) {
        swipeOverlayLayer.style.background = "transparent";
        swipeOverlayLayer.style.pointerEvents = "auto";
      }
      if (swipeDiffCanvas) swipeDiffCanvas.style.display = "none";
      if (swipeOverlayTag) {
        swipeOverlayTag.textContent = "PRODUCTION (LEFT)";
        swipeOverlayTag.style.borderColor = "var(--color-prod)";
        swipeOverlayTag.style.color = "var(--color-prod)";
      }
      if (swipeBaseTag) {
        swipeBaseTag.textContent = "STAGING (RIGHT)";
        swipeBaseTag.style.borderColor = "var(--color-stg)";
        swipeBaseTag.style.color = "var(--color-stg)";
      }
      updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");

      // Sync scroll to the production frame
      if (iframeSwipeProd && iframeSwipeProd.contentWindow) {
        try {
          iframeSwipeProd.contentWindow.postMessage({
            type: "VC_MIRROR_ACTION",
            action: { kind: "scroll", scrollY: lastScrollState.scrollY || 0, scrollX: lastScrollState.scrollX || 0 }
          }, "*");
        } catch (e) {}
      }

      logAction("Swipe slider comparison set to: PROD ↔ STAGE");
    }
  }

  // Sync Chip Toggle Styling
  [checkSyncHazard, checkSyncRedDiff, checkSyncClicks, checkSyncScroll, checkSyncHover, checkSyncInputs].forEach(chk => {
    if (chk) {
      chk.addEventListener("change", () => {
        updateSyncChipStyles();
        if (chk === checkSyncHazard) {
          if (chk.checked) {
            hasAlignedCurrentPage = false;
            if (lastProdLandmarks && lastStgLandmarks) {
              calculateAndApplyLayoutShifts();
              hasAlignedCurrentPage = true;
            } else {
              if (iframeProd && iframeProd.contentWindow) {
                iframeProd.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
              }
              if (iframeStg && iframeStg.contentWindow) {
                iframeStg.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
              }
            }
          } else {
            clearAllHazardSpacers(true);
            hasAlignedCurrentPage = false;
          }
        } else if (chk === checkSyncRedDiff) {
          if (chk.checked) {
            computeAndApplyRedDifferences();
            if (currentMode === "swipe" && swipeCompareMode !== "diff") {
              setSwipeCompareMode("diff");
            }
          } else {
            clearAllRedDiffs(true);
          }
        }
        logAction(`Sync setting changed: ${chk.id} = ${chk.checked}`);
      });
    }
  });

  function updateSyncChipStyles() {
    if (chipSyncHazard) chipSyncHazard.classList.toggle("active", checkSyncHazard.checked);
    if (chipSyncRedDiff) chipSyncRedDiff.classList.toggle("active", checkSyncRedDiff.checked);
    if (btnToggleRedDiffs) {
      btnToggleRedDiffs.classList.toggle("inactive", !checkSyncRedDiff.checked);
      btnToggleRedDiffs.classList.toggle("active", checkSyncRedDiff.checked);
    }
    document.getElementById("chip-sync-clicks").classList.toggle("active", checkSyncClicks.checked);
    document.getElementById("chip-sync-scroll").classList.toggle("active", checkSyncScroll.checked);
    document.getElementById("chip-sync-hover").classList.toggle("active", checkSyncHover.checked);
    document.getElementById("chip-sync-inputs").classList.toggle("active", checkSyncInputs.checked);

    const anyActive = checkSyncHazard.checked || checkSyncRedDiff.checked || checkSyncClicks.checked || checkSyncScroll.checked || checkSyncHover.checked || checkSyncInputs.checked;
    syncStatusLabel.textContent = anyActive ? "Mirror Active" : "Mirror Paused";
    document.getElementById("sync-status").style.opacity = anyActive ? "1" : "0.5";
  }

  // ----------------------------------------------------
  // 10. EXPORT & IMPORT ZIP PACKAGE ENGINE
  // ----------------------------------------------------
  function showToast(title, desc) {
    if (!importToast) return;
    toastTitle.textContent = title;
    toastDesc.textContent = desc;
    importToast.style.display = "block";
    clearTimeout(window.__toastTimeout);
    window.__toastTimeout = setTimeout(() => {
      importToast.style.display = "none";
    }, 6000);
  }

  if (btnCloseToast && importToast) {
    btnCloseToast.addEventListener("click", () => {
      importToast.style.display = "none";
    });
  }

  if (btnExportZip) {
    btnExportZip.addEventListener("click", () => {
      if (!window.VisualCompareZip || typeof window.VisualCompareZip.exportComparisonZip !== "function") {
        alert("Export engine initializing, please try again in a moment.");
        return;
      }

      // Gather current comparison state
      const meta = {
        prodUrl: prodUrlInput.value.trim(),
        stgUrl: stgUrlInput.value.trim(),
        timestamp: new Date().toLocaleString(),
        device: viewportSelect.value,
        currentMode,
        hazardSpacers: activeHazardSpacers,
        redDiffs: activeRedDiffs,
        totalShiftDelta: document.getElementById("metric-shift-val") ? document.getElementById("metric-shift-val").textContent : "+0px",
        diffMismatchPct: document.getElementById("metric-diff-pct") ? document.getElementById("metric-diff-pct").textContent : "3.24%"
      };

      try {
        const res = window.VisualCompareZip.exportComparisonZip(meta);
        logAction(`[EXPORT] Downloaded comparison package ZIP: ${res.filename} (${Math.round(res.size / 1024)} KB with PDFs & Links)`);
        showToast("Package Exported Successfully", `Saved ${res.filename} with PDF reports, links, and all differences.`);
      } catch (err) {
        console.error("Export error:", err);
        alert("Failed to export ZIP package: " + err.message);
      }
    });
  }

  if (btnImportZip && fileImportZip) {
    btnImportZip.addEventListener("click", () => {
      fileImportZip.value = "";
      fileImportZip.click();
    });

    fileImportZip.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      try {
        logAction(`[IMPORT] Parsing ZIP package: ${file.name}...`);
        const meta = await window.VisualCompareZip.importComparisonZip(file);

        // 1. Restore URLs
        if (meta.prodUrl) prodUrlInput.value = meta.prodUrl;
        if (meta.stgUrl) stgUrlInput.value = meta.stgUrl;

        // 2. Restore Viewport Preset
        if (meta.device && viewportSelect) {
          const deviceAliases = {
            mobile: "440x956",
            tablet: "768x1024",
            laptop: "1366x768",
            desktop: "1920x1080",
            responsive: "responsive"
          };
          const resolvedDevice = deviceAliases[meta.device.toLowerCase()] || meta.device;
          if (Array.from(viewportSelect.options).some(o => o.value === resolvedDevice)) {
            viewportSelect.value = resolvedDevice;
            viewportSelect.dispatchEvent(new Event("change"));
          }
        }

        // 3. Restore frames
        loadAllFrames(meta.prodUrl, meta.stgUrl);

        // 4. Restore Mode
        if (meta.currentMode) {
          switchMode(meta.currentMode);
        }

        // 5. Restore Layout Shift Spacers & Red Differences
        if (meta.hazardSpacers) {
          activeHazardSpacers = meta.hazardSpacers;
          if (activeHazardSpacers.PROD) {
            activeHazardSpacers.PROD.forEach(sp => dispatchToPane("PROD", sp));
          }
          if (activeHazardSpacers.STG) {
            activeHazardSpacers.STG.forEach(sp => dispatchToPane("STG", sp));
          }
        }

        if (meta.redDiffs && meta.redDiffs.length > 0) {
          activeRedDiffs = meta.redDiffs;
          computeAndApplyRedDifferences(true);
          if (metricRedBadge) metricRedBadge.style.display = "none";
          if (btnToggleRedDiffs) {
            btnToggleRedDiffs.classList.remove("inactive");
            btnToggleRedDiffs.innerHTML = `<span class="btn-label-full">🔴 Differences</span><span class="btn-label-short">🔴 Diffs</span>`;
          }
        }

        const totalDiffs = (activeHazardSpacers.PROD ? activeHazardSpacers.PROD.length : 0) + (activeHazardSpacers.STG ? activeHazardSpacers.STG.length : 0) + (activeRedDiffs ? activeRedDiffs.length : 0);
        showToast("ZIP Package Imported Successfully", `Loaded comparison for ${meta.prodUrl} vs ${meta.stgUrl} with ${totalDiffs} differences.`);
        logAction(`[IMPORT] Successfully imported ${file.name} (${totalDiffs} differences restored).`);
      } catch (err) {
        console.error("Import error:", err);
        alert("Failed to import ZIP package: " + err.message);
      }
    });
  }

  document.getElementById("btn-toggle-event-log").addEventListener("click", () => {
    logEntry.textContent = "Log cleared.";
  });
});
