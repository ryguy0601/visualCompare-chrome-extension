/**
 * VisualCompare Live - Studio: Device viewport and zoom scaler
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

// ----------------------------------------------------
// 8. DEVICE VIEWPORT & ZOOM SCALER (WITH PER-COLUMN ZOOM & FOCUS)
// ----------------------------------------------------
const columnZoomState = {
  prod: 1,
  stg: 1,
  diff: 1,
  panX: 0
};
let focusedColumn = null;

function applyColumnZoomTransforms() {
  const zProd = columnZoomState.prod || 1;
  const zStg = columnZoomState.stg || 1;
  const zDiff = columnZoomState.diff || 1;
  const panX = columnZoomState.panX || 0;

  const applyToTarget = (el, z) => {
    if (!el) return;
    if (Math.abs(z - 1) < 0.01) {
      el.style.transform = "";
      el.style.transformOrigin = "";
    } else if (z > 1) {
      const viewW = wrapFrameProd?.clientWidth || iframeProd?.clientWidth || el.clientWidth || 400;
      const maxPanX = Math.max(0, Math.round(viewW * (z - 1)));
      const clampedPanX = Math.max(0, Math.min(maxPanX, panX));
      el.style.transformOrigin = "0 0";
      el.style.transform = `translate3d(${-clampedPanX}px, 0px, 0px) scale(${z})`;
    } else {
      el.style.transformOrigin = "top center";
      el.style.transform = `scale(${z})`;
    }
  };

  applyToTarget(iframeProd, zProd);
  applyToTarget(iframeStg, zStg);
  applyToTarget(pixelDiffViewport, zDiff);
  if (typeof swipeContainer !== "undefined" && swipeContainer) applyToTarget(swipeContainer, zProd);
  if (typeof overlayContainer !== "undefined" && overlayContainer) applyToTarget(overlayContainer, zProd);
  if (typeof iframeFlickerProd !== "undefined" && iframeFlickerProd) applyToTarget(iframeFlickerProd, zProd);
  if (typeof iframeFlickerStg !== "undefined" && iframeFlickerStg) applyToTarget(iframeFlickerStg, zStg);

  const updateLabel = (lbl, z) => {
    if (!lbl) return;
    lbl.textContent = `${Math.round(z * 100)}%`;
    lbl.classList.toggle("zoomed", Math.abs(z - 1) >= 0.01);
  };
  updateLabel(document.getElementById("col-zoom-val-prod"), zProd);
  updateLabel(document.getElementById("col-zoom-val-stg"), zStg);
  updateLabel(document.getElementById("col-zoom-val-diff"), zDiff);
  updateLabel(document.getElementById("btn-zoom-reset"), zProd);
}

function setColumnZoom(colKey = "all", nextZoom = 1, syncAll = true) {
  const clamped = Math.max(0.5, Math.min(3, Math.round(nextZoom * 100) / 100));
  const shouldSync = syncAll && (colKey === "all" || !checkSyncScroll || checkSyncScroll.checked);

  if (shouldSync || colKey === "all") {
    columnZoomState.prod = clamped;
    columnZoomState.stg = clamped;
    columnZoomState.diff = clamped;
  } else if (colKey === "prod" || colKey === "stg" || colKey === "diff") {
    columnZoomState[colKey] = clamped;
  }

  if (clamped <= 1) {
    columnZoomState.panX = 0;
  } else {
    const viewW = wrapFrameProd?.clientWidth || iframeProd?.clientWidth || 400;
    const maxPanX = Math.max(0, Math.round(viewW * (clamped - 1)));
    columnZoomState.panX = Math.min(columnZoomState.panX || 0, maxPanX);
  }

  applyColumnZoomTransforms();
}

function stepColumnZoom(colKey = "all", delta = 0.25, syncAll = true) {
  const targetKey = (colKey === "prod" || colKey === "stg" || colKey === "diff") ? colKey : "prod";
  const current = columnZoomState[targetKey] || 1;
  setColumnZoom(colKey, current + delta, syncAll);
}

function toggleFocusColumn(colKey) {
  const viewSide = document.getElementById("view-side-by-side");
  if (!viewSide) return;

  if (focusedColumn === colKey) {
    focusedColumn = null;
  } else {
    focusedColumn = colKey;
  }

  const colMap = {
    prod: paneColProd || document.getElementById("pane-col-prod"),
    stg: paneColStg || document.getElementById("pane-col-stg"),
    diff: paneColDiff || document.getElementById("pane-col-diff")
  };
  const btnMap = {
    prod: document.getElementById("btn-focus-col-prod"),
    stg: document.getElementById("btn-focus-col-stg"),
    diff: document.getElementById("btn-focus-col-diff")
  };

  viewSide.classList.toggle("has-focused-column", Boolean(focusedColumn));
  Object.keys(colMap).forEach(k => {
    if (colMap[k]) colMap[k].classList.toggle("col-focused", focusedColumn === k);
    if (btnMap[k]) btnMap[k].classList.toggle("active", focusedColumn === k);
  });

  applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
  if (isColDiffActive) {
    renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
  }
}

if (typeof window !== "undefined") {
  window.__vcSetColumnZoom = setColumnZoom;
  window.__vcStepColumnZoom = stepColumnZoom;
  window.__vcToggleFocusColumn = toggleFocusColumn;
  window.__vcColumnZoomState = columnZoomState;
}

// Unified Single Zoom Control in Top Header (Controls All Panels Simultaneously)
const btnUnifiedZoomIn = document.getElementById("btn-zoom-in");
const btnUnifiedZoomOut = document.getElementById("btn-zoom-out");
const btnUnifiedZoomReset = document.getElementById("btn-zoom-reset");

function syncZoomSelectWithColumnZoom(z) {
  if (!zoomSelect || !zoomSelect.options) return;
  const zStr = String(Math.round(z * 100) / 100);
  const opts = typeof zoomSelect.options[Symbol.iterator] === "function"
    ? Array.from(zoomSelect.options)
    : Array.prototype.slice.call(zoomSelect.options);
  const match = opts.find(o => o.value === zStr);
  if (match) {
    zoomSelect.value = zStr;
  }
}

if (btnUnifiedZoomIn) {
  btnUnifiedZoomIn.addEventListener("click", (e) => {
    e.stopPropagation();
    stepColumnZoom("all", 0.25, true);
    syncZoomSelectWithColumnZoom(columnZoomState.prod);
  });
}
if (btnUnifiedZoomOut) {
  btnUnifiedZoomOut.addEventListener("click", (e) => {
    e.stopPropagation();
    stepColumnZoom("all", -0.25, true);
    syncZoomSelectWithColumnZoom(columnZoomState.prod);
  });
}
if (btnUnifiedZoomReset) {
  btnUnifiedZoomReset.addEventListener("click", (e) => {
    e.stopPropagation();
    setColumnZoom("all", 1, true);
    if (zoomSelect) {
      zoomSelect.value = "auto";
      applyViewportPresetAndZoom(true);
    }
  });
}

[
  {
    colKey: "prod",
    btnIn: document.getElementById("btn-zoom-in-prod"),
    btnOut: document.getElementById("btn-zoom-out-prod"),
    valEl: document.getElementById("col-zoom-val-prod"),
    btnFocus: document.getElementById("btn-focus-col-prod"),
    titleEl: document.getElementById("pane-title-prod")
  },
  {
    colKey: "stg",
    btnIn: document.getElementById("btn-zoom-in-stg"),
    btnOut: document.getElementById("btn-zoom-out-stg"),
    valEl: document.getElementById("col-zoom-val-stg"),
    btnFocus: document.getElementById("btn-focus-col-stg"),
    titleEl: document.getElementById("pane-title-stg")
  },
  {
    colKey: "diff",
    btnIn: document.getElementById("btn-zoom-in-diff"),
    btnOut: document.getElementById("btn-zoom-out-diff"),
    valEl: document.getElementById("col-zoom-val-diff"),
    btnFocus: document.getElementById("btn-focus-col-diff"),
    titleEl: document.getElementById("pane-title-diff")
  }
].forEach(({ colKey, btnIn, btnOut, valEl, btnFocus, titleEl }) => {

  if (btnIn) {
    btnIn.addEventListener("click", (e) => {
      e.stopPropagation();
      stepColumnZoom(colKey, 0.25, !e.altKey);
    });
  }
  if (btnOut) {
    btnOut.addEventListener("click", (e) => {
      e.stopPropagation();
      stepColumnZoom(colKey, -0.25, !e.altKey);
    });
  }
  if (valEl) {
    valEl.addEventListener("click", (e) => {
      e.stopPropagation();
      setColumnZoom(colKey, 1, !e.altKey);
    });
  }
  if (btnFocus) {
    btnFocus.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFocusColumn(colKey);
    });
  }
  if (titleEl) {
    titleEl.style.cursor = "pointer";
    titleEl.addEventListener("dblclick", () => {
      toggleFocusColumn(colKey);
    });
  }
});

function applyViewportPresetAndZoom(forceAutoScale = true) {
  if (!viewportScaler || !viewportSelect) return;
  const val = viewportSelect.value || "responsive";

  if (val === "responsive") {
    viewportScaler.style.width = "100%";
    viewportScaler.style.height = "100%";
    viewportScaler.style.transform = "";
    viewportScaler.style.transformOrigin = "";
    viewportScaler.style.marginBottom = "";
    viewportScaler.style.marginLeft = "";
    viewportScaler.style.marginRight = "";

    if (zoomSelect) {
      const autoOpt = (zoomSelect.options && typeof zoomSelect.options[Symbol.iterator] === "function")
        ? Array.from(zoomSelect.options).find(o => o.value === "auto")
        : (zoomSelect.options && zoomSelect.options.length ? Array.prototype.find.call(zoomSelect.options, o => o.value === "auto") : null);
      if (autoOpt) autoOpt.textContent = "Auto (Fit)";
      if (forceAutoScale) {
        zoomSelect.value = "auto";
      } else if (zoomSelect.value !== "auto") {
        const manualScale = parseFloat(zoomSelect.value) || 1;
        setColumnZoom("all", manualScale, true);
      }
    }
    return;
  }

  const [wStr, hStr] = val.split("x");
  const presetW = parseInt(wStr, 10) || 1280;
  const presetH = parseInt(hStr, 10) || 800;

  let targetScalerW = presetW;
  let targetScalerH = presetH;

  if (currentMode === "side-by-side") {
    const numCols = focusedColumn ? 1 : (isColDiffActive ? 3 : 2);
    const colGap = 10;
    targetScalerW = (presetW * numCols) + (colGap * (numCols - 1));
  }

  viewportScaler.style.width = `${targetScalerW}px`;
  viewportScaler.style.height = `${targetScalerH}px`;

  // Compute automatic zoom-out scale so the site fits the stage perfectly
  const stage = document.getElementById("studio-stage");
  const stageW = stage && stage.clientWidth > 100 ? (stage.clientWidth - 28) : (window.innerWidth - 30);
  const stageH = stage && stage.clientHeight > 100 ? (stage.clientHeight - 28) : (window.innerHeight - 150);

  const scaleX = stageW / targetScalerW;
  const scaleY = stageH / targetScalerH;
  let autoScale = Math.min(scaleX, scaleY);

  // Zoom out so it fits within the viewport; clamp max at 1.0 (100%) and min at 0.15 (15%)
  autoScale = Math.min(1, autoScale);
  autoScale = Math.max(0.15, Math.floor(autoScale * 100) / 100);

  let activeScale = autoScale;
  if (!forceAutoScale && zoomSelect && zoomSelect.value !== "auto") {
    activeScale = parseFloat(zoomSelect.value) || autoScale;
  }

  viewportScaler.style.transform = `scale(${activeScale})`;
  viewportScaler.style.transformOrigin = "top center";
  if (activeScale * targetScalerW > stageW + 4) {
    viewportScaler.style.transformOrigin = "top left";
    if (stage) stage.style.justifyContent = "flex-start";
  } else if (stage) {
    stage.style.justifyContent = "";
  }

  // Counteract layout bounding box overflow when scaled down
  if (activeScale < 1) {
    const marginB = Math.round(targetScalerH * (1 - activeScale));
    const marginX = Math.round((targetScalerW * (1 - activeScale)) / 2);
    viewportScaler.style.marginBottom = `-${marginB}px`;
    viewportScaler.style.marginLeft = `-${marginX}px`;
    viewportScaler.style.marginRight = `-${marginX}px`;
  } else {
    viewportScaler.style.marginBottom = "";
    viewportScaler.style.marginLeft = "";
    viewportScaler.style.marginRight = "";
  }

  // Update zoomSelect dropdown UI
  if (zoomSelect) {
    let autoOption = (zoomSelect.options && typeof zoomSelect.options[Symbol.iterator] === "function")
      ? Array.from(zoomSelect.options).find(o => o.value === "auto")
      : (zoomSelect.options && zoomSelect.options.length ? Array.prototype.find.call(zoomSelect.options, o => o.value === "auto") : null);
    if (!autoOption && typeof zoomSelect.insertBefore === "function") {
      autoOption = document.createElement("option");
      autoOption.value = "auto";
      zoomSelect.insertBefore(autoOption, zoomSelect.firstChild);
    }
    if (autoOption) {
      autoOption.textContent = `Auto (${Math.round(activeScale * 100)}%)`;
    }
    if (forceAutoScale) {
      zoomSelect.value = "auto";
    }
  }
}

function invalidateDiffCachesForViewportChange() {
  lastCapturedDiffCanvas = null;
  lastAccuratePixelDiffPct = null;

  const clearItemCache = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach(item => {
      if (item && item._subpixelCache) {
        delete item._subpixelCache;
      }
    });
  };
  clearItemCache(activeRedDiffs);
  clearItemCache(colRedDiffs);
  clearItemCache(swipeRedDiffs);
}

function refreshDiffsForViewportChange(reason = "Viewport preset changed") {
  invalidateDiffCachesForViewportChange();

  // Clear stale measured candidate boxes from old viewport dimensions
  colProdLandmarks = null;
  colStgLandmarks = null;
  swipeProdLandmarks = null;
  swipeStgLandmarks = null;

  // Request fresh landmarks and diff candidates from all active frames at the new aspect ratio / device size
  const active = typeof getActiveFramesForMode === "function"
    ? getActiveFramesForMode(currentMode)
    : { prod: iframeProd, stg: iframeStg, diff: iframeDiffBase };
  [active.prod, active.stg, active.diff].forEach(frame => {
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
        frame.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
      } catch (e) {}
    }
  });

  const rerenderActiveDiffs = () => {
    invalidateDiffCachesForViewportChange();
    if (checkSyncRedDiff && checkSyncRedDiff.checked) {
      if (typeof computeAndApplyRedDifferences === "function") {
        computeAndApplyRedDifferences(false);
      }
      if (currentMode === "swipe" && swipeCompareMode === "diff") {
        renderSwipeDiffCanvas(
          (swipeRedDiffs && swipeRedDiffs.length > 0) ? swipeRedDiffs : activeRedDiffs,
          activeShiftRegions,
          lastScrollState.scrollY || 0,
          lastScrollState.scrollX || 0
        );
      } else if (currentMode === "side-by-side" && isColDiffActive) {
        renderPixelDiffColumn3(
          (colRedDiffs && colRedDiffs.length > 0) ? colRedDiffs : activeRedDiffs,
          activeShiftRegions,
          lastScrollState.scrollY || 0,
          lastScrollState.scrollX || 0
        );
      } else if (currentMode === "overlay") {
        renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
      }
    }
  };

  // Immediate re-render using live DOM geometry at the new device preset
  rerenderActiveDiffs();

  // Follow-up re-render after media queries & responsive reflow settle
  setTimeout(() => {
    if (checkSyncHazard && checkSyncHazard.checked) {
      triggerHazardRealignment(reason);
    }
    rerenderActiveDiffs();
  }, 150);
}
if (typeof window !== "undefined") {
  window.__vcRefreshDiffsForViewportChange = refreshDiffsForViewportChange;
}

viewportSelect.addEventListener("change", (e) => {
  applyViewportPresetAndZoom(true);
  refreshDiffsForViewportChange("Device viewport preset changed");
});

window.addEventListener("resize", () => {
  clearTimeout(studioResizeTimer);
  studioResizeTimer = setTimeout(() => {
    applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
    refreshDiffsForViewportChange("Studio window resized");
  }, 250);
});

zoomSelect.addEventListener("change", (e) => {
  if (e.target.value === "auto") {
    setColumnZoom("all", 1, true);
    applyViewportPresetAndZoom(true);
  } else {
    const manualScale = parseFloat(e.target.value) || 1;
    setColumnZoom("all", manualScale, true);
    applyViewportPresetAndZoom(false);
  }
});
