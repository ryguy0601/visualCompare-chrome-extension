/**
 * VisualCompare Live - Studio: ZIP export/import and event log
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

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

if (diffToleranceSelect) {
  diffToleranceSelect.addEventListener("change", (e) => {
    currentDiffTolerance = parseInt(e.target.value, 10) || 20;
    lastCapturedDiffCanvas = null;
    lastAccuratePixelDiffPct = null;
    if (checkSyncRedDiff && checkSyncRedDiff.checked) {
      computeAndApplyRedDifferences(true);
      if (currentMode === "swipe" && swipeCompareMode === "diff") {
        renderSwipeDiffCanvas(activeRedDiffs, activeShiftRegions);
      } else if (currentMode === "side-by-side" && isColDiffActive) {
        renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
      } else if (currentMode === "overlay") {
        renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
      }
    }
    requestLivePixelDiff();
  });
}

if (btnShowShortcuts && shortcutsModal) {
  btnShowShortcuts.addEventListener("click", () => {
    shortcutsModal.style.display = "flex";
  });
}

if (btnCloseShortcutsModal && shortcutsModal) {
  btnCloseShortcutsModal.addEventListener("click", () => {
    shortcutsModal.style.display = "none";
  });
}

if (shortcutsModal) {
  shortcutsModal.addEventListener("click", (e) => {
    if (e.target === shortcutsModal) shortcutsModal.style.display = "none";
  });
}

function showCaptureProgress(title, status, percent) {
  if (captureProgressOverlay) {
    captureProgressOverlay.style.display = "flex";
    if (captureProgressTitle) captureProgressTitle.textContent = title;
    if (captureProgressStatus) captureProgressStatus.textContent = status;
    if (captureProgressBar) captureProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  }
}

function hideCaptureProgress() {
  if (captureProgressOverlay) {
    captureProgressOverlay.style.display = "none";
  }
}

function waitAsync(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastTabCaptureTimestamp = 0;

async function captureActiveTabPng() {
  if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
    return null;
  }
  const elapsed = Date.now() - lastTabCaptureTimestamp;
  if (lastTabCaptureTimestamp > 0 && elapsed < 510) {
    await waitAsync(510 - elapsed);
  }
  const attemptCapture = () => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVE_TAB" }, (res) => {
        if (res && res.status === "ok" && res.dataUrl) {
          lastTabCaptureTimestamp = Date.now();
          resolve({ dataUrl: res.dataUrl, error: null });
        } else {
          resolve({ dataUrl: null, error: (res && res.message) || "" });
        }
      });
    } catch (e) {
      resolve({ dataUrl: null, error: String(e && e.message || e) });
    }
  });

  let result = await attemptCapture();
  if (!result.dataUrl && result.error && result.error.includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND")) {
    await waitAsync(530);
    result = await attemptCapture();
  }
  return result.dataUrl;
}

async function requestHeadlessCapture(url, width = 1280, format = "both") {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") {
      resolve(null);
      return;
    }
    try {
      chrome.runtime.sendMessage({
        type: "CAPTURE_HEADLESS_PAGE",
        url,
        width,
        format
      }, (res) => {
        if (res && res.status === "ok" && res.pngDataUrl) {
          resolve(res);
        } else {
          resolve(null);
        }
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

function renderLiveDomToFullPageCanvas(ctx, iframe, captureReadyMsg, width, height) {
  let bodyBg = captureReadyMsg?.bodyBg || "";
  let bodyBgImage = captureReadyMsg?.bodyBgImage || "";
  let nodes = Array.isArray(captureReadyMsg?.visualNodes) ? captureReadyMsg.visualNodes : [];

  try {
    const doc = iframe?.contentDocument;
    const win = iframe?.contentWindow;
    if (doc && doc.body && win && doc.body.children && doc.body.children.length > 0) {
      const htmlStyle = doc.documentElement ? win.getComputedStyle(doc.documentElement) : null;
      const bodyStyle = win.getComputedStyle(doc.body);
      const bBg = bodyStyle?.backgroundColor;
      const hBg = htmlStyle?.backgroundColor;
      if (bBg && bBg !== "rgba(0, 0, 0, 0)" && bBg !== "transparent") bodyBg = bBg;
      else if (hBg && hBg !== "rgba(0, 0, 0, 0)" && hBg !== "transparent") bodyBg = hBg;
      const bImg = bodyStyle?.backgroundImage;
      const hImg = htmlStyle?.backgroundImage;
      if (bImg && bImg !== "none") bodyBgImage = bImg;
      else if (hImg && hImg !== "none") bodyBgImage = hImg;

      const liveNodes = [];
      const scrollX = win.scrollX || win.pageXOffset || 0;
      const scrollY = win.scrollY || win.pageYOffset || 0;
      const allEls = doc.body.querySelectorAll("*");
      for (let i = 0; i < allEls.length && liveNodes.length < 700; i++) {
        const el = allEls[i];
        if (!el || el.classList?.contains("vc-hazard-stripe-spacer") || el.id === "vc-ghost-cursor") continue;
        const tag = (el.tagName || "").toLowerCase();
        if (tag === "script" || tag === "style" || tag === "link" || tag === "meta" || tag === "noscript") continue;
        const cs = win.getComputedStyle(el);
        if (!cs || cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (!r || r.width <= 0 || r.height <= 0) continue;

        let directText = "";
        for (let c = 0; c < el.childNodes.length; c++) {
          const cn = el.childNodes[c];
          if (cn.nodeType === 3 && cn.nodeValue) {
            directText += cn.nodeValue;
          }
        }
        directText = directText.replace(/\s+/g, " ").trim();
        if (!directText && (tag === "input" || tag === "textarea")) {
          directText = (el.value || el.getAttribute("placeholder") || "").trim();
        }

        const bg = el.dataset?.vcOriginalBg || cs.backgroundColor || "";
        const bgImage = cs.backgroundImage && cs.backgroundImage !== "none" ? cs.backgroundImage : "";
        const hasBg = (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") || Boolean(bgImage);
        const bTopW = parseFloat(cs.borderTopWidth) || 0;
        const bRightW = parseFloat(cs.borderRightWidth) || 0;
        const bBottomW = parseFloat(cs.borderBottomWidth) || 0;
        const bLeftW = parseFloat(cs.borderLeftWidth) || 0;
        const hasBorder = (bTopW > 0 || bRightW > 0 || bBottomW > 0 || bLeftW > 0);
        const isImg = tag === "img" || tag === "canvas";

        if (!hasBg && !hasBorder && !directText && !isImg) continue;

        liveNodes.push({
          tag,
          el: isImg ? el : null,
          x: Math.round(r.left + scrollX),
          y: Math.round(r.top + scrollY),
          width: Math.round(r.width),
          height: Math.round(r.height),
          text: directText,
          style: {
            bg: hasBg ? bg : "",
            bgImage,
            backgroundClip: cs.webkitBackgroundClip || cs.backgroundClip || "",
            color: cs.color || "#000000",
            borderColor: cs.borderTopColor || cs.borderColor || "",
            borderBottomColor: cs.borderBottomColor || "",
            borderWidth: Math.max(bTopW, bLeftW),
            borderBottomWidth: bBottomW,
            radius: parseFloat(cs.borderRadius) || 0,
            fontSize: cs.fontSize || "14px",
            fontWeight: cs.fontWeight || "400",
            fontFamily: cs.fontFamily || "sans-serif",
            fontStyle: cs.fontStyle || "normal",
            lineHeight: cs.lineHeight || "",
            textAlign: cs.textAlign || "left",
            justifyContent: cs.justifyContent || "",
            alignItems: cs.alignItems || "",
            display: cs.display || "",
            paddingLeft: parseFloat(cs.paddingLeft) || 0,
            paddingRight: parseFloat(cs.paddingRight) || 0,
            paddingTop: parseFloat(cs.paddingTop) || 0,
            paddingBottom: parseFloat(cs.paddingBottom) || 0
          }
        });
      }
      if (liveNodes.length > 0) {
        nodes = liveNodes;
      }
    }
  } catch (e) {}

  if (!nodes || nodes.length === 0) {
    return false;
  }

  ctx.save();
  ctx.fillStyle = bodyBg || "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (bodyBgImage && typeof applyCanvasBackground === "function") {
    ctx.save();
    applyCanvasBackground(ctx, bodyBgImage, width, height, 0);
    ctx.restore();
  }

  nodes.forEach(node => {
    if (!node || node.width <= 0 || node.height <= 0) return;
    const nx = node.x;
    const ny = node.y;
    const nw = node.width;
    const nh = node.height;
    const st = node.style || {};
    const radius = Math.min(st.radius || 0, nw / 2, nh / 2);
    const isGradText = st.backgroundClip === "text";

    ctx.save();
    ctx.translate(nx, ny);

    if (st.bg && st.bg !== "rgba(0, 0, 0, 0)" && st.bg !== "transparent") {
      if (typeof applyCanvasBackground === "function") {
        applyCanvasBackground(ctx, st.bg, nw, nh, radius);
      } else {
        ctx.fillStyle = st.bg;
        ctx.fillRect(0, 0, nw, nh);
      }
    }
    if (st.bgImage && !isGradText && typeof applyCanvasBackground === "function") {
      applyCanvasBackground(ctx, st.bgImage, nw, nh, radius);
    }

    if (node.el) {
      try {
        ctx.drawImage(node.el, 0, 0, nw, nh);
      } catch (e) {}
    }

    if (st.borderWidth > 0 && st.borderColor && st.borderColor !== "rgba(0, 0, 0, 0)" && st.borderColor !== "transparent") {
      ctx.strokeStyle = st.borderColor;
      ctx.lineWidth = st.borderWidth;
      ctx.beginPath();
      if (radius > 0 && typeof ctx.roundRect === "function") {
        ctx.roundRect(st.borderWidth / 2, st.borderWidth / 2, Math.max(1, nw - st.borderWidth), Math.max(1, nh - st.borderWidth), radius);
      } else {
        ctx.rect(st.borderWidth / 2, st.borderWidth / 2, Math.max(1, nw - st.borderWidth), Math.max(1, nh - st.borderWidth));
      }
      ctx.stroke();
    } else if (st.borderBottomWidth > 0 && st.borderBottomColor && st.borderBottomColor !== "rgba(0, 0, 0, 0)") {
      ctx.fillStyle = st.borderBottomColor;
      ctx.fillRect(0, nh - st.borderBottomWidth, nw, st.borderBottomWidth);
    }

    if (node.text) {
      const fSize = parseFloat(st.fontSize) || 14;
      const fontStr = `${st.fontStyle || "normal"} ${st.fontWeight || "400"} ${st.fontSize || "14px"} ${st.fontFamily || "sans-serif"}`;
      ctx.font = fontStr;
      if (isGradText && st.bgImage) {
        const stops = st.bgImage.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/gi);
        if (stops && stops.length >= 2 && typeof ctx.createLinearGradient === "function") {
          const grad = ctx.createLinearGradient(0, 0, nw, 0);
          stops.forEach((c, idx) => grad.addColorStop(idx / (stops.length - 1), c));
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = (stops && stops[0]) || st.color || "#38bdf8";
        }
      } else {
        ctx.fillStyle = st.color || "#000000";
      }

      const padL = st.paddingLeft || 0;
      const padR = st.paddingRight || 0;
      const padT = st.paddingTop || 0;
      const maxTextW = Math.max(20, nw - padL - padR);
      const words = node.text.split(/\s+/).filter(Boolean);
      const lines = [];
      if (words.length <= 1 || typeof ctx.measureText !== "function") {
        lines.push(node.text);
      } else {
        let cur = words[0];
        for (let wIdx = 1; wIdx < words.length; wIdx++) {
          const next = cur + " " + words[wIdx];
          const m = ctx.measureText(next);
          if (m && m.width > maxTextW + 4) {
            lines.push(cur);
            cur = words[wIdx];
          } else {
            cur = next;
          }
        }
        if (cur) lines.push(cur);
      }

      const parsedLH = parseFloat(st.lineHeight);
      const lineH = (!isNaN(parsedLH) && parsedLH > 0) ? parsedLH : Math.round(fSize * 1.3);
      const isCentered = st.textAlign === "center" || st.justifyContent === "center";
      const isRight = st.textAlign === "right" || st.justifyContent === "flex-end";
      ctx.textAlign = isCentered ? "center" : (isRight ? "right" : "left");
      ctx.textBaseline = "middle";
      const tx = isCentered ? (nw / 2) : (isRight ? Math.max(0, nw - padR) : padL);
      const totalTextH = lines.length * lineH;
      const startY = lines.length <= 1
        ? (nh / 2)
        : (padT > 0 && totalTextH + padT <= nh + 8 ? padT + (lineH / 2) : Math.max(lineH / 2, ((nh - totalTextH) / 2) + (lineH / 2)));

      lines.forEach((line, idx) => {
        const ty = startY + idx * lineH;
        if (ty <= nh + lineH / 2) {
          ctx.fillText(line, tx, ty);
        }
      });
    }

    ctx.restore();
  });

  ctx.restore();
  return true;
}

function renderFallbackFullPageCanvas(ctx, title, url, width, height, colorRgb) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = `rgb(${Math.round(colorRgb[0] * 255)}, ${Math.round(colorRgb[1] * 255)}, ${Math.round(colorRgb[2] * 255)})`;
  ctx.fillRect(0, 0, width, 80);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`VISUALCOMPARE LIVE - ${title}`, 24, 40);
  ctx.font = "12px monospace";
  ctx.fillText(url || "about:blank", 24, 64);

  let curY = 110;
  const count = Math.max(3, Math.floor((height - 150) / 200));
  for (let s = 0; s < count; s++) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(24, curY, width - 48, 160);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`Section Landmark #${s + 1}`, 44, curY + 36);
    ctx.fillStyle = "#64748b";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Rendered DOM element alignment plate with layout shift detection.", 44, curY + 64);
    curY += 180;
    if (curY + 160 > height) break;
  }
}

/**
 * Captures the entire full-page canvas for Production, Staging, and Visual Diff.
 * Full-screens the live page vertically (100vw x 100vh) during capture so all studio controls,
 * toolbars, headers, and footers are hidden, capturing full vertical monitor slices with
 * zero overlap tiling and zero black screens.
 */
async function captureFullPageAuditCanvases(onProgress = () => {}, options = {}) {
  isUserScrolling = true;
  onProgress({ percent: 5, status: "Preparing full-page capture..." });

  const prodUrl = prodUrlInput.value.trim();
  const stgUrl = stgUrlInput.value.trim();

  // Determine target width and aspect ratio from selected device preset
  const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
  let presetW = 0;
  let presetH = 0;
  if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
    const [wStr, hStr] = selectedPreset.split("x");
    presetW = parseInt(wStr, 10) || 0;
    presetH = parseInt(hStr, 10) || 0;
  }

  const prevMode = currentMode;
  const prevScrollY = lastScrollState.scrollY || 0;
  const prevScrollX = lastScrollState.scrollX || 0;

  const paneProd = document.getElementById("pane-col-prod");
  const paneStg = document.getElementById("pane-col-stg");
  const paneDiff = document.getElementById("pane-col-diff");

  if (currentMode !== "side-by-side") {
    switchMode("side-by-side");
    await waitAsync(150);
  }

  // Hide container wrapper scrollbars during capture so no scrollbars appear on captured edges
  if (wrapFrameProd) wrapFrameProd.style.overflow = "hidden";
  if (wrapFrameStg) wrapFrameStg.style.overflow = "hidden";
  if (viewportScaler) viewportScaler.style.transform = "";
  if (iframeProd) iframeProd.style.transform = "";
  if (iframeStg) iframeStg.style.transform = "";

  // 1. Activate vertical fullscreen capture mode on body
  // This hides studio header, url sync bar, controls bar, footer, and pane headers via CSS !important
  document.body.classList.add("capture-fullscreen-vertical");

  // Configure pane width, scale, and aspect ratio based on selected device preset
  let captureScale = 1;
  if (presetW > 0) {
    if (presetW > window.innerWidth) {
      captureScale = window.innerWidth / presetW;
      document.body.style.setProperty("--capture-pane-width", `${presetW}px`);
      document.body.style.setProperty("--capture-pane-left", "0px");
      document.body.style.setProperty("--capture-pane-transform", `scale(${captureScale})`);
    } else {
      captureScale = 1;
      document.body.style.setProperty("--capture-pane-width", `${presetW}px`);
      document.body.style.setProperty("--capture-pane-left", "0px");
      document.body.style.removeProperty("--capture-pane-transform");
    }
  } else {
    captureScale = 1;
    document.body.style.removeProperty("--capture-pane-width");
    document.body.style.removeProperty("--capture-pane-left");
    document.body.style.removeProperty("--capture-pane-transform");
  }

  // Phase 1: Set Production pane active for initial dimension measurement and capture
  if (paneStg) {
    paneStg.style.display = "none";
    paneStg.classList.remove("active-capture-pane");
  }
  if (paneDiff) paneDiff.style.display = "none";
  if (paneProd) {
    paneProd.style.display = "flex";
    paneProd.style.flex = "1 1 100%";
    paneProd.style.width = "100%";
    paneProd.style.height = "100%";
    paneProd.classList.add("active-capture-pane");
  }

  await waitAsync(80);

  lastCaptureReadyProd = null;
  lastCaptureReadyStg = null;

  // 2. Freeze animations & carousels matching Python browser.py (evaluated at active aspect ratio)
  if (iframeProd && iframeProd.contentWindow) {
    try { iframeProd.contentWindow.postMessage({ type: "VC_PREPARE_CAPTURE" }, "*"); } catch (e) {}
  }
  if (iframeStg && iframeStg.contentWindow) {
    try { iframeStg.contentWindow.postMessage({ type: "VC_PREPARE_CAPTURE" }, "*"); } catch (e) {}
  }

  await waitAsync(350);

  // 3. Measure document dimensions accurately at the selected aspect ratio / device width
  const docHeightProd = lastCaptureReadyProd?.docHeight || lastProdLandmarks?.docHeight || iframeProd?.contentDocument?.documentElement?.scrollHeight || iframeProd?.clientHeight || 1200;
  const docHeightStg = lastCaptureReadyStg?.docHeight || lastStgLandmarks?.docHeight || iframeStg?.contentDocument?.documentElement?.scrollHeight || iframeStg?.clientHeight || 1200;
  let totalH = Math.max(docHeightProd, docHeightStg, 800);
  totalH = Math.min(totalH, 14000);

  const rProd = iframeProd ? iframeProd.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  let frameW = Math.max(800, Math.round(rProd.width));
  if (presetW > 0) {
    frameW = presetW;
  }

  const visibleH = captureScale < 1
    ? Math.max(300, Math.round(window.innerHeight / captureScale))
    : Math.max(300, Math.round(window.innerHeight));

  const canvasProd = document.createElement("canvas");
  canvasProd.width = frameW;
  canvasProd.height = totalH;
  const ctxProd = canvasProd.getContext("2d");
  ctxProd.fillStyle = "#ffffff";
  ctxProd.fillRect(0, 0, frameW, totalH);

  const canvasStg = document.createElement("canvas");
  canvasStg.width = frameW;
  canvasStg.height = totalH;
  const ctxStg = canvasStg.getContext("2d");
  ctxStg.fillStyle = "#ffffff";
  ctxStg.fillRect(0, 0, frameW, totalH);

  let captureSucceeded = false;

  try {
    // 4. Capture full-width Production vertical slices with zero overlap (non-overlapping tiles)
    let curY = 0;
    let sliceIdx = 0;
    while (curY < totalH) {
      const remainingH = totalH - curY;
      const isLast = remainingH <= visibleH;
      const targetScrollY = isLast ? Math.max(0, totalH - visibleH) : curY;
      const pct = Math.round(10 + (Math.min(curY + visibleH, totalH) / (totalH * 2)) * 40);
      onProgress({ percent: pct, status: `Capturing Production vertical slices (${Math.round((curY / totalH) * 100)}%)...` });

      const scrollAction = {
        type: "VC_MIRROR_ACTION",
        action: { kind: "scroll", scrollY: targetScrollY, scrollX: 0 }
      };
      if (iframeProd && iframeProd.contentWindow) {
        try {
          iframeProd.contentWindow.postMessage({ type: "VC_CAPTURE_SLICE_START", sliceIndex: sliceIdx }, "*");
          iframeProd.contentWindow.postMessage(scrollAction, "*");
        } catch (e) {}
      }
      if (wrapFrameProd) wrapFrameProd.scrollTop = targetScrollY;

      await waitAsync(110);

      if (captureProgressOverlay) captureProgressOverlay.style.visibility = "hidden";
      await waitAsync(35);
      const dataUrl = await captureActiveTabPng();
      if (captureProgressOverlay) captureProgressOverlay.style.visibility = "visible";

      if (dataUrl) {
        captureSucceeded = true;
        const img = await loadImageAsync(dataUrl);
        const dpr = img.width / Math.max(1, window.innerWidth);

        const cropProdLeft = Math.round((rProd.left || 0) * dpr);
        const cropProdTop = Math.round((rProd.top || 0) * dpr);
        const cropProdW = Math.round(frameW * captureScale * dpr);

        if (!isLast) {
          const sliceDrawH = Math.min(visibleH, remainingH);
          const srcDrawH = Math.round(sliceDrawH * captureScale * dpr);
          ctxProd.drawImage(img, cropProdLeft, cropProdTop, cropProdW, srcDrawH, 0, curY, frameW, sliceDrawH);
          curY += sliceDrawH;
        } else {
          // Final tile: crop ONLY the uncaptured remaining delta from the bottom of the visible frame!
          const deltaH = remainingH;
          const srcOffsetY = Math.round((visibleH - deltaH) * dpr);
          const scaledSrcOffsetY = captureScale < 1 ? Math.round(srcOffsetY * captureScale) : srcOffsetY;
          const srcDrawH = Math.round(deltaH * captureScale * dpr);
          ctxProd.drawImage(img, cropProdLeft, cropProdTop + scaledSrcOffsetY, cropProdW, srcDrawH, 0, curY, frameW, deltaH);
          curY += deltaH;
        }
      } else {
        curY += visibleH;
      }
      sliceIdx++;
    }

    // Phase 2: Full-screen Staging pane vertically and horizontally at the selected aspect ratio
    if (paneProd) {
      paneProd.style.display = "none";
      paneProd.classList.remove("active-capture-pane");
    }
    if (paneStg) {
      paneStg.style.display = "flex";
      paneStg.style.flex = "1 1 100%";
      paneStg.style.width = "100%";
      paneStg.style.height = "100%";
      paneStg.classList.add("active-capture-pane");
    }
    await waitAsync(80);
    const rStg = iframeStg ? iframeStg.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    curY = 0;
    sliceIdx = 0;
    while (curY < totalH) {
      const remainingH = totalH - curY;
      const isLast = remainingH <= visibleH;
      const targetScrollY = isLast ? Math.max(0, totalH - visibleH) : curY;
      const pct = Math.round(50 + (Math.min(curY + visibleH, totalH) / (totalH * 2)) * 35);
      onProgress({ percent: pct, status: `Capturing Staging vertical slices (${Math.round((curY / totalH) * 100)}%)...` });

      const scrollAction = {
        type: "VC_MIRROR_ACTION",
        action: { kind: "scroll", scrollY: targetScrollY, scrollX: 0 }
      };
      if (iframeStg && iframeStg.contentWindow) {
        try {
          iframeStg.contentWindow.postMessage({ type: "VC_CAPTURE_SLICE_START", sliceIndex: sliceIdx }, "*");
          iframeStg.contentWindow.postMessage(scrollAction, "*");
        } catch (e) {}
      }
      if (wrapFrameStg) wrapFrameStg.scrollTop = targetScrollY;

      await waitAsync(110);

      if (captureProgressOverlay) captureProgressOverlay.style.visibility = "hidden";
      await waitAsync(35);
      const dataUrl = await captureActiveTabPng();
      if (captureProgressOverlay) captureProgressOverlay.style.visibility = "visible";

      if (dataUrl) {
        const img = await loadImageAsync(dataUrl);
        const dpr = img.width / Math.max(1, window.innerWidth);

        const cropStgLeft = Math.round((rStg.left || 0) * dpr);
        const cropStgTop = Math.round((rStg.top || 0) * dpr);
        const cropStgW = Math.round(frameW * captureScale * dpr);

        if (!isLast) {
          const sliceDrawH = Math.min(visibleH, remainingH);
          const srcDrawH = Math.round(sliceDrawH * captureScale * dpr);
          ctxStg.drawImage(img, cropStgLeft, cropStgTop, cropStgW, srcDrawH, 0, curY, frameW, sliceDrawH);
          curY += sliceDrawH;
        } else {
          // Final tile: crop ONLY the uncaptured remaining delta from the bottom of the visible frame!
          const deltaH = remainingH;
          const srcOffsetY = Math.round((visibleH - deltaH) * dpr);
          const scaledSrcOffsetY = captureScale < 1 ? Math.round(srcOffsetY * captureScale) : srcOffsetY;
          const srcDrawH = Math.round(deltaH * captureScale * dpr);
          ctxStg.drawImage(img, cropStgLeft, cropStgTop + scaledSrcOffsetY, cropStgW, srcDrawH, 0, curY, frameW, deltaH);
          curY += deltaH;
        }
      } else {
        curY += visibleH;
      }
      sliceIdx++;
    }
  } catch (err) {
    console.warn("[VisualCompare Live] Vertical stage capture warning:", err);
  } finally {
    document.body.classList.remove("capture-fullscreen-vertical");
    document.body.style.removeProperty("--capture-pane-width");
    document.body.style.removeProperty("--capture-pane-left");
    document.body.style.removeProperty("--capture-pane-transform");
    if (paneProd) {
      paneProd.classList.remove("active-capture-pane");
      paneProd.style.display = "";
      paneProd.style.flex = "";
      paneProd.style.width = "";
      paneProd.style.height = "";
    }
    if (paneStg) {
      paneStg.classList.remove("active-capture-pane");
      paneStg.style.display = "";
      paneStg.style.flex = "";
      paneStg.style.width = "";
      paneStg.style.height = "";
    }
    if (paneDiff) {
      paneDiff.style.display = "";
    }
    if (wrapFrameProd) wrapFrameProd.style.overflow = "";
    if (wrapFrameStg) wrapFrameStg.style.overflow = "";
    if (captureProgressOverlay) {
      captureProgressOverlay.style.visibility = "visible";
    }
    if (typeof applyViewportPresetAndZoom === "function") {
      applyViewportPresetAndZoom(zoomSelect ? zoomSelect.value === "auto" : false);
    }
    if (typeof applyColumnZoomTransforms === "function") {
      applyColumnZoomTransforms();
    }
  }

  // Fallback if browser screenshot API was unavailable: render the live website DOM directly
  if (!captureSucceeded) {
    const renderedProd = renderLiveDomToFullPageCanvas(ctxProd, iframeProd, lastCaptureReadyProd, frameW, totalH);
    if (!renderedProd) {
      renderFallbackFullPageCanvas(ctxProd, "PRODUCTION REFERENCE", prodUrlInput.value.trim(), frameW, totalH, [0.08, 0.25, 0.55]);
    }
    const renderedStg = renderLiveDomToFullPageCanvas(ctxStg, iframeStg, lastCaptureReadyStg, frameW, totalH);
    if (!renderedStg) {
      renderFallbackFullPageCanvas(ctxStg, "STAGING CANDIDATE", stgUrlInput.value.trim(), frameW, totalH, [0.30, 0.14, 0.52]);
    }
  }

  // Restore scroll and mode
  const restoreAction = {
    type: "VC_MIRROR_ACTION",
    action: { kind: "scroll", scrollY: prevScrollY, scrollX: prevScrollX }
  };
  if (iframeProd && iframeProd.contentWindow) {
    try { iframeProd.contentWindow.postMessage(restoreAction, "*"); } catch (e) {}
  }
  if (iframeStg && iframeStg.contentWindow) {
    try { iframeStg.contentWindow.postMessage(restoreAction, "*"); } catch (e) {}
  }
  if (wrapFrameProd) wrapFrameProd.scrollTop = prevScrollY;
  if (wrapFrameStg) wrapFrameStg.scrollTop = prevScrollY;
  lastScrollState.scrollY = prevScrollY;
  lastScrollState.scrollX = prevScrollX;

  if (prevMode !== "side-by-side") {
    switchMode(prevMode);
  }

  // Restore CSS animations
  if (iframeProd && iframeProd.contentWindow) {
    try { iframeProd.contentWindow.postMessage({ type: "VC_RESTORE_CAPTURE" }, "*"); } catch (e) {}
  }
  if (iframeStg && iframeStg.contentWindow) {
    try { iframeStg.contentWindow.postMessage({ type: "VC_RESTORE_CAPTURE" }, "*"); } catch (e) {}
  }

  onProgress({ percent: 75, status: "Calculating full-page subpixel differences..." });

  // 4. Generate canvasDiff with subpixel pixel diff and yellow hazard stripes
  const canvasDiff = document.createElement("canvas");
  canvasDiff.width = frameW;
  canvasDiff.height = totalH;
  const ctxDiff = canvasDiff.getContext("2d");
  ctxDiff.drawImage(canvasStg, 0, 0);

  if (activeShiftRegions && activeShiftRegions.length > 0) {
    activeShiftRegions.forEach(reg => {
      drawHazardStripes(ctxDiff, 0, reg.y, frameW, reg.h);
      drawCanvasShiftBadge(ctxDiff, frameW, reg.y, reg.h, reg.delta);
    });
  }

  let diffMismatchPct = "0.00%";
  let diffPixels = 0;
  if (!options.skipDiffCalculation) {
    try {
      const dataP = ctxProd.getImageData(0, 0, frameW, totalH).data;
      const dataS = ctxStg.getImageData(0, 0, frameW, totalH).data;
      const res = computeSubpixelPixelDiff(dataP, dataS, frameW, totalH, currentDiffTolerance || 20, activeShiftRegions);
      diffPixels = res.diffPixels;

      const diffImg = new ImageData(res.outData, frameW, totalH);
      const tempC = document.createElement("canvas");
      tempC.width = frameW;
      tempC.height = totalH;
      tempC.getContext("2d").putImageData(diffImg, 0, 0);
      ctxDiff.drawImage(tempC, 0, 0);

      const totalPixels = frameW * totalH;
      diffMismatchPct = ((diffPixels / Math.max(1, totalPixels)) * 100).toFixed(2) + "%";
    } catch (e) {
      console.warn("[VisualCompare Live] Error calculating full-page diff:", e);
    }
  }

  onProgress({ percent: 95, status: "Compiling full-page visual PDFs..." });
  isUserScrolling = false;

  return {
    canvasProd,
    canvasStg,
    canvasDiff,
    width: frameW,
    height: totalH,
    diffMismatchPct,
    diffPixels
  };
}

let lastGoFullPageAudit = null;
let currentGoFullPageView = "stg"; // "stg", "prod", "diff"

function cropCanvasToDeviceSize(srcCanvas, targetW, targetH) {
  if (!srcCanvas || !targetW || !targetH) return srcCanvas;
  if (srcCanvas.width === targetW && srcCanvas.height === targetH) return srcCanvas;
  const cropped = document.createElement("canvas");
  cropped.width = targetW;
  cropped.height = targetH;
  const ctx = cropped.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(srcCanvas, 0, 0, Math.min(srcCanvas.width, targetW), Math.min(srcCanvas.height, targetH), 0, 0, Math.min(srcCanvas.width, targetW), Math.min(srcCanvas.height, targetH));
  return cropped;
}

function renderGoFullPagePreview(viewKey) {
  currentGoFullPageView = viewKey;
  if (!lastGoFullPageAudit || !gofullpagePreviewCanvas) return;

  let targetCanvas = lastGoFullPageAudit.canvasStg;
  let label = "Candidate (Staging)";
  if (viewKey === "prod") {
    targetCanvas = lastGoFullPageAudit.canvasProd;
    label = "Reference (Production)";
  } else if (viewKey === "diff") {
    targetCanvas = lastGoFullPageAudit.canvasDiff || lastGoFullPageAudit.canvasStg;
    label = "Visual Differences";
  }

  const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
  let devW = 0;
  let devH = 0;
  if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
    const [wStr, hStr] = selectedPreset.split("x");
    devW = parseInt(wStr, 10) || 0;
    devH = parseInt(hStr, 10) || 0;
  }
  if (targetCanvas && devW > 0 && devH > 0) {
    targetCanvas = cropCanvasToDeviceSize(targetCanvas, devW, devH);
  }

  if (btnGofullpageViewStg) btnGofullpageViewStg.classList.toggle("active", viewKey === "stg");
  if (btnGofullpageViewProd) btnGofullpageViewProd.classList.toggle("active", viewKey === "prod");
  if (btnGofullpageViewDiff) btnGofullpageViewDiff.classList.toggle("active", viewKey === "diff");

  if (gofullpageViewerTitle) gofullpageViewerTitle.textContent = `GoFullPage Visual Capture - ${label}`;
  if (gofullpageViewerDims && targetCanvas) {
    gofullpageViewerDims.textContent = `${targetCanvas.width} × ${targetCanvas.height} px • 1-Page Continuous PDF`;
  }

  if (targetCanvas) {
    gofullpagePreviewCanvas.width = targetCanvas.width;
    gofullpagePreviewCanvas.height = targetCanvas.height;
    const ctx = gofullpagePreviewCanvas.getContext("2d");
    ctx.drawImage(targetCanvas, 0, 0);
  }
}

async function handleGoFullPageExportFlow(autoDownloadFormat = "pdf") {
  if (pdfExportModal) pdfExportModal.style.display = "none";
  if (!window.VisualCompareZip || typeof window.VisualCompareZip.buildGoFullPagePdf !== "function") {
    alert("GoFullPage export engine initializing, please try again in a moment.");
    return;
  }

  try {
    showCaptureProgress("GoFullPage Visual Capture", "Scanning document dimensions and preparing capture...", 5);
    const audit = await captureFullPageAuditCanvases((p) => {
      showCaptureProgress("GoFullPage Visual Capture", p.status, p.percent);
    }, { skipDiffCalculation: true });
    lastGoFullPageAudit = audit;

    const dateStr = new Date().toISOString().slice(0, 10);
    const meta = {
      prodUrl: prodUrlInput.value.trim(),
      stgUrl: stgUrlInput.value.trim(),
      timestamp: new Date().toLocaleString(),
      device: viewportSelect.value,
      currentMode,
      hazardSpacers: activeHazardSpacers,
      redDiffs: activeRedDiffs,
      totalShiftDelta: document.getElementById("metric-shift-val") ? document.getElementById("metric-shift-val").textContent : "+0px",
      diffMismatchPct: audit.diffMismatchPct || (document.getElementById("metric-diff-pct") ? document.getElementById("metric-diff-pct").textContent : "0.00%"),
      canvasProd: audit.canvasProd,
      canvasStg: audit.canvasStg,
      canvasDiff: audit.canvasDiff
    };

    const isProdFocused = (typeof focusedColumn !== "undefined" && focusedColumn === "prod") ||
      (currentMode === "flicker" && typeof activeFlickerPane !== "undefined" && activeFlickerPane === "prod") ||
      (!stgUrlInput.value.trim() || stgUrlInput.value.trim() === "about:blank");
    const activeView = isProdFocused ? "prod" : "stg";

    // Crop canvases strictly to selected device size if a device preset is selected
    const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
    let devW = 0;
    let devH = 0;
    if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
      const [wStr, hStr] = selectedPreset.split("x");
      devW = parseInt(wStr, 10) || 0;
      devH = parseInt(hStr, 10) || 0;
    }
    if (devW > 0 && devH > 0) {
      if (meta.canvasProd) meta.canvasProd = cropCanvasToDeviceSize(meta.canvasProd, devW, devH);
      if (meta.canvasStg) meta.canvasStg = cropCanvasToDeviceSize(meta.canvasStg, devW, devH);
      if (meta.canvasDiff) meta.canvasDiff = cropCanvasToDeviceSize(meta.canvasDiff, devW, devH);
    }

    if (autoDownloadFormat === "pdf") {
      showCaptureProgress("Generating Full-Page PDF", "Building continuous 1-page PDF document...", 94);
      await waitAsync(60);
      const res = window.VisualCompareZip.exportSinglePdf(meta, activeView);
      showToast("PDF Exported Successfully", `Saved ${res.filename} (1 continuous page).`);
    } else if (autoDownloadFormat === "png") {
      showCaptureProgress("Generating Full-Page PNG", "Encoding lossless PNG image...", 94);
      await waitAsync(60);
      let targetCanvas = (activeView === "prod" ? meta.canvasProd : meta.canvasStg) || meta.canvasStg || meta.canvasProd;
      if (devW > 0 && devH > 0) {
        targetCanvas = cropCanvasToDeviceSize(targetCanvas, devW, devH);
      }
      const res = window.VisualCompareZip.exportSinglePng(targetCanvas, `visualcompare-${activeView}-${dateStr}.png`);
      showToast("PNG Downloaded Successfully", `Saved ${res.filename} (lossless PNG).`);
    }

    hideCaptureProgress();
    if (gofullpageViewerModal) {
      gofullpageViewerModal.style.display = "none";
    }
  } catch (err) {
    hideCaptureProgress();
    console.error("Export error:", err);
    alert("Failed to export: " + err.message);
  }
}

async function handleExportPdfFlow(type = "master") {
  if (pdfExportModal) pdfExportModal.style.display = "none";
  if (gofullpageViewerModal) gofullpageViewerModal.style.display = "none";
  if (!window.VisualCompareZip || typeof window.VisualCompareZip.exportSinglePdf !== "function") {
    alert("PDF export engine initializing, please try again in a moment.");
    return;
  }

  try {
    showCaptureProgress("Capturing Full-Page Visual Audit", "Initializing high-resolution full-page capture...", 5);
    const audit = await captureFullPageAuditCanvases((p) => {
      showCaptureProgress("Capturing Full-Page Visual Audit", p.status, p.percent);
    });
    lastGoFullPageAudit = audit;

    showCaptureProgress("Compiling PDF Document", "Generating clean continuous full-page PDF...", 92);
    await waitAsync(80);

    const meta = {
      prodUrl: prodUrlInput.value.trim(),
      stgUrl: stgUrlInput.value.trim(),
      timestamp: new Date().toLocaleString(),
      device: viewportSelect.value,
      currentMode,
      hazardSpacers: activeHazardSpacers,
      redDiffs: activeRedDiffs,
      totalShiftDelta: document.getElementById("metric-shift-val") ? document.getElementById("metric-shift-val").textContent : "+0px",
      diffMismatchPct: audit.diffMismatchPct || (document.getElementById("metric-diff-pct") ? document.getElementById("metric-diff-pct").textContent : "0.00%"),
      canvasProd: audit.canvasProd,
      canvasStg: audit.canvasStg,
      canvasDiff: audit.canvasDiff
    };

    const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
    let devW = 0;
    let devH = 0;
    if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
      const [wStr, hStr] = selectedPreset.split("x");
      devW = parseInt(wStr, 10) || 0;
      devH = parseInt(hStr, 10) || 0;
    }
    if (devW > 0 && devH > 0) {
      if (meta.canvasProd) meta.canvasProd = cropCanvasToDeviceSize(meta.canvasProd, devW, devH);
      if (meta.canvasStg) meta.canvasStg = cropCanvasToDeviceSize(meta.canvasStg, devW, devH);
      if (meta.canvasDiff) meta.canvasDiff = cropCanvasToDeviceSize(meta.canvasDiff, devW, devH);
    }

    const res = window.VisualCompareZip.exportSinglePdf(meta, type);
    hideCaptureProgress();
    showToast("PDF Exported Successfully", `Saved ${res.filename} (1 continuous page).`);

    if (gofullpageViewerModal) {
      gofullpageViewerModal.style.display = "none";
    }
  } catch (err) {
    hideCaptureProgress();
    console.error("PDF Export error:", err);
    alert("Failed to export PDF: " + err.message);
  }
}

async function handleExportZipFlow() {
  if (pdfExportModal) pdfExportModal.style.display = "none";
  if (!window.VisualCompareZip || typeof window.VisualCompareZip.exportComparisonZip !== "function") {
    alert("Export engine initializing, please try again in a moment.");
    return;
  }

  try {
    showCaptureProgress("Capturing Full-Page Visual Audit", "Scanning document dimensions and preparing capture...", 5);
    const audit = await captureFullPageAuditCanvases((p) => {
      showCaptureProgress("Capturing Full-Page Visual Audit", p.status, p.percent);
    });

    showCaptureProgress("Building ZIP Package", "Compiling full-page PDFs, PNG screenshots, JSON and offline HTML viewer...", 90);
    await waitAsync(80);

    const meta = {
      prodUrl: prodUrlInput.value.trim(),
      stgUrl: stgUrlInput.value.trim(),
      timestamp: new Date().toLocaleString(),
      device: viewportSelect.value,
      currentMode,
      hazardSpacers: activeHazardSpacers,
      redDiffs: activeRedDiffs,
      totalShiftDelta: document.getElementById("metric-shift-val") ? document.getElementById("metric-shift-val").textContent : "+0px",
      diffMismatchPct: audit.diffMismatchPct || (document.getElementById("metric-diff-pct") ? document.getElementById("metric-diff-pct").textContent : "0.00%"),
      canvasProd: audit.canvasProd,
      canvasStg: audit.canvasStg,
      canvasDiff: audit.canvasDiff
    };

    const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
    let devW = 0;
    let devH = 0;
    if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
      const [wStr, hStr] = selectedPreset.split("x");
      devW = parseInt(wStr, 10) || 0;
      devH = parseInt(hStr, 10) || 0;
    }
    if (devW > 0 && devH > 0) {
      if (meta.canvasProd) meta.canvasProd = cropCanvasToDeviceSize(meta.canvasProd, devW, devH);
      if (meta.canvasStg) meta.canvasStg = cropCanvasToDeviceSize(meta.canvasStg, devW, devH);
      if (meta.canvasDiff) meta.canvasDiff = cropCanvasToDeviceSize(meta.canvasDiff, devW, devH);
    }

    const res = window.VisualCompareZip.exportComparisonZip(meta);
    hideCaptureProgress();
    showToast("Package Exported Successfully", `Saved ${res.filename} with Full-Page PDFs, screenshots, and diff report.`);
  } catch (err) {
    hideCaptureProgress();
    console.error("ZIP Export error:", err);
    alert("Failed to export ZIP package: " + err.message);
  }
}

// GoFullPage Direct Export Actions (Matches GoFullPage Chrome Extension)
if (btnExportPdf) {
  btnExportPdf.addEventListener("click", () => {
    handleGoFullPageExportFlow("pdf");
  });
}

if (btnExportPng) {
  btnExportPng.addEventListener("click", () => {
    handleGoFullPageExportFlow("png");
  });
}

// GoFullPage Result Viewer Controls
if (btnGofullpageViewStg) {
  btnGofullpageViewStg.addEventListener("click", () => renderGoFullPagePreview("stg"));
}
if (btnGofullpageViewProd) {
  btnGofullpageViewProd.addEventListener("click", () => renderGoFullPagePreview("prod"));
}
if (btnGofullpageViewDiff) {
  btnGofullpageViewDiff.addEventListener("click", () => renderGoFullPagePreview("diff"));
}

if (btnGofullpageDlPdf) {
  btnGofullpageDlPdf.addEventListener("click", () => {
    if (!lastGoFullPageAudit) return;
    const meta = {
      prodUrl: prodUrlInput.value.trim(),
      stgUrl: stgUrlInput.value.trim(),
      timestamp: new Date().toLocaleString(),
      device: viewportSelect.value,
      currentMode,
      hazardSpacers: activeHazardSpacers,
      redDiffs: activeRedDiffs,
      totalShiftDelta: document.getElementById("metric-shift-val") ? document.getElementById("metric-shift-val").textContent : "+0px",
      diffMismatchPct: lastGoFullPageAudit.diffMismatchPct || (document.getElementById("metric-diff-pct") ? document.getElementById("metric-diff-pct").textContent : "0.00%"),
      canvasProd: lastGoFullPageAudit.canvasProd,
      canvasStg: lastGoFullPageAudit.canvasStg,
      canvasDiff: lastGoFullPageAudit.canvasDiff
    };
    const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
    let devW = 0;
    let devH = 0;
    if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
      const [wStr, hStr] = selectedPreset.split("x");
      devW = parseInt(wStr, 10) || 0;
      devH = parseInt(hStr, 10) || 0;
    }
    if (devW > 0 && devH > 0) {
      if (meta.canvasProd) meta.canvasProd = cropCanvasToDeviceSize(meta.canvasProd, devW, devH);
      if (meta.canvasStg) meta.canvasStg = cropCanvasToDeviceSize(meta.canvasStg, devW, devH);
      if (meta.canvasDiff) meta.canvasDiff = cropCanvasToDeviceSize(meta.canvasDiff, devW, devH);
    }
    const res = window.VisualCompareZip.exportSinglePdf(meta, currentGoFullPageView);
    showToast("GoFullPage PDF Downloaded", `Saved ${res.filename} (1 continuous page).`);
  });
}

if (btnGofullpageDlPng) {
  btnGofullpageDlPng.addEventListener("click", () => {
    if (!lastGoFullPageAudit) return;
    let targetCanvas = lastGoFullPageAudit.canvasStg;
    if (currentGoFullPageView === "prod") targetCanvas = lastGoFullPageAudit.canvasProd;
    else if (currentGoFullPageView === "diff") targetCanvas = lastGoFullPageAudit.canvasDiff || lastGoFullPageAudit.canvasStg;

    const selectedPreset = viewportSelect ? viewportSelect.value : "responsive";
    let devW = 0;
    let devH = 0;
    if (selectedPreset && selectedPreset !== "responsive" && selectedPreset.includes("x")) {
      const [wStr, hStr] = selectedPreset.split("x");
      devW = parseInt(wStr, 10) || 0;
      devH = parseInt(hStr, 10) || 0;
    }
    if (devW > 0 && devH > 0) {
      targetCanvas = cropCanvasToDeviceSize(targetCanvas, devW, devH);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const res = window.VisualCompareZip.exportSinglePng(targetCanvas, `gofullpage-${currentGoFullPageView}-${dateStr}.png`);
    showToast("GoFullPage PNG Downloaded", `Saved ${res.filename} (lossless PNG).`);
  });
}

if (btnGofullpageClose && gofullpageViewerModal) {
  btnGofullpageClose.addEventListener("click", () => {
    gofullpageViewerModal.style.display = "none";
  });
}

if (gofullpageViewerModal) {
  gofullpageViewerModal.addEventListener("click", (e) => {
    if (e.target === gofullpageViewerModal) gofullpageViewerModal.style.display = "none";
  });
}

// Backward-compatible PDF Export Modal
if (btnClosePdfModal && pdfExportModal) {
  btnClosePdfModal.addEventListener("click", () => {
    pdfExportModal.style.display = "none";
  });
}

if (pdfExportModal) {
  pdfExportModal.addEventListener("click", (e) => {
    if (e.target === pdfExportModal) pdfExportModal.style.display = "none";
  });
}

// Bind Export Modal Actions
if (btnDownloadPdfMaster) {
  btnDownloadPdfMaster.addEventListener("click", () => handleExportPdfFlow("master"));
}
if (btnDownloadPdfDiff) {
  btnDownloadPdfDiff.addEventListener("click", () => handleExportPdfFlow("diff"));
}
if (btnDownloadPdfProd) {
  btnDownloadPdfProd.addEventListener("click", () => handleExportPdfFlow("prod"));
}
if (btnDownloadPdfStg) {
  btnDownloadPdfStg.addEventListener("click", () => handleExportPdfFlow("stg"));
}
if (btnDownloadAllZip) {
  btnDownloadAllZip.addEventListener("click", () => handleExportZipFlow());
}

if (btnExportZip) {
  btnExportZip.addEventListener("click", () => {
    handleExportZipFlow();
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
    } catch (err) {
      console.error("Import error:", err);
      alert("Failed to import ZIP package: " + err.message);
    }
  });
}

if (typeof window !== "undefined") {
  window.__vcRenderLiveDomToFullPageCanvas = renderLiveDomToFullPageCanvas;
}
