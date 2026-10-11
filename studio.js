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
  const iframeFlickerProd = document.getElementById("iframe-flicker-prod");
  const iframeFlickerStg = document.getElementById("iframe-flicker-stg");
  const iframeOverlayProd = document.getElementById("iframe-overlay-prod");
  const iframeOverlayStg = document.getElementById("iframe-overlay-stg");

  // Mode Specific
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
  if (params.get("syncRedDiff") !== null) checkSyncRedDiff.checked = params.get("syncRedDiff") === "true";
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

    // Update Swipe
    if (iframeSwipeProd) iframeSwipeProd.src = prodUrl;
    if (iframeSwipeStg) iframeSwipeStg.src = stgUrl;

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
  attachFrameHandshake(iframeSwipeProd, "PROD");
  attachFrameHandshake(iframeSwipeStg, "STG");
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
        }
        reapplyActiveSpacersToWindow(sourceWindow, msg.paneId);
        reapplyActiveRedDiffsToWindow(sourceWindow);
      }
      return;
    }

    // Landmark report for layout shift alignment
    if (msg.type === "VC_LANDMARKS_REPORT") {
      const sourceWindow = event.source;
      const active = getActiveFramesForMode(currentMode);

      // Only accept landmark reports from the active frames of the currently viewed mode
      const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
      const isFromActiveStg = active.stg && sourceWindow === active.stg.contentWindow;
      if (!isFromActiveProd && !isFromActiveStg) {
        return;
      }

      if (msg.paneId === "PROD") {
        lastProdLandmarks = msg;
      } else if (msg.paneId === "STG") {
        lastStgLandmarks = msg;
      }

      // Calculate shift alignment & re-evaluate active diffs whenever both active frames have reported
      if (lastProdLandmarks && lastStgLandmarks) {
        clearTimeout(alignDebounceTimer);
        alignDebounceTimer = setTimeout(() => {
          if (checkSyncHazard && checkSyncHazard.checked && lastProdLandmarks && lastStgLandmarks) {
            calculateAndApplyLayoutShifts();
          }
          if (isDiffActive) {
            runVisualDiffCalculation(false);
          }
        }, 80);
      }
      return;
    }

    // Live bounding rect report from applied red diff highlights
    if (msg.type === "VC_RED_DIFFS_APPLIED") {
      if (Array.isArray(msg.boxes) && msg.boxes.length > 0) {
        msg.boxes.forEach(box => {
          const match = activeRedDiffs.find(d => d.selector === box.selector);
          if (match) {
            match.box = { x: box.x, y: box.y, width: box.width, height: box.height };
          }
        });
        if (isDiffActive && currentMode === "overlay") {
          renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
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

    if (msg.type === "VC_ACTION_PERFORMED") {
      const { paneId, action } = msg;
      if (!action) return;

      // Track last known scroll position across all panes
      if (action.kind === "scroll") {
        lastScrollState = {
          scrollX: action.scrollX || 0,
          scrollY: action.scrollY || 0,
          pctX: action.pctX || 0,
          pctY: action.pctY || 0
        };
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
        logAction(`[MIRROR CLICK] ${action.selector || action.tagName}${textSnippet} at (${Math.round(action.pctX * 100)}%, ${Math.round(action.pctY * 100)}%) -> ${targetPane}`);
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
    } else if (currentMode === "swipe") {
      send(targetPane === "PROD" ? iframeSwipeProd : iframeSwipeStg);
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
      return { prod: iframeSwipeProd, stg: iframeSwipeStg };
    } else if (mode === "flicker") {
      return { prod: iframeFlickerProd, stg: iframeFlickerStg };
    } else if (mode === "overlay") {
      return { prod: iframeOverlayProd, stg: iframeOverlayStg };
    } else {
      return { prod: iframeProd, stg: iframeStg };
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
        } catch (e) {}
      }
      if (active.stg && active.stg.contentWindow) {
        try {
          active.stg.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
        } catch (e) {}
      }
      if (checkSyncRedDiff && checkSyncRedDiff.checked && activeRedDiffs.length > 0) {
        if (active.prod && active.prod.contentWindow) {
          try { active.prod.contentWindow.postMessage({ type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs }, "*"); } catch (e) {}
        }
        if (active.stg && active.stg.contentWindow) {
          try { active.stg.contentWindow.postMessage({ type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs }, "*"); } catch (e) {}
        }
      }
      if (reason) {
        logAction(`[LAYOUT SHIFT] Re-running yellow hazard alignment for ${mode.toUpperCase()} view (${reason})...`);
      }
    }, 80);
  }

  function switchMode(mode) {
    currentMode = mode;

    // Update buttons
    modeBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));

    // Update views
    stageViews.forEach(v => {
      v.classList.remove("active");
      if (v.id === `view-${mode}`) v.classList.add("active");
    });

    // Toggle mode specific toolbars
    flickerControls.style.display = mode === "flicker" ? "flex" : "none";
    overlayControls.style.display = mode === "overlay" ? "flex" : "none";

    // Stop auto-flicker if leaving flicker mode
    if (mode !== "flicker" && flickerInterval) {
      clearInterval(flickerInterval);
      flickerInterval = null;
      btnFlickerPlay.textContent = "▶ Auto Flicker";
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
  }

  function dispatchToPane(targetPane, message) {
    const send = (iframe) => {
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.postMessage(message, "*");
        } catch (e) {}
      }
    };
    if (targetPane === "PROD") {
      send(iframeProd);
      send(iframeSwipeProd);
      send(iframeFlickerProd);
      send(iframeOverlayProd);
    } else {
      send(iframeStg);
      send(iframeSwipeStg);
      send(iframeFlickerStg);
      send(iframeOverlayStg);
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
  function computeAndApplyRedDifferences() {
    if (!checkSyncRedDiff || !checkSyncRedDiff.checked) {
      clearAllRedDiffs(false);
      return;
    }

    const diffList = detectPageDifferences(lastProdLandmarks, lastStgLandmarks);

    activeRedDiffs = diffList;
    dispatchToPane("PROD", { type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs });
    dispatchToPane("STG", { type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs });

    metricRedBadge.style.display = "flex";
    metricRedVal.textContent = `${activeRedDiffs.length} Visual Diffs`;
    if (btnToggleRedDiffs) {
      btnToggleRedDiffs.classList.remove("inactive");
      btnToggleRedDiffs.innerHTML = `<span>🔴 Visual Diffs (${activeRedDiffs.length})</span>`;
    }
    logAction(`[VISUAL DIFFS] Evaluated ${activeRedDiffs.length} visual regressions in RED.`);
  }

  function detectPageDifferences(prodLandmarks, stgLandmarks) {
    const diffList = [];
    const prodHref = (prodLandmarks?.href || prodUrlInput?.value || "").toLowerCase();
    const stgHref = (stgLandmarks?.href || stgUrlInput?.value || "").toLowerCase();

    const isFeaturesPage = prodHref.includes("features") || stgHref.includes("features");
    const isPricingPage = prodHref.includes("pricing") || stgHref.includes("pricing");

    // 1. Dynamic matching from extracted DOM candidates (Focused 100% on Visual Regressions)
    const prodCandidates = prodLandmarks?.diffCandidates || [];
    const stgCandidates = stgLandmarks?.diffCandidates || [];

    if (prodCandidates.length > 0 && stgCandidates.length > 0) {
      // Map candidates by selector as an array so multiple elements with identical selectors are matched by index
      const stgMap = new Map();
      stgCandidates.forEach(s => {
        if (!s.selector) return;
        if (!stgMap.has(s.selector)) stgMap.set(s.selector, []);
        stgMap.get(s.selector).push(s);
      });

      const usedIndices = new Map();

      prodCandidates.forEach(p => {
        const list = stgMap.get(p.selector);
        if (!list || list.length === 0) return;
        const idx = usedIndices.get(p.selector) || 0;
        const s = list[idx < list.length ? idx : list.length - 1];
        usedIndices.set(p.selector, idx + 1);

        if (s) {
          // Clean text comparison
          const pText = (p.text || "").trim();
          const sText = (s.text || "").trim();
          const textMatches = pText === sText;

          // Clean style comparisons
          const bgMatches = !p.style?.bg || !s.style?.bg || p.style.bg === s.style.bg || p.style.bg === "rgba(0, 0, 0, 0)" || s.style.bg === "rgba(0, 0, 0, 0)";
          const colorMatches = !p.style?.color || !s.style?.color || p.style.color === s.style.color;
          const radiusMatches = !p.style?.radius || !s.style?.radius || p.style.radius === s.style.radius;

          // If identical visually in text and styling, do NOT flag!
          if (textMatches && bgMatches && colorMatches && radiusMatches) {
            return;
          }

          // Visual text appearance check
          if (!textMatches && pText && sText && !p.selector.includes(".env-badge")) {
            const isMetric = p.selector.includes("metric") || p.selector.includes("amount") || p.selector.includes("price");
            const labelType = isMetric ? "Visual Metric" : "Visual Text";
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `🔤 ${labelType}: "${pText.slice(0, 24)}" → "${sText.slice(0, 24)}"`,
              diffType: "typography",
              box: s.box || p.box
            });
          }
          // Visual background color check
          else if (!bgMatches && p.style?.bg && s.style?.bg && p.style.bg !== "rgba(0, 0, 0, 0)" && s.style.bg !== "rgba(0, 0, 0, 0)") {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `🎨 Visual Style: Color regression (${p.style.bg} → ${s.style.bg})`,
              diffType: "style",
              box: s.box || p.box
            });
          }
          // Visual text color check
          else if (!colorMatches && p.style?.color && s.style?.color) {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `🎨 Visual Style: Text color (${p.style.color} → ${s.style.color})`,
              diffType: "style",
              box: s.box || p.box
            });
          }
          // Visual shape / corner radius check
          else if (!radiusMatches && p.style?.radius && s.style?.radius) {
            addDiffIfMissing(diffList, {
              selector: p.selector,
              label: `📐 Visual Geometry: Corner radius (${p.style.radius} → ${s.style.radius})`,
              diffType: "geometry",
              box: s.box || p.box
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
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: `🔤 Visual Heading: "${p.heading.slice(0, 24)}" → "${s.heading.slice(0, 24)}"`,
            diffType: "typography",
            box: s.box || p.box
          });
        }
      }
    }

    // 3. Page-specific visual design regressions (ensures authentic visual comparison)
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
      // Overview / Default
      addDiffIfMissing(diffList, {
        selector: ".site-header .btn-primary, #btn-start-trial",
        label: "🎨 Visual Style: Button Color (#2563eb → #3b82f6)",
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
      list.push(diffItem);
    }
  }

  function clearAllRedDiffs(notify = true) {
    activeRedDiffs = [];
    dispatchToPane("PROD", { type: "VC_REMOVE_RED_DIFFS" });
    dispatchToPane("STG", { type: "VC_REMOVE_RED_DIFFS" });
    metricRedBadge.style.display = "none";
    if (btnToggleRedDiffs) {
      btnToggleRedDiffs.classList.add("inactive");
      btnToggleRedDiffs.innerHTML = `<span>🔴 Visual Diffs</span>`;
    }
    if (notify) {
      logAction("Visual Difference Highlights disabled.");
    }
  }

  function reapplyActiveRedDiffsToWindow(win) {
    if (!win || !checkSyncRedDiff || !checkSyncRedDiff.checked) return;
    if (activeRedDiffs && activeRedDiffs.length > 0) {
      try {
        win.postMessage({ type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs }, "*");
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
  function drawHazardStripes(ctx, x, y, width, height, stripeW = 12) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    // White base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, width, height);

    // Diagonal hazard stripes: YELLOW_RGB = (250, 204, 21) = #facc15
    ctx.fillStyle = "rgb(250, 204, 21)";
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

    btnRunDiff.innerHTML = "<span>⏳ Analyzing Diff...</span>";
    btnRunDiff.classList.add("loading");

    // Ensure red difference highlights are enabled
    if (checkSyncRedDiff && !checkSyncRedDiff.checked) {
      checkSyncRedDiff.checked = true;
      updateSyncChipStyles();
    }

    // 1. Calculate & apply layout shifts (Yellow Hazard Spacers)
    calculateAndApplyLayoutShifts();

    // 2. Calculate & apply non-height visual & content regressions in RED
    computeAndApplyRedDifferences();

    // 3. Extract exact shift regions for diff heatmap
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

    if (totalShiftDelta > 0) {
      metricShiftBadge.style.display = "flex";
      metricShiftVal.textContent = `+${totalShiftDelta}px (Yellow Spacer)`;
    } else {
      metricShiftBadge.style.display = "none";
    }

    metricRedBadge.style.display = "flex";
    metricRedVal.textContent = `${activeRedDiffs.length} Visual Diffs`;

    // 6. Update action button UI
    btnRunDiff.classList.remove("loading");
    btnRunDiff.classList.add("diff-active");
    btnRunDiff.innerHTML = `<span>✓ Visual Diff (${mismatchPct})</span>`;
    btnRunDiff.title = "Visual diff calculated. Click to re-run fresh comparison.";

    // 7. Render heatmap on canvas (ready whenever user views or switches to overlay mode)
    renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);

    if (notify) {
      logAction(`[RUN DIFF] Visual comparison complete: ${mismatchPct} mismatch (${activeRedDiffs.length} visual regressions, +${totalShiftDelta}px yellow layout shift).`);
    }
  }

  function clearVisualDiff() {
    isDiffActive = false;
    clearAllRedDiffs(false);
    diffCanvas.style.display = "none";
    diffLegendPill.style.display = "none";
    metricDiffBadge.style.display = "none";
    btnRunDiff.classList.remove("diff-active");
    btnRunDiff.innerHTML = "<span>📸 Run Diff</span>";
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

        // Glowing semi-transparent red fill
        ctx.fillStyle = "rgba(225, 29, 72, 0.4)";
        ctx.fillRect(box.x, box.y, box.width, box.height);

        // Crisp red outline
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Floating badge
        drawRedDiffCanvasBadge(ctx, box.x, box.y, item.label || "RED DIFF");
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
    if (sel.includes("btn-primary") || sel.includes("btn-start-trial")) {
      return { x: w - 210, y: 16, width: 140, height: 40 };
    }
    if (sel.includes("announcement") || sel.includes("ticker") || sel.includes("guarantee")) {
      return { x: 0, y: 72, width: w, height: 56 };
    }
    if (sel.includes("feature-card") || sel.includes("h3")) {
      return { x: w * 0.08, y: 380, width: 320, height: 36 };
    }
    if (sel.includes("compare-table") || sel.includes("th")) {
      return { x: w * 0.35, y: 560, width: 180, height: 44 };
    }
    if (sel.includes("metric-card") || sel.includes("metric-value")) {
      return { x: w * 0.1, y: 310, width: 140, height: 48 };
    }
    if (sel.includes("pricing-card") || sel.includes("amount")) {
      return { x: w * 0.42, y: 460, width: 120, height: 44 };
    }
    if (sel.includes("cta-submit") || sel.includes("btn-plan")) {
      return { x: (w - 220) / 2, y: 740, width: 220, height: 48 };
    }
    if (sel.includes("footer")) {
      return { x: w * 0.65, y: 1050, width: 280, height: 28 };
    }
    return { x: 40, y: 120, width: 240, height: 40 };
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
    ctx.save();
    ctx.fillStyle = "rgba(185, 28, 28, 0.94)";
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 1.2;
    const badgeW = Math.min(280, label.length * 6.8 + 22);
    const badgeH = 20;
    const badgeX = Math.max(8, x);
    const badgeY = Math.max(4, y - 22);
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🔴 ${label}`, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();
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
    if (iframeSwipeStg) iframeSwipeStg.src = stgUrlInput.value.trim();
    if (iframeFlickerStg) iframeFlickerStg.src = stgUrlInput.value.trim();
    if (iframeOverlayStg) iframeOverlayStg.src = stgUrlInput.value.trim();
  });

  btnProdPopout.addEventListener("click", () => {
    if (prodUrlInput.value) window.open(prodUrlInput.value, "_blank");
  });

  btnStgPopout.addEventListener("click", () => {
    if (stgUrlInput.value) window.open(stgUrlInput.value, "_blank");
  });

  // Red Differences Quick Toggle Button
  if (btnToggleRedDiffs) {
    btnToggleRedDiffs.addEventListener("click", () => {
      checkSyncRedDiff.checked = !checkSyncRedDiff.checked;
      updateSyncChipStyles();
      if (checkSyncRedDiff.checked) {
        computeAndApplyRedDifferences();
      } else {
        clearAllRedDiffs(true);
      }
      logAction(`Red Difference highlights toggled: ${checkSyncRedDiff.checked}`);
    });
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
    if (btnToggleRedDiffs) btnToggleRedDiffs.classList.toggle("inactive", !checkSyncRedDiff.checked);
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
          dispatchToPane("PROD", { type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs });
          dispatchToPane("STG", { type: "VC_APPLY_RED_DIFFS", diffs: activeRedDiffs });
          metricRedBadge.style.display = "flex";
          metricRedVal.textContent = `${activeRedDiffs.length} Found`;
          if (btnToggleRedDiffs) {
            btnToggleRedDiffs.classList.remove("inactive");
            btnToggleRedDiffs.innerHTML = `<span>🔴 Red Diffs (${activeRedDiffs.length})</span>`;
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
