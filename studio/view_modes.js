/**
 * VisualCompare Live - Studio: View modes: switcher, swipe, flicker, ghost overlay
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

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
    return { prod: iframeProd, stg: iframeStg, diff: iframeDiffBase, baseStg: iframeStg };
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
      if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
        applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
      }

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
      if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
        applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
      }
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
    if (checkSyncRedDiff && checkSyncRedDiff.checked) {
      if (activeRedDiffs.length === 0) {
        activeRedDiffs = detectPageDifferences(lastProdLandmarks, lastStgLandmarks);
      }
      renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
    } else {
      if (diffCanvas) diffCanvas.style.display = "none";
      if (diffLegendPill) diffLegendPill.style.display = "none";
    }
  }

  // Sync scroll to the newly visible frames
  const active = getActiveFramesForMode(mode);
  syncScrollToFrames([active.prod, active.stg]);

  // Re-run the yellow hazard alignment specifically for this new view type!
  runHazardAlignmentForMode(mode, `View type changed to ${mode.toUpperCase()}`);

  // If switching to overlay and diff is active, render diff heatmap onto canvas
  if (mode === "overlay" && isDiffActive) {
    setTimeout(() => {
      renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
    }, 100);
  }

  if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
    applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
  }
}

const setMode = switchMode;

// ----------------------------------------------------
// 5. MODE 2: SWIPE CURTAIN SLIDER LOGIC
// ----------------------------------------------------
if (swipeDivider && swipeContainer) {
  let currentSwipePct = 50;
  let swipeRafId = null;

  const updateSwipePosition = (pct) => {
    currentSwipePct = Math.max(0, Math.min(100, pct));
    window.__vcSwipePct = currentSwipePct;
    if (swipeRafId) cancelAnimationFrame(swipeRafId);
    swipeRafId = requestAnimationFrame(() => {
      swipeDivider.style.left = `${currentSwipePct}%`;
      swipeOverlayLayer.style.clipPath = `inset(0 ${100 - currentSwipePct}% 0 0)`;
      swipeRafId = null;
    });
  };
  window.__vcUpdateSwipePosition = updateSwipePosition;
  window.__vcSwipePct = currentSwipePct;

  swipeDivider.addEventListener("dblclick", (e) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation();
    updateSwipePosition(50);
  });

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

// Global Keyboard Shortcuts for Pro Workflow
window.addEventListener("keydown", (e) => {
  // Ignore hotkeys when user is typing in inputs or select dropdowns
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.isContentEditable)) {
    return;
  }

  if (e.key === "Escape") {
    if (gofullpageViewerModal) gofullpageViewerModal.style.display = "none";
    if (pdfExportModal) pdfExportModal.style.display = "none";
    if (shortcutsModal) shortcutsModal.style.display = "none";
    return;
  }

  if (e.key === "1") {
    setMode("side-by-side");
  } else if (e.key === "2") {
    setMode("swipe");
  } else if (e.key === "3") {
    setMode("flicker");
  } else if (e.key === "4") {
    setMode("overlay");
  } else if (e.key === "d" || e.key === "D") {
    if (btnToggleRedDiffs) btnToggleRedDiffs.click();
  } else if (e.key === "s" || e.key === "S") {
    if (btnSwapUrls) btnSwapUrls.click();
  } else if (e.key === "r" || e.key === "R") {
    if (btnNavigateAll) btnNavigateAll.click();
  } else if (e.key === "e" || e.key === "E" || e.key === "p" || e.key === "P" || (e.altKey && (e.key === "p" || e.key === "P"))) {
    if (btnExportPdf) btnExportPdf.click();
  } else if (e.key === "?") {
    if (shortcutsModal) shortcutsModal.style.display = shortcutsModal.style.display === "none" ? "flex" : "none";
  } else if (currentMode === "flicker" && e.code === "Space") {
    e.preventDefault();
    toggleFlickerState();
  } else if (currentMode === "swipe" && (e.key === "ArrowLeft" || e.key === "ArrowRight") && typeof window.__vcUpdateSwipePosition === "function") {
    e.preventDefault();
    const step = e.shiftKey ? 1 : 5;
    const base = typeof window.__vcSwipePct === "number" ? window.__vcSwipePct : 50;
    window.__vcUpdateSwipePosition(base + (e.key === "ArrowLeft" ? -step : step));
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

if (labelOpacityVal && sliderOverlayOpacity) {
  labelOpacityVal.title = "Click to reset ghost opacity to 80%";
  labelOpacityVal.style.cursor = "pointer";
  labelOpacityVal.addEventListener("click", () => {
    sliderOverlayOpacity.value = "80";
    labelOpacityVal.textContent = "80%";
    if (overlayGhostPane) overlayGhostPane.style.opacity = "0.8";
  });
}

overlayBlendSelect.addEventListener("change", (e) => {
  overlayGhostPane.style.mixBlendMode = e.target.value;
});
