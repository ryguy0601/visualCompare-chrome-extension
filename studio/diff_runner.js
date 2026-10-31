/**
 * VisualCompare Live - Studio: Hazard stripe canvas, Run Diff, pixel diff renderer
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

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
activeShiftRegions = [];

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

if (metricShiftBadge) {
  metricShiftBadge.style.cursor = "pointer";
  metricShiftBadge.title = "Click to toggle yellow layout shift hazard spacers";
  metricShiftBadge.addEventListener("click", () => {
    if (checkSyncHazard) {
      checkSyncHazard.checked = !checkSyncHazard.checked;
      checkSyncHazard.dispatchEvent(new Event("change"));
    }
  });
}

function runVisualDiffCalculation(notify = true) {
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

  // 4. Use accurate shift regions computed by calculateAndApplyLayoutShifts
  const totalShiftDelta = activeShiftRegions.reduce((sum, r) => sum + (r.h || 0), 0);

  // 4. Update active diff renderings ONLY if the corresponding view/mode is selected
  if (currentMode === "swipe") {
    setSwipeCompareMode("diff");
    renderSwipeDiffCanvas((swipeRedDiffs && swipeRedDiffs.length > 0) ? swipeRedDiffs : activeRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
    scheduleLivePixelDiffCapture();
  } else if (currentMode === "side-by-side") {
    isColDiffActive = true;
    if (btnToggleColDiff) btnToggleColDiff.classList.add("active");
    if (paneColDiff) paneColDiff.style.display = "flex";
    const viewSide = document.getElementById("view-side-by-side");
    if (viewSide) viewSide.classList.add("mode-view-pixel-diff");
    if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
      applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : true);
    }
    renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
    scheduleLivePixelDiffCapture();
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

  metricShiftBadge.style.display = "none";
  metricShiftVal.textContent = totalShiftDelta > 0 ? `+${totalShiftDelta}px` : "+0px";
  if (chipSyncHazard) {
    chipSyncHazard.title = totalShiftDelta > 0
      ? `Layout Shift Compensation: +${totalShiftDelta}px shifted`
      : "Toggle Yellow Layout Shift Hazard Spacers";
  }

  if (metricRedBadge) metricRedBadge.style.display = "none";

  // 6. Update action button UI
  btnRunDiff.classList.remove("loading");
  btnRunDiff.classList.add("diff-active");
  btnRunDiff.innerHTML = `<span class="btn-label-full">✓ Visual Diff (${mismatchPct})</span><span class="btn-label-short">✓ ${mismatchPct}</span>`;
  btnRunDiff.title = "Visual diff calculated. Click to re-run fresh comparison.";

  // 7. Render heatmap on canvas (ready whenever user views or switches to overlay mode)
  renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
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
}

function renderDiffCanvasHeatmap(diffList, shiftRegions) {
  const canvas = diffCanvas;
  if (!canvas) return;
  if (!checkSyncRedDiff || !checkSyncRedDiff.checked) {
    canvas.style.display = "none";
    if (diffLegendPill) diffLegendPill.style.display = "none";
    return;
  }

  canvas.style.display = "block";
  canvas.style.opacity = (colDiffOpacitySlider ? colDiffOpacitySlider.value / 100 : 0.85).toString();
  if (diffLegendPill) diffLegendPill.style.display = "flex";

  const width = Math.max(1, iframeOverlayProd?.clientWidth || 1200);
  const height = Math.max(1, iframeOverlayProd?.clientHeight || 800);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  const hasLiveOverlayDom = Boolean(
    (iframeOverlayStg?.contentDocument?.body?.children?.length > 0) ||
    (iframeOverlayProd?.contentDocument?.body?.children?.length > 0)
  );
  const currentScrollY = lastScrollState?.scrollY || 0;
  const currentScrollX = lastScrollState?.scrollX || 0;

  // 1. Draw Red pixel differences on altered elements (PURE DIFFERING PIXELS ONLY!)
  if (diffList && diffList.length > 0) {
    diffList.forEach(item => {
      if (!item) return;
      let drawX = 0;
      let drawY = 0;
      let drawW = 0;
      let drawH = 0;
      let hasExactBox = false;

      if (item.selector) {
        try {
          const elS = iframeOverlayStg?.contentDocument?.querySelector(item.selector);
          const elP = iframeOverlayProd?.contentDocument?.querySelector(item.selector);
          const rS = elS ? elS.getBoundingClientRect() : null;
          const rP = elP ? elP.getBoundingClientRect() : null;
          const validS = rS && rS.width > 0 && rS.height > 0;
          const validP = rP && rP.width > 0 && rP.height > 0;
          if (validS || validP) {
            const r = (validS && validP)
              ? {
                  left: Math.min(rS.left, rP.left),
                  top: Math.min(rS.top, rP.top),
                  width: Math.max(rS.right, rP.right) - Math.min(rS.left, rP.left),
                  height: Math.max(rS.bottom, rP.bottom) - Math.min(rS.top, rP.top)
                }
              : (validS ? rS : rP);
            drawX = Math.round(r.left);
            drawY = Math.round(r.top);
            drawW = Math.round(r.width);
            drawH = Math.round(r.height);
            hasExactBox = true;
          }
        } catch (e) {}
      }

      if (!hasExactBox) {
        if (hasLiveOverlayDom) return;
        const box = item.box || getEstimatedBoxForSelector(item.selector, width);
        if (!box) return;
        const scaleX = (box.measuredWidth && box.measuredWidth > 0 && Math.abs(box.measuredWidth - width) > 20) ? (width / box.measuredWidth) : 1;
        drawX = Math.round(((box.x || 0) - currentScrollX) * scaleX);
        drawY = Math.round((box.y || 0) - currentScrollY);
        drawW = Math.round((box.width || 100) * scaleX);
        drawH = box.height || 30;
      }

      const rendered = renderElementSubpixelDiff(ctx, item, drawX, drawY, drawW, drawH, iframeOverlayStg, iframeOverlayProd);
      if (!rendered && !item.diffType?.includes("typography") && !item.diffType?.includes("text") && ALLOW_SOLID_BOX_DIFF) {
        ctx.fillStyle = "rgba(225, 29, 72, 0.4)";
        const r = parseFloat(item.style?.radius) || 0;
        if (r > 0 && typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, drawW, drawH, r);
          ctx.fill();
        } else {
          ctx.fillRect(drawX, drawY, drawW, drawH);
        }
      }

      // Text descriptions disabled per user instruction: pure pixel difference without text descriptions
    });
  }

  // 2. Yellow hazard stripes for layout shift regions
  if (shiftRegions && shiftRegions.length > 0 && (!checkSyncHazard || checkSyncHazard.checked)) {
    shiftRegions.forEach(reg => {
      drawHazardStripes(ctx, 0, reg.y, width, reg.h, 12);
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
let lastScrollCandidateReqTime = 0;

function requestScrollDiffCandidates() {
  const active = typeof getActiveFramesForMode === "function" ? getActiveFramesForMode(currentMode) : null;
  if (!active) return;
  [active.prod, active.stg].forEach(frame => {
    if (frame && frame.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: "VC_REQUEST_DIFF_CANDIDATES" }, "*");
      } catch (e) {}
    }
  });
}

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
  const isOverlayDiffActive = (currentMode === "overlay" && Boolean(checkSyncRedDiff && checkSyncRedDiff.checked));
  return isColDiffVisible || isSwipeDiffActive || isOverlayDiffActive;
}

function triggerScrollDiffSync(scrollY, scrollX) {
  if (!isPixelDiffOverlayActive()) return;

  isUserScrolling = true;

  // Invalidate stale screenshot diff if scroll position changed so live vector diffs render smoothly
  if (lastCapturedDiffCanvas && Math.abs((lastScrollState.scrollY || 0) - lastCapturedScrollY) > 2) {
    lastCapturedDiffCanvas = null;
  }

  if (scrollDiffRaf) cancelAnimationFrame(scrollDiffRaf);
  scrollDiffRaf = requestAnimationFrame(() => {
    scrollDiffRaf = null;
    if (currentMode === "swipe") {
      renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions, scrollY, scrollX);
    } else if (currentMode === "overlay") {
      renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
    } else {
      renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions, scrollY, scrollX);
    }
  });

  // Stream fresh diff candidates as the user scrolls through the page
  const now = Date.now();
  if (now - lastScrollCandidateReqTime >= 120) {
    lastScrollCandidateReqTime = now;
    requestScrollDiffCandidates();
  }

  // While scrolling, do not capture visible tab. When scrolling settles, refresh candidates & capture once!
  if (scrollEndTimer) clearTimeout(scrollEndTimer);
  scrollEndTimer = setTimeout(() => {
    isUserScrolling = false;
    requestScrollDiffCandidates();
    if (lastCapturedDiffCanvas && Math.abs((lastScrollState.scrollY || 0) - lastCapturedScrollY) > 2) {
      lastCapturedDiffCanvas = null;
    }
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
    // In swipe mode, live DOM subpixel diffs and layout shift hazard stripes are rendered
    // directly on top of Staging in the swipe base layer with zero flicker and 60fps responsiveness.
    isCapturingDiff = false;
    return;
  }
  if (currentMode === "overlay") {
    isCapturingDiff = false;
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
