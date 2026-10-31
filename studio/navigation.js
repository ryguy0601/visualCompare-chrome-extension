/**
 * VisualCompare Live - Studio: URL actions and navigation
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

// ----------------------------------------------------
// 9. URL ACTIONS & NAVIGATION
// ----------------------------------------------------
function normalizeUrl(url) {
  if (!url) return "";
  url = url.trim();
  if (url === "about:blank") return url;
  if (/^(https?:\/\/|chrome-extension:\/\/|file:\/\/|blob:|data:)/i.test(url)) {
    return url;
  }
  if (/^demo[_-].*\.html$/i.test(url) || url.endsWith(".html")) {
    return url;
  }
  if (/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i.test(url)) {
    return "https://" + url;
  }
  return url;
}

/**
 * Show a banner asking the user to grant site access. The Chrome permission prompt
 * must come from a click on a page that stays open (a popup would close and lose it).
 */
let accessBannerEl = null;
function showAccessBanner(plan, onGranted) {
  if (accessBannerEl) accessBannerEl.remove();
  const hosts = plan.requestDomains.length ? plan.requestDomains.join(", ") : "all websites";
  const banner = document.createElement("div");
  accessBannerEl = banner;
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#1e293b;color:#f8fafc;" +
    "padding:10px 16px;display:flex;gap:12px;align-items:center;font:13px system-ui;border-bottom:2px solid #38bdf8;";
  const text = document.createElement("span");
  text.style.flex = "1";
  text.textContent = "VisualCompare needs permission to open and sync: " + hosts +
    (plan.excludedDomains.length ? " (except " + plan.excludedDomains.join(", ") + ")" : "") + ".";
  const grant = document.createElement("button");
  grant.textContent = "Grant access";
  const cancel = document.createElement("button");
  cancel.textContent = "Dismiss";
  [grant, cancel].forEach((b) => { b.style.cssText = "padding:6px 12px;border-radius:6px;border:0;cursor:pointer;"; });
  grant.style.background = "#38bdf8";
  cancel.addEventListener("click", () => banner.remove());
  grant.addEventListener("click", () => {
    chrome.permissions.request({ origins: plan.origins }, (granted) => {
      if (granted) { banner.remove(); onGranted(); }
      else { text.textContent = "Permission was not granted. Click \"Grant access\" to try again, or pick a different site-access option in the popup."; }
    });
  });
  banner.append(text, grant, cancel);
  document.body.appendChild(banner);
}

/**
 * Navigate both panes, first making sure the extension has access to the target
 * sites (per the site-access choice made in the popup). Falls back to a plain
 * load when the extension APIs are unavailable (e.g. tests, plain-page preview).
 */
function navigateWithAccess(prodUrl, stgUrl) {
  const canCheckAccess = typeof chrome !== "undefined" && chrome.permissions && chrome.storage &&
    chrome.runtime && typeof chrome.runtime.sendMessage === "function" && typeof VCSiteAccess !== "undefined";
  if (!canCheckAccess) {
    loadAllFrames(prodUrl, stgUrl);
    return;
  }
  const urls = [normalizeUrl(prodUrl), normalizeUrl(stgUrl)];
  chrome.storage.local.get(["vc_site_access_config"], (data) => {
    const config = data.vc_site_access_config || { mode: "urls", excluded: [] };
    if (urls.some((u) => VCSiteAccess.isExcluded(u, config.excluded))) {
      return;
    }
    const plan = VCSiteAccess.buildAccessPlan(config, urls);
    const apply = () => chrome.runtime.sendMessage({ type: "APPLY_SITE_ACCESS", plan }, () => {
      void chrome.runtime.lastError;
      loadAllFrames(prodUrl, stgUrl);
    });
    if (!plan.origins.length) { apply(); return; }
    chrome.permissions.contains({ origins: plan.origins }, (has) => {
      if (has) apply();
      else showAccessBanner(plan, apply);
    });
  });
}

[prodUrlInput, stgUrlInput].forEach(input => {
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateWithAccess(prodUrlInput.value.trim(), stgUrlInput.value.trim());
      }
    });
  }
});

btnNavigateAll.addEventListener("click", () => {
  navigateWithAccess(prodUrlInput.value.trim(), stgUrlInput.value.trim());
});

btnSwapUrls.addEventListener("click", () => {
  const temp = prodUrlInput.value;
  prodUrlInput.value = stgUrlInput.value;
  stgUrlInput.value = temp;
  navigateWithAccess(prodUrlInput.value.trim(), stgUrlInput.value.trim());
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
        if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
          applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
        }
        renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
        updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");
        scheduleLivePixelDiffCapture();
      } else if (currentMode === "overlay") {
        renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
        updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");
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
        if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
          applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
        }
        updateAllDiffPercentDisplays("0.00%");
      } else if (currentMode === "overlay") {
        if (diffCanvas) diffCanvas.style.display = "none";
        if (diffLegendPill) diffLegendPill.style.display = "none";
        updateAllDiffPercentDisplays("0.00%");
      }
    }
    if (currentMode === "swipe" && swipeCompareMode === "diff") {
      renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions);
    } else if (isColDiffActive) {
      renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
    }
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
    scheduleLivePixelDiffCapture();
  });
}

// 3rd Column Diff Base Toggle Button (Black Canvas vs Underlaid Page)
if (btnColDiffBase) {
  btnColDiffBase.addEventListener("click", () => {
    updateDiffBaseVisibility(!isDiffBasePageVisible);
    renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
    scheduleLivePixelDiffCapture();
  });
}

// Diff Opacity Slider (matches visualCompare report_template.html)
if (colDiffOpacitySlider) {
  colDiffOpacitySlider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value, 10) || 0;
    if (colDiffOpacityVal) colDiffOpacityVal.textContent = `${val}%`;
    if (pixelDiffCanvas) pixelDiffCanvas.style.opacity = (val / 100).toString();
    if (swipeDiffCanvas) swipeDiffCanvas.style.opacity = (val / 100).toString();
    if (diffCanvas) diffCanvas.style.opacity = (val / 100).toString();
  });
}

if (colDiffOpacityVal && colDiffOpacitySlider) {
  colDiffOpacityVal.title = "Click to reset diff opacity to 85%";
  colDiffOpacityVal.style.cursor = "pointer";
  colDiffOpacityVal.addEventListener("click", () => {
    colDiffOpacitySlider.value = "85";
    colDiffOpacityVal.textContent = "85%";
    if (pixelDiffCanvas) pixelDiffCanvas.style.opacity = "0.85";
    if (swipeDiffCanvas) swipeDiffCanvas.style.opacity = "0.85";
    if (diffCanvas) diffCanvas.style.opacity = "0.85";
  });
}

// Synchronized Wheel Scrolling for Side-by-Side (Column View) & Swipe Curtain
function getEffectiveMaxScrollY(viewH) {
  let liveDocH = 0;
  try {
    const pH = iframeProd?.contentDocument?.documentElement?.scrollHeight || iframeSwipeProd?.contentDocument?.documentElement?.scrollHeight || 0;
    const sH = iframeStg?.contentDocument?.documentElement?.scrollHeight || iframeSwipeStg?.contentDocument?.documentElement?.scrollHeight || 0;
    const dH = iframeDiffBase?.contentDocument?.documentElement?.scrollHeight || 0;
    liveDocH = Math.max(pH, sH, dH);
  } catch (e) {}

  const alignedDocH = (typeof window !== "undefined" && window.__vcAlignedDocHeight) ? window.__vcAlignedDocHeight : 0;
  const knownDocH = Math.max(
    liveDocH,
    alignedDocH,
    lastProdLandmarks?.docHeight || 0,
    lastStgLandmarks?.docHeight || 0,
    lastScrollState?.maxScrollY ? (lastScrollState.maxScrollY + viewH) : 0
  );
  const docH = knownDocH > viewH ? knownDocH : 50000;
  return Math.max(1, docH - viewH);
}
if (typeof window !== "undefined") {
  window.__vcGetEffectiveMaxScrollY = getEffectiveMaxScrollY;
}

function getEffectiveMaxScrollX(viewW) {
  let liveMaxX = null;
  try {
    const pFrame = (currentMode === "swipe") ? iframeSwipeProd : (currentMode === "flicker" ? iframeFlickerProd : (currentMode === "overlay" ? iframeOverlayProd : iframeProd));
    const sFrame = (currentMode === "swipe") ? iframeSwipeStg : (currentMode === "flicker" ? iframeFlickerStg : (currentMode === "overlay" ? iframeOverlayStg : iframeStg));
    const measureFrameMaxX = (frame) => {
      const docEl = frame?.contentDocument?.documentElement;
      const bodyEl = frame?.contentDocument?.body;
      if (!docEl && !bodyEl) return null;
      const scrollW = Math.max(docEl?.scrollWidth || 0, bodyEl?.scrollWidth || 0, docEl?.offsetWidth || 0);
      const clientW = docEl?.clientWidth || frame?.clientWidth || viewW || 0;
      if (scrollW <= 0 || clientW <= 0) return 0;
      return Math.max(0, scrollW - clientW);
    };
    const pMax = measureFrameMaxX(pFrame);
    const sMax = measureFrameMaxX(sFrame);
    if (pMax !== null || sMax !== null) {
      liveMaxX = Math.max(pMax || 0, sMax || 0);
    }
  } catch (e) {}

  if (liveMaxX !== null) {
    return liveMaxX;
  }

  if (Number.isFinite(lastScrollState?.maxScrollX) && lastScrollState.maxScrollX >= 0) {
    return lastScrollState.maxScrollX;
  }

  const knownDocW = Math.max(
    lastProdLandmarks?.docWidth || 0,
    lastStgLandmarks?.docWidth || 0
  );
  if (knownDocW > 0 && viewW > 0) {
    return Math.max(0, knownDocW - viewW);
  }
  return 0;
}
if (typeof window !== "undefined") {
  window.__vcGetEffectiveMaxScrollX = getEffectiveMaxScrollX;
}

function handleSideBySideWheel(e) {
  if (e && (e.ctrlKey || e.metaKey)) {
    if (typeof e.preventDefault === "function") e.preventDefault();
    if (typeof stepColumnZoom === "function") {
      stepColumnZoom(e.colKey || "all", (e.deltaY || 0) < 0 ? 0.25 : -0.25, !e.altKey);
    }
    return;
  }
  if (!checkSyncScroll || !checkSyncScroll.checked) return;
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }
  activeScrollLeader = "WHEEL";
  clearTimeout(scrollLeaderTimer);
  scrollLeaderTimer = setTimeout(() => {
    activeScrollLeader = null;
  }, 120);

  const isShiftWheel = Boolean(e && e.shiftKey && !e.deltaX && e.deltaY);
  const deltaY = isShiftWheel ? 0 : (e.deltaY || 0);
  const deltaX = isShiftWheel ? (e.deltaY || 0) : (e.deltaX || 0);
  const currentY = lastScrollState.scrollY || 0;
  const currentX = lastScrollState.scrollX || 0;
  const viewH = wrapFrameProd?.clientHeight || iframeProd?.clientHeight || 800;
  const viewW = wrapFrameProd?.clientWidth || iframeProd?.clientWidth || 400;
  const maxScrollY = getEffectiveMaxScrollY(viewH);
  const maxScrollX = getEffectiveMaxScrollX(viewW);
  const newScrollY = Math.max(0, Math.min(maxScrollY, currentY + deltaY));
  const newScrollX = Math.max(0, Math.min(maxScrollX, currentX + deltaX));

  if (typeof columnZoomState !== "undefined" && deltaX !== 0) {
    const maxZ = Math.max(columnZoomState.prod || 1, columnZoomState.stg || 1, columnZoomState.diff || 1);
    if (maxZ > 1) {
      const maxPanX = Math.max(0, Math.round(viewW * (maxZ - 1)));
      columnZoomState.panX = Math.max(0, Math.min(maxPanX, (columnZoomState.panX || 0) + deltaX));
      if (typeof applyColumnZoomTransforms === "function") {
        applyColumnZoomTransforms();
      }
    }
  }

  lastScrollState.scrollY = newScrollY;
  lastScrollState.scrollX = newScrollX;
  lastScrollState.maxScrollY = maxScrollY;
  lastScrollState.maxScrollX = maxScrollX;
  lastScrollState.pctY = maxScrollY > 0 ? newScrollY / maxScrollY : 0;
  lastScrollState.pctX = maxScrollX > 0 ? newScrollX / maxScrollX : 0;

  if (wrapFrameDiff) {
    wrapFrameDiff.scrollTop = newScrollY;
    wrapFrameDiff.scrollLeft = newScrollX;
  }

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
  activeScrollLeader = "WHEEL";
  clearTimeout(scrollLeaderTimer);
  scrollLeaderTimer = setTimeout(() => {
    activeScrollLeader = null;
  }, 120);

  const deltaY = e.deltaY || 0;
  const deltaX = e.deltaX || 0;
  const currentY = lastScrollState.scrollY || 0;
  const currentX = lastScrollState.scrollX || 0;
  const viewH = swipeContainer?.clientHeight || 800;
  const viewW = swipeContainer?.clientWidth || 1200;
  const maxScrollY = getEffectiveMaxScrollY(viewH);
  const maxScrollX = getEffectiveMaxScrollX(viewW);
  const newScrollY = Math.max(0, Math.min(maxScrollY, currentY + deltaY));
  const newScrollX = Math.max(0, Math.min(maxScrollX, currentX + deltaX));

  lastScrollState.scrollY = newScrollY;
  lastScrollState.scrollX = newScrollX;
  lastScrollState.maxScrollY = maxScrollY;
  lastScrollState.maxScrollX = maxScrollX;
  lastScrollState.pctY = maxScrollY > 0 ? newScrollY / maxScrollY : 0;
  lastScrollState.pctX = maxScrollX > 0 ? newScrollX / maxScrollX : 0;

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

function handleFlickerWheel(e) {
  if (!checkSyncScroll || !checkSyncScroll.checked) return;
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }
  activeScrollLeader = "WHEEL";
  clearTimeout(scrollLeaderTimer);
  scrollLeaderTimer = setTimeout(() => {
    activeScrollLeader = null;
  }, 120);

  const deltaY = e.deltaY || 0;
  const deltaX = e.deltaX || 0;
  const currentY = lastScrollState.scrollY || 0;
  const currentX = lastScrollState.scrollX || 0;
  const viewH = iframeFlickerProd?.clientHeight || 800;
  const viewW = iframeFlickerProd?.clientWidth || 1200;
  const maxScrollY = getEffectiveMaxScrollY(viewH);
  const maxScrollX = getEffectiveMaxScrollX(viewW);
  const newScrollY = Math.max(0, Math.min(maxScrollY, currentY + deltaY));
  const newScrollX = Math.max(0, Math.min(maxScrollX, currentX + deltaX));

  lastScrollState.scrollY = newScrollY;
  lastScrollState.scrollX = newScrollX;
  lastScrollState.maxScrollY = maxScrollY;
  lastScrollState.maxScrollX = maxScrollX;
  lastScrollState.pctY = maxScrollY > 0 ? newScrollY / maxScrollY : 0;
  lastScrollState.pctX = maxScrollX > 0 ? newScrollX / maxScrollX : 0;

  const mirrorAction = {
    type: "VC_MIRROR_ACTION",
    action: { kind: "scroll", scrollY: newScrollY, scrollX: newScrollX }
  };

  if (iframeFlickerProd && iframeFlickerProd.contentWindow) {
    try { iframeFlickerProd.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
  }
  if (iframeFlickerStg && iframeFlickerStg.contentWindow) {
    try { iframeFlickerStg.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
  }

  triggerScrollDiffSync(newScrollY, newScrollX);
}

function handleOverlayWheel(e) {
  if (!checkSyncScroll || !checkSyncScroll.checked) return;
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }
  activeScrollLeader = "WHEEL";
  clearTimeout(scrollLeaderTimer);
  scrollLeaderTimer = setTimeout(() => {
    activeScrollLeader = null;
  }, 120);

  const deltaY = e.deltaY || 0;
  const deltaX = e.deltaX || 0;
  const currentY = lastScrollState.scrollY || 0;
  const currentX = lastScrollState.scrollX || 0;
  const viewH = iframeOverlayProd?.clientHeight || 800;
  const viewW = iframeOverlayProd?.clientWidth || 1200;
  const maxScrollY = getEffectiveMaxScrollY(viewH);
  const maxScrollX = getEffectiveMaxScrollX(viewW);
  const newScrollY = Math.max(0, Math.min(maxScrollY, currentY + deltaY));
  const newScrollX = Math.max(0, Math.min(maxScrollX, currentX + deltaX));

  lastScrollState.scrollY = newScrollY;
  lastScrollState.scrollX = newScrollX;
  lastScrollState.maxScrollY = maxScrollY;
  lastScrollState.maxScrollX = maxScrollX;
  lastScrollState.pctY = maxScrollY > 0 ? newScrollY / maxScrollY : 0;
  lastScrollState.pctX = maxScrollX > 0 ? newScrollX / maxScrollX : 0;

  const mirrorAction = {
    type: "VC_MIRROR_ACTION",
    action: { kind: "scroll", scrollY: newScrollY, scrollX: newScrollX }
  };

  if (iframeOverlayProd && iframeOverlayProd.contentWindow) {
    try { iframeOverlayProd.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
  }
  if (iframeOverlayStg && iframeOverlayStg.contentWindow) {
    try { iframeOverlayStg.contentWindow.postMessage(mirrorAction, "*"); } catch (err) {}
  }

  if (diffCanvas && diffCanvas.style.display !== "none") {
    renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
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

// Attach synchronized wheel scrolling to Flicker view
const flickerViewEl = document.getElementById("view-flicker");
[flickerViewEl, flickerContainer].forEach(el => {
  if (el) {
    el.addEventListener("wheel", handleFlickerWheel, { passive: false });
  }
});

// Attach synchronized wheel scrolling to Overlay view
const overlayViewEl = document.getElementById("view-overlay");
[overlayViewEl, overlayContainer].forEach(el => {
  if (el) {
    el.addEventListener("wheel", handleOverlayWheel, { passive: false });
  }
});

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
    } else {
      if (paneColDiff) paneColDiff.style.display = "none";
      if (viewSide) viewSide.classList.remove("mode-view-pixel-diff");
      checkSyncRedDiff.checked = false;
      updateSyncChipStyles();
      clearAllRedDiffs(true);
      updateAllDiffPercentDisplays("0.00%");
    }
    if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
      applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
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

    // Production frame is the clean baseline on the LEFT of the curtain slider
    if (iframeSwipeProd) {
      iframeSwipeProd.style.display = "block";
      iframeSwipeProd.style.opacity = "1";
      iframeSwipeProd.style.pointerEvents = "auto";
      if (prodSrc && (!iframeSwipeProd.src || iframeSwipeProd.src === "about:blank")) {
        iframeSwipeProd.src = prodSrc;
      }
    }

    // Staging frame is the base on the RIGHT of the curtain slider
    if (iframeSwipeStg) {
      iframeSwipeStg.style.display = "block";
      iframeSwipeStg.style.opacity = "1";
      iframeSwipeStg.style.pointerEvents = "auto";
      if (stgSrc && (!iframeSwipeStg.src || iframeSwipeStg.src === "about:blank")) {
        iframeSwipeStg.src = stgSrc;
      }
    }

    if (iframeSwipeDiff) {
      iframeSwipeDiff.style.display = "none";
    }

    if (swipeOverlayLayer) {
      swipeOverlayLayer.style.background = "transparent";
    }

    // Diff canvas overlays Staging in swipe-base-layer (right side)
    if (swipeDiffCanvas) {
      swipeDiffCanvas.style.display = "block";
      swipeDiffCanvas.style.pointerEvents = "none";
      swipeDiffCanvas.style.opacity = (colDiffOpacitySlider ? colDiffOpacitySlider.value / 100 : 0.85).toString();
    }

    if (swipeContainer) {
      swipeContainer.classList.add("diff-mode");
    }

    if (swipeHandlePill) {
      swipeHandlePill.classList.add("diff-active");
    }
    if (swipeHandleLabel) {
      swipeHandleLabel.textContent = "PROD ↔ DIFF";
    }

    if (swipeOverlayTag) {
      swipeOverlayTag.textContent = "PRODUCTION (LEFT)";
      swipeOverlayTag.style.borderColor = "var(--color-prod)";
      swipeOverlayTag.style.color = "var(--color-prod)";
    }
    if (swipeBaseTag) {
      swipeBaseTag.textContent = "STAGING + DIFF (RIGHT)";
      swipeBaseTag.classList.add("diff-active");
      swipeBaseTag.style.borderColor = "#ef4444";
      swipeBaseTag.style.color = "#f87171";
    }

    // Sync scroll to both frames
    const currentY = lastScrollState.scrollY || 0;
    const currentX = lastScrollState.scrollX || 0;
    [iframeSwipeProd, iframeSwipeStg].forEach(frame => {
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
    [iframeSwipeProd, iframeSwipeStg].forEach(frame => {
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.postMessage({ type: "VC_REQUEST_LANDMARKS" }, "*");
          frame.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
        } catch (e) {}
      }
    });

    renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, currentY, currentX);
    updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");
  } else {
    if (iframeSwipeProd) {
      iframeSwipeProd.style.display = "block";
      iframeSwipeProd.style.opacity = "1";
      iframeSwipeProd.style.pointerEvents = "auto";
      if (prodSrc && (!iframeSwipeProd.src || iframeSwipeProd.src === "about:blank")) {
        iframeSwipeProd.src = prodSrc;
      }
    }
    if (iframeSwipeStg) {
      iframeSwipeStg.style.display = "block";
      iframeSwipeStg.style.opacity = "1";
      iframeSwipeStg.style.pointerEvents = "auto";
      if (stgSrc && (!iframeSwipeStg.src || iframeSwipeStg.src === "about:blank")) {
        iframeSwipeStg.src = stgSrc;
      }
    }
    if (iframeSwipeDiff) iframeSwipeDiff.style.display = "none";
    if (swipeOverlayLayer) {
      swipeOverlayLayer.style.background = "transparent";
    }
    if (swipeDiffCanvas) swipeDiffCanvas.style.display = "none";

    if (swipeContainer) {
      swipeContainer.classList.remove("diff-mode");
    }
    if (swipeHandlePill) {
      swipeHandlePill.classList.remove("diff-active");
    }
    if (swipeHandleLabel) {
      swipeHandleLabel.textContent = "SWIPE";
    }

    if (swipeOverlayTag) {
      swipeOverlayTag.textContent = "PRODUCTION (LEFT)";
      swipeOverlayTag.style.borderColor = "var(--color-prod)";
      swipeOverlayTag.style.color = "var(--color-prod)";
    }
    if (swipeBaseTag) {
      swipeBaseTag.textContent = "STAGING (RIGHT)";
      swipeBaseTag.classList.remove("diff-active");
      swipeBaseTag.style.borderColor = "var(--color-stg)";
      swipeBaseTag.style.color = "var(--color-stg)";
    }
    updateAllDiffPercentDisplays(lastAccuratePixelDiffPct || "0.00%");

    // Sync scroll to both frames
    const currentY = lastScrollState.scrollY || 0;
    const currentX = lastScrollState.scrollX || 0;
    [iframeSwipeProd, iframeSwipeStg].forEach(frame => {
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.postMessage({
            type: "VC_MIRROR_ACTION",
            action: { kind: "scroll", scrollY: currentY, scrollX: currentX }
          }, "*");
        } catch (e) {}
      }
    });
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
  const tolGroup = document.getElementById("diff-tolerance-group");
  const opaGroup = document.getElementById("diff-opacity-toolbar-group");
  if (tolGroup) tolGroup.classList.toggle("diff-controls-active", Boolean(checkSyncRedDiff && checkSyncRedDiff.checked));
  if (opaGroup) opaGroup.classList.toggle("diff-controls-active", Boolean(checkSyncRedDiff && checkSyncRedDiff.checked));

  document.getElementById("chip-sync-clicks").classList.toggle("active", checkSyncClicks.checked);
  document.getElementById("chip-sync-scroll").classList.toggle("active", checkSyncScroll.checked);
  document.getElementById("chip-sync-hover").classList.toggle("active", checkSyncHover.checked);
  document.getElementById("chip-sync-inputs").classList.toggle("active", checkSyncInputs.checked);

  const anyActive = checkSyncHazard.checked || checkSyncRedDiff.checked || checkSyncClicks.checked || checkSyncScroll.checked || checkSyncHover.checked || checkSyncInputs.checked;
  syncStatusLabel.textContent = anyActive ? "Mirror Active" : "Mirror Paused";
  const syncStatusEl = document.getElementById("sync-status");
  if (syncStatusEl) {
    syncStatusEl.style.opacity = anyActive ? "1" : "0.5";
    syncStatusEl.classList.toggle("paused", !anyActive);
  }
}

const syncStatusToggleEl = document.getElementById("sync-status");
if (syncStatusToggleEl) {
  syncStatusToggleEl.style.cursor = "pointer";
  syncStatusToggleEl.addEventListener("click", () => {
    const mirrorChecks = [checkSyncClicks, checkSyncScroll, checkSyncHover, checkSyncInputs].filter(Boolean);
    const anyMirrorOn = mirrorChecks.some(c => c.checked);
    const nextState = !anyMirrorOn;
    mirrorChecks.forEach(c => { c.checked = nextState; });
    if (checkSyncHazard) checkSyncHazard.checked = nextState;
    updateSyncChipStyles();
  });
}
