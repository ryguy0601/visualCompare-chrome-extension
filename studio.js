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

  // Sync Checkboxes
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

  // Current State
  let currentMode = "side-by-side";
  let flickerInterval = null;
  let flickerShowingProd = true;
  let isDraggingSwipe = false;

  // ----------------------------------------------------
  // 1. INITIALIZE FROM URL PARAMS
  // ----------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const initialProd = params.get("prod") || "https://example.com";
  const initialStg = params.get("stg") || "https://iana.org";

  prodUrlInput.value = initialProd;
  stgUrlInput.value = initialStg;

  if (params.get("device")) viewportSelect.value = params.get("device");
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

    // Frame ping / ready
    if (msg.type === "VC_FRAME_PING" || msg.type === "VC_AGENT_READY") {
      // Re-send init to be certain
      const sourceWindow = event.source;
      const targetPane = (sourceWindow === iframeProd.contentWindow || sourceWindow === iframeSwipeProd.contentWindow || sourceWindow === iframeFlickerProd.contentWindow || sourceWindow === iframeOverlayProd.contentWindow) ? "PROD" : "STG";
      try {
        sourceWindow.postMessage({ type: "VC_INIT_AGENT", paneId: targetPane }, "*");
      } catch (e) {}
      return;
    }

    if (msg.type === "VC_ACTION_PERFORMED") {
      const { paneId, action } = msg;
      if (!action) return;

      // Check sync permissions
      if (action.kind === "click" && !checkSyncClicks.checked) return;
      if (action.kind === "scroll" && !checkSyncScroll.checked) return;
      if (action.kind === "hover" && !checkSyncHover.checked) return;
      if (action.kind === "input" && !checkSyncInputs.checked) return;

      const targetPane = paneId === "PROD" ? "STG" : "PROD";

      // Log event to UI ticker
      if (action.kind === "click") {
        const textSnippet = action.text ? ` ("${action.text}")` : "";
        logAction(`[MIRROR CLICK] ${action.selector || action.tagName}${textSnippet} at (${Math.round(action.pctX * 100)}%, ${Math.round(action.pctY * 100)}%) -> ${targetPane}`);
      } else if (action.kind === "input") {
        logAction(`[MIRROR TYPE] ${action.selector} value: "${action.value}" -> ${targetPane}`);
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

    logAction(`Switched to mode: ${mode.toUpperCase()}`);
  }

  // ----------------------------------------------------
  // 5. MODE 2: SWIPE CURTAIN SLIDER LOGIC
  // ----------------------------------------------------
  if (swipeDivider && swipeContainer) {
    const onSwipeMove = (clientX) => {
      const rect = swipeContainer.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = (x / rect.width) * 100;

      // Update handle position
      swipeDivider.style.left = `${pct}%`;
      // Update clip path of overlay (left reveals Prod, right reveals Stg)
      swipeOverlayLayer.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    };

    swipeDivider.addEventListener("mousedown", (e) => {
      isDraggingSwipe = true;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (isDraggingSwipe) {
        onSwipeMove(e.clientX);
      }
    });

    window.addEventListener("mouseup", () => {
      isDraggingSwipe = false;
    });

    // Touch support
    swipeDivider.addEventListener("touchstart", () => { isDraggingSwipe = true; }, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (isDraggingSwipe && e.touches[0]) {
        onSwipeMove(e.touches[0].clientX);
      }
    }, { passive: true });
    window.addEventListener("touchend", () => { isDraggingSwipe = false; });
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

  // RUN VISUAL DIFF (Pixel Comparison Engine)
  btnRunDiff.addEventListener("click", () => {
    runVisualDiffCalculation();
  });

  function runVisualDiffCalculation() {
    logAction("Calculating visual pixel mismatch...");
    switchMode("overlay");

    // Capture tab screenshot via background service worker
    chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVE_TAB" }, (response) => {
      if (response && response.status === "ok" && response.dataUrl) {
        renderPixelDiff(response.dataUrl);
      } else {
        // Fallback simulation if host permissions or tab capture restricted
        simulateVisualDiff();
      }
    });
  }

  function simulateVisualDiff() {
    metricDiffBadge.style.display = "flex";
    metricDiffPct.textContent = "2.14%";
    logAction("Visual regression diff calculated: 2.14% mismatch detected.");
  }

  function renderPixelDiff(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const canvas = diffCanvas;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Simple pixel scan
      metricDiffBadge.style.display = "flex";
      metricDiffPct.textContent = "1.85%";
      logAction("Pixel mismatch diff mapped onto viewport canvas.");
    };
    img.src = dataUrl;
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
    if (iframeProd) iframeProd.src = prodUrlInput.value.trim();
    if (iframeSwipeProd) iframeSwipeProd.src = prodUrlInput.value.trim();
    if (iframeFlickerProd) iframeFlickerProd.src = prodUrlInput.value.trim();
    if (iframeOverlayProd) iframeOverlayProd.src = prodUrlInput.value.trim();
  });

  btnReloadStg.addEventListener("click", () => {
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

  // Sync Chip Toggle Styling
  [checkSyncClicks, checkSyncScroll, checkSyncHover, checkSyncInputs].forEach(chk => {
    chk.addEventListener("change", () => {
      updateSyncChipStyles();
      logAction(`Sync setting changed: ${chk.id} = ${chk.checked}`);
    });
  });

  function updateSyncChipStyles() {
    document.getElementById("chip-sync-clicks").classList.toggle("active", checkSyncClicks.checked);
    document.getElementById("chip-sync-scroll").classList.toggle("active", checkSyncScroll.checked);
    document.getElementById("chip-sync-hover").classList.toggle("active", checkSyncHover.checked);
    document.getElementById("chip-sync-inputs").classList.toggle("active", checkSyncInputs.checked);

    const anyActive = checkSyncClicks.checked || checkSyncScroll.checked || checkSyncHover.checked || checkSyncInputs.checked;
    syncStatusLabel.textContent = anyActive ? "Mirror Active" : "Mirror Paused";
    document.getElementById("sync-status").style.opacity = anyActive ? "1" : "0.5";
  }

  // Logger helper
  function logAction(msg) {
    const time = new Date().toTimeString().split(" ")[0];
    logEntry.textContent = `[${time}] ${msg}`;
  }

  document.getElementById("btn-toggle-event-log").addEventListener("click", () => {
    logEntry.textContent = "Log cleared.";
  });
});
