/**
 * VisualCompare Live - Studio: Element-level and subpixel pixel diff engines
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

// ----------------------------------------------------
// DYNAMIC ELEMENT-LEVEL SUBPIXEL PIXEL DIFF ENGINE
// (Highlights strictly DIFFERENT PIXELS ONLY in RED, matching Python visualCompare diff_engine.py)
// ----------------------------------------------------
let scratchCanvasP = null;
let scratchCanvasS = null;
let scratchCanvasDiff = null;
const ALLOW_SOLID_BOX_DIFF = false;

function getScratchP(w, h) {
  if (!scratchCanvasP) scratchCanvasP = document.createElement("canvas");
  if (scratchCanvasP.width !== w || scratchCanvasP.height !== h) {
    scratchCanvasP.width = w;
    scratchCanvasP.height = h;
  }
  return scratchCanvasP;
}
function getScratchS(w, h) {
  if (!scratchCanvasS) scratchCanvasS = document.createElement("canvas");
  if (scratchCanvasS.width !== w || scratchCanvasS.height !== h) {
    scratchCanvasS.width = w;
    scratchCanvasS.height = h;
  }
  return scratchCanvasS;
}
function getScratchDiff(w, h) {
  if (!scratchCanvasDiff) scratchCanvasDiff = document.createElement("canvas");
  if (scratchCanvasDiff.width !== w || scratchCanvasDiff.height !== h) {
    scratchCanvasDiff.width = w;
    scratchCanvasDiff.height = h;
  }
  return scratchCanvasDiff;
}

function applyCanvasBackground(ctx, bgStr, w, h, radius = 0) {
  if (!bgStr || bgStr === "transparent" || bgStr === "rgba(0, 0, 0, 0)") return;
  ctx.save();
  if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, radius);
    ctx.clip();
  }
  if (bgStr.includes("gradient")) {
    try {
      let grad = null;
      if (bgStr.includes("to right")) {
        grad = ctx.createLinearGradient(0, 0, w, 0);
      } else if (bgStr.includes("to bottom")) {
        grad = ctx.createLinearGradient(0, 0, 0, h);
      } else {
        grad = ctx.createLinearGradient(0, 0, w, h);
      }
      const colorMatches = bgStr.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/gi);
      const validColors = (colorMatches || []).filter(c => !c.includes("gradient") && !c.includes("deg") && !c.includes("to"));
      if (validColors.length >= 2) {
        validColors.forEach((col, idx) => {
          grad.addColorStop(idx / (validColors.length - 1), col);
        });
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        return;
      }
    } catch (e) {}
  }
  try {
    ctx.fillStyle = bgStr;
    if (radius > 0 && typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, radius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, w, h);
    }
  } catch (e) {}
  ctx.restore();
}

function renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, liveTargetFrame = null, liveFallbackFrame = null) {
  if (!item || !offCtx) return false;
  if (!Number.isFinite(drawW) || !Number.isFinite(drawH) || drawW <= 0 || drawH <= 0) return false;
  const elW = Math.max(4, Math.min(Math.round(drawW), 2400));
  const elH = Math.max(4, Math.min(Math.round(drawH), 1200));

  const pCanvas = getScratchP(elW, elH);
  const sCanvas = getScratchS(elW, elH);
  const ctxP = pCanvas.getContext("2d");
  const ctxS = sCanvas.getContext("2d");

  ctxP.clearRect(0, 0, elW, elH);
  ctxS.clearRect(0, 0, elW, elH);

  let compStyle = null;
  let fallbackStyle = null;
  let targetEl = null;
  let fallbackEl = null;

  const effTargetFrame = liveTargetFrame || (typeof currentMode !== "undefined" && currentMode === "swipe" ? iframeSwipeStg : (typeof currentMode !== "undefined" && currentMode === "overlay" ? iframeOverlayStg : (iframeStg || iframeDiffBase)));
  const effFallbackFrame = liveFallbackFrame || (typeof currentMode !== "undefined" && currentMode === "swipe" ? iframeSwipeProd : (typeof currentMode !== "undefined" && currentMode === "overlay" ? iframeOverlayProd : iframeProd));

  if (item.selector) {
    try {
      const cleanStgFrame = (effTargetFrame === iframeDiffBase && iframeStg && iframeStg.contentDocument) ? iframeStg : effTargetFrame;
      if (cleanStgFrame && cleanStgFrame.contentDocument) {
        targetEl = cleanStgFrame.contentDocument.querySelector(item.selector);
        if (targetEl && cleanStgFrame.contentWindow) {
          compStyle = cleanStgFrame.contentWindow.getComputedStyle(targetEl);
        }
      }
      if (!targetEl && effTargetFrame && effTargetFrame.contentDocument) {
        targetEl = effTargetFrame.contentDocument.querySelector(item.selector);
        if (targetEl && effTargetFrame.contentWindow) {
          compStyle = effTargetFrame.contentWindow.getComputedStyle(targetEl);
        }
      }
      if (effFallbackFrame && effFallbackFrame.contentDocument) {
        fallbackEl = effFallbackFrame.contentDocument.querySelector(item.selector);
        if (fallbackEl && effFallbackFrame.contentWindow) {
          fallbackStyle = effFallbackFrame.contentWindow.getComputedStyle(fallbackEl);
        }
      }
    } catch (e) {}
  }

  const normalizeStyle = (raw, cssDecl, el) => {
    const r = raw || {};
    const c = cssDecl || {};
    const origBg = el?.dataset?.vcOriginalBg;
    const hasStylesheets = Boolean(el?.ownerDocument?.querySelector?.("style, link[rel='stylesheet']"));
    const pick = (rawVal, liveVal, fallback = "") => {
      if (hasStylesheets) {
        return (liveVal !== undefined && liveVal !== "") ? liveVal : (rawVal !== undefined && rawVal !== "" ? rawVal : fallback);
      }
      return (rawVal !== undefined && rawVal !== "") ? rawVal : (liveVal !== undefined && liveVal !== "" ? liveVal : fallback);
    };
    return {
      bg: origBg || pick(r.bg, c.backgroundColor, ""),
      bgImage: pick(r.bgImage, c.backgroundImage, ""),
      backgroundClip: pick(r.backgroundClip, c.webkitBackgroundClip || c.backgroundClip, ""),
      color: pick(r.color, c.color, "#000000"),
      textFillColor: pick(r.textFillColor, c.webkitTextFillColor, ""),
      borderColor: pick(r.borderColor || r.borderTopColor || r.borderLeftColor, c.borderColor || c.borderTopColor || c.borderLeftColor, ""),
      borderWidth: pick(r.borderWidth, c.borderWidth || c.borderTopWidth || c.borderLeftWidth, ""),
      radius: pick(r.radius, c.borderRadius, "0px"),
      fill: r.fill || c.fill || el?.getAttribute?.("fill") || "",
      stroke: r.stroke || c.stroke || el?.getAttribute?.("stroke") || "",
      boxShadow: pick(r.boxShadow, c.boxShadow, "none"),
      fontSize: pick(r.fontSize, c.fontSize, ""),
      fontFamily: pick(r.fontFamily, c.fontFamily, ""),
      fontWeight: pick(r.fontWeight, c.fontWeight, ""),
      fontStyle: pick(r.fontStyle, c.fontStyle, ""),
      lineHeight: pick(r.lineHeight, c.lineHeight, ""),
      padding: pick(r.padding, c.padding, ""),
      paddingLeft: pick(r.paddingLeft, c.paddingLeft, ""),
      paddingRight: pick(r.paddingRight, c.paddingRight, ""),
      paddingTop: pick(r.paddingTop, c.paddingTop, ""),
      textAlign: pick(r.textAlign, c.textAlign, ""),
      justifyContent: pick(r.justifyContent, c.justifyContent, "")
    };
  };

  const pStyle = item.diffType === "added" ? {} : normalizeStyle(item.prodStyle || (!item.stgStyle ? item.style : null), fallbackStyle, fallbackEl);
  const sStyle = item.diffType === "removed" ? {} : normalizeStyle(item.stgStyle || item.style, compStyle, targetEl);

  const hasChildElements = Boolean(
    (targetEl && targetEl.children && targetEl.children.length > 0 && /^(DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE|UL|OL|DL|TABLE|FORM)$/i.test(targetEl.tagName || "")) ||
    (fallbackEl && fallbackEl.children && fallbackEl.children.length > 0 && /^(DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE|UL|OL|DL|TABLE|FORM)$/i.test(fallbackEl.tagName || ""))
  );

  let pText = item.diffType === "added" ? "" : (hasChildElements ? "" : (item.prodText !== undefined ? item.prodText : (fallbackEl?.innerText || fallbackEl?.textContent || item.text || "")).trim());
  let sText = item.diffType === "removed" ? "" : (hasChildElements ? "" : (item.stgText !== undefined ? item.stgText : (targetEl?.innerText || targetEl?.textContent || item.text || "")).trim());

  // Font metrics calculation
  const fontSize = compStyle?.fontSize || sStyle.fontSize || pStyle.fontSize || "16px";
  const fontFamily = compStyle?.fontFamily || sStyle.fontFamily || pStyle.fontFamily || "sans-serif";
  const fontWeight = compStyle?.fontWeight || sStyle.fontWeight || pStyle.fontWeight || "normal";
  const fontStyle = compStyle?.fontStyle || sStyle.fontStyle || pStyle.fontStyle || "normal";
  const fontStr = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;

  const extractGradientStops = (bgImgStr) => {
    if (!bgImgStr || !bgImgStr.includes("gradient")) return null;
    const m = bgImgStr.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8})/gi);
    return m && m.length > 0 ? m : null;
  };

  const extractFirstGradientColor = (bgImgStr) => {
    const stops = extractGradientStops(bgImgStr);
    return stops ? stops[0] : null;
  };

  const isGradText = Boolean(
    (item.selector && item.selector.includes("gradient-text")) ||
    pStyle.backgroundClip === "text" || sStyle.backgroundClip === "text" ||
    ((pStyle.color === "rgba(0, 0, 0, 0)" || pStyle.textFillColor === "rgba(0, 0, 0, 0)") && (pStyle.bgImage || "").includes("gradient"))
  );

  const pColor = (isGradText && extractFirstGradientColor(pStyle.bgImage)) || pStyle.color || "#000000";
  const sColor = (isGradText && extractFirstGradientColor(sStyle.bgImage)) || sStyle.color || compStyle?.color || "#000000";

  const pBg = item.diffType === "added" ? null : pStyle.bg;
  const sBg = item.diffType === "removed" ? null : sStyle.bg;
  const pBgImg = (item.diffType === "added" || isGradText) ? null : ((pStyle.bgImage && pStyle.bgImage !== "none") ? pStyle.bgImage : null);
  const sBgImg = (item.diffType === "removed" || isGradText) ? null : ((sStyle.bgImage && sStyle.bgImage !== "none") ? sStyle.bgImage : null);

  const bgChanged = (pBg || "") !== (sBg || "") || (pBgImg || "") !== (sBgImg || "");
  const isTextDiff = (item.diffType === "typography" || item.diffType === "text" || (pText && sText && pText !== sText));

  const elementTol = (typeof currentDiffTolerance === "number" && currentDiffTolerance !== 20)
    ? Math.max(4, Math.round(currentDiffTolerance * 0.7))
    : 14;

  // Fast-path anti-stutter bitmap cache: reuse pre-computed subpixel diff canvas during 60fps scroll
  const presetKey = (typeof viewportSelect !== "undefined" && viewportSelect) ? (viewportSelect.value || "responsive") : "responsive";
  const textAlign = sStyle.textAlign || pStyle.textAlign || compStyle?.textAlign || fallbackStyle?.textAlign || "";
  const justifyContent = sStyle.justifyContent || pStyle.justifyContent || compStyle?.justifyContent || fallbackStyle?.justifyContent || "";
  const isCentered = textAlign === "center" || justifyContent === "center";
  const isRightAligned = textAlign === "right" || justifyContent === "flex-end";

  const cacheKey = `${presetKey}|${elW}x${elH}|${elementTol}|${item.diffType || ""}|${pText}|${sText}|${pColor}|${sColor}|${pBg || ""}|${sBg || ""}|${pBgImg || ""}|${sBgImg || ""}|${pStyle.borderColor || ""}|${sStyle.borderColor || ""}|${fontStr}|${textAlign}|${justifyContent}`;
  if (item._subpixelCache && item._subpixelCache.key === cacheKey) {
    if (item._subpixelCache.hasDiff && item._subpixelCache.canvas) {
      offCtx.drawImage(item._subpixelCache.canvas, drawX, drawY);
      return true;
    }
    return false;
  }

  const padL = parseFloat(sStyle.paddingLeft || pStyle.paddingLeft || compStyle?.paddingLeft || pStyle.padding) || 4;
  const padR = parseFloat(sStyle.paddingRight || pStyle.paddingRight || compStyle?.paddingRight || pStyle.padding) || padL;
  const padT = parseFloat(sStyle.paddingTop || pStyle.paddingTop || compStyle?.paddingTop || pStyle.padding) || 0;
  const rawPLines = pText ? pText.split("\n") : [];
  const rawSLines = sText ? sText.split("\n") : [];
  const parsedLineH = parseFloat(sStyle.lineHeight || pStyle.lineHeight || compStyle?.lineHeight);
  const lineH = (!isNaN(parsedLineH) && parsedLineH > 0) ? parsedLineH : (parseFloat(fontSize) * 1.25 || 20);

  const wrapLinesForWidth = (ctx, lines, maxW) => {
    if (!lines || lines.length === 0) return [];
    if (typeof ctx.measureText !== "function" || maxW <= 40) return lines;
    ctx.font = fontStr;
    const out = [];
    lines.forEach(line => {
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length <= 1) {
        out.push(line);
        return;
      }
      let cur = words[0];
      for (let i = 1; i < words.length; i++) {
        const next = cur + " " + words[i];
        const m = ctx.measureText(next);
        if (m && m.width > maxW) {
          out.push(cur);
          cur = words[i];
        } else {
          cur = next;
        }
      }
      if (cur) out.push(cur);
    });
    return out;
  };

  const maxTextW = Math.max(20, elW - padL - padR);
  const pLines = wrapLinesForWidth(ctxP, rawPLines, maxTextW);
  const sLines = wrapLinesForWidth(ctxS, rawSLines, maxTextW);

  const computeStartY = (lines) => {
    if (lines.length <= 1) return elH / 2;
    const totalH = lines.length * lineH;
    if (padT > 0 && totalH + padT * 2 <= elH + 8) {
      return padT + (lineH / 2);
    }
    return Math.max(lineH / 2, ((elH - totalH) / 2) + (lineH / 2));
  };

  const textDrawX = isCentered ? (elW / 2) : (isRightAligned ? Math.max(0, elW - padR) : padL);
  const canvasTextAlign = isCentered ? "center" : (isRightAligned ? "right" : "left");

  const applyTextFillStyle = (ctx, baseColor, bgImgStr) => {
    const gradStops = isGradText ? extractGradientStops(bgImgStr) : null;
    if (gradStops && gradStops.length >= 2 && typeof ctx.createLinearGradient === "function") {
      try {
        const g = ctx.createLinearGradient(0, 0, elW, 0);
        gradStops.forEach((c, idx) => g.addColorStop(idx / (gradStops.length - 1), c));
        ctx.fillStyle = g;
        return;
      } catch (e) {}
    }
    ctx.fillStyle = baseColor;
  };

  // 1. Draw Prod on ctxP (every pixel of background, gradient, image, border, and text)
  if (!isTextDiff || bgChanged) {
    const rVal = parseFloat(pStyle.radius) || 0;
    if (pBg) applyCanvasBackground(ctxP, pBg, elW, elH, rVal);
    if (pBgImg) applyCanvasBackground(ctxP, pBgImg, elW, elH, rVal);
  }
  if (fallbackEl && (fallbackEl.tagName === "IMG" || fallbackEl instanceof Image)) {
    try {
      if (fallbackEl.complete && fallbackEl.naturalWidth > 0) {
        ctxP.drawImage(fallbackEl, 0, 0, elW, elH);
      }
    } catch (e) {}
  }
  if (!isTextDiff && pStyle.borderColor && pStyle.borderColor !== "rgba(0, 0, 0, 0)" && parseFloat(pStyle.borderWidth) > 0) {
    ctxP.fillStyle = pStyle.borderColor;
    const bW = parseFloat(pStyle.borderWidth) || 1;
    ctxP.fillRect(0, 0, elW, bW);
    ctxP.fillRect(0, elH - bW, elW, bW);
    ctxP.fillRect(0, 0, bW, elH);
    ctxP.fillRect(elW - bW, 0, bW, elH);
  }
  if (pLines.length > 0) {
    ctxP.font = fontStr;
    applyTextFillStyle(ctxP, pColor, pStyle.bgImage);
    ctxP.textBaseline = "middle";
    ctxP.textAlign = canvasTextAlign;
    const pStartY = computeStartY(pLines);
    pLines.forEach((line, i) => {
      const y = pStartY + (i * lineH);
      if (y < elH + lineH) ctxP.fillText(line, textDrawX, y);
    });
  }

  // 2. Draw Staging on ctxS (every pixel of background, gradient, image, border, and text)
  if (!isTextDiff || bgChanged) {
    const rVal = parseFloat(sStyle.radius) || 0;
    if (sBg) applyCanvasBackground(ctxS, sBg, elW, elH, rVal);
    if (sBgImg) applyCanvasBackground(ctxS, sBgImg, elW, elH, rVal);
  }
  if (targetEl && (targetEl.tagName === "IMG" || targetEl instanceof Image)) {
    try {
      if (targetEl.complete && targetEl.naturalWidth > 0) {
        ctxS.drawImage(targetEl, 0, 0, elW, elH);
      }
    } catch (e) {}
  }
  if (!isTextDiff && sStyle.borderColor && sStyle.borderColor !== "rgba(0, 0, 0, 0)" && parseFloat(sStyle.borderWidth) > 0) {
    ctxS.fillStyle = sStyle.borderColor;
    const bW = parseFloat(sStyle.borderWidth) || 1;
    ctxS.fillRect(0, 0, elW, bW);
    ctxS.fillRect(0, elH - bW, elW, bW);
    ctxS.fillRect(0, 0, bW, elH);
    ctxS.fillRect(elW - bW, 0, bW, elH);
  }
  if (sLines.length > 0) {
    ctxS.font = fontStr;
    applyTextFillStyle(ctxS, sColor, sStyle.bgImage);
    ctxS.textBaseline = "middle";
    ctxS.textAlign = canvasTextAlign;
    const sStartY = computeStartY(sLines);
    sLines.forEach((line, i) => {
      const y = sStartY + (i * lineH);
      if (y < elH + lineH) ctxS.fillText(line, textDrawX, y);
    });
  } else if (pLines.length === 0 && sLines.length === 0 && !bgChanged && (pColor !== sColor || pStyle.fill !== sStyle.fill || pStyle.stroke !== sStyle.stroke)) {
    ctxP.fillStyle = pStyle.fill || pStyle.stroke || pColor;
    ctxP.fillRect(0, 0, elW, elH);
    ctxS.fillStyle = sStyle.fill || sStyle.stroke || sColor;
    ctxS.fillRect(0, 0, elW, elH);
  }

  // 3. Compute subpixel pixel difference
  const dataP = ctxP.getImageData(0, 0, elW, elH).data;
  const dataS = ctxS.getImageData(0, 0, elW, elH).data;

  let { outData, diffPixels } = elementTol === 14
    ? computeSubpixelPixelDiff(dataP, dataS, elW, elH, 14)
    : computeSubpixelPixelDiff(dataP, dataS, elW, elH, elementTol);

  if (diffPixels === 0 && item.diffType === "style") {
    ({ outData, diffPixels } = computeSubpixelPixelDiff(dataP, dataS, elW, elH, 4));
  }

  if (diffPixels > 0) {
    const diffImg = new ImageData(outData, elW, elH);
    const diffCanvasEl = getScratchDiff(elW, elH);
    diffCanvasEl.getContext("2d").putImageData(diffImg, 0, 0);
    const cachedCanvas = document.createElement("canvas");
    cachedCanvas.width = elW;
    cachedCanvas.height = elH;
    cachedCanvas.getContext("2d").drawImage(diffCanvasEl, 0, 0);
    item._subpixelCache = { key: cacheKey, hasDiff: true, canvas: cachedCanvas };
    offCtx.drawImage(cachedCanvas, drawX, drawY);
    return true;
  }
  item._subpixelCache = { key: cacheKey, hasDiff: false, canvas: null };
  return false;
}

// Dedicated 1:1 renderer for Swipe Split Curtain Diff Canvas (Prod on Left <-> Staging+Diff on Right)
// Pure pixel-level difference display - ZERO OUTLINES ON ANYTHING
function renderSwipeDiffCanvas(diffList = activeRedDiffs, shiftRegions = activeShiftRegions, currentScrollY = (lastScrollState.scrollY || 0), currentScrollX = (lastScrollState.scrollX || 0)) {
  if (!swipeDiffCanvas) return;
  if (swipeCompareMode !== "diff") {
    swipeDiffCanvas.style.display = "none";
    return;
  }
  swipeDiffCanvas.style.display = "block";

  // Use exact rendered width & height of the swipe container
  const swW = swipeContainer?.clientWidth || iframeSwipeStg?.clientWidth || 1200;
  const swH = swipeContainer?.clientHeight || iframeSwipeStg?.clientHeight || 800;

  if (swW <= 0 || swH <= 0) return;

  // Clamp horizontal scroll strictly to what the main pages can scroll
  const maxSwipeScrollX = typeof getEffectiveMaxScrollX === "function"
    ? getEffectiveMaxScrollX(swW)
    : (Number.isFinite(lastScrollState?.maxScrollX) ? Math.max(0, lastScrollState.maxScrollX) : 0);
  currentScrollX = Math.max(0, Math.min(maxSwipeScrollX, currentScrollX || 0));

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
      const deltaY = (currentScrollY - (lastCapturedScrollY || 0));
      const deltaX = (currentScrollX - (lastCapturedScrollX || 0));
      if (Math.abs(deltaY) < swH && Math.abs(deltaX) < swW) {
        offCtx.drawImage(lastCapturedDiffCanvas, -deltaX, -deltaY);
        drawnCapturedDiff = true;
      }
    } else {
      // Mismatched aspect ratio or width (e.g. from 3-column view) - drop stale canvas so it never warps!
      lastCapturedDiffCanvas = null;
    }
  }

  // Frame to query for live element bounding boxes (100% pixel-perfect subpixel accuracy)
  // Diff canvas sits in swipe-base-layer right on top of live iframeSwipeStg!
  const liveTargetFrame = iframeSwipeStg;
  const liveFallbackFrame = iframeSwipeProd;
  const activeRenderFrame = iframeSwipeStg || iframeSwipeProd;

  if (!drawnCapturedDiff) {
    const effectiveDiffs = (diffList && diffList.length > 0) ? diffList : (swipeRedDiffs && swipeRedDiffs.length > 0 ? swipeRedDiffs : activeRedDiffs);
  if (effectiveDiffs && effectiveDiffs.length > 0) {
    effectiveDiffs.forEach(item => {
      if (!item) return;

      let drawX = 0;
      let drawY = 0;
      let drawW = 0;
      let drawH = 0;
      let hasExactBox = false;

      const itemTag = (item.tag || "").toLowerCase();
      const isTextNode = (itemTag === "h1" || itemTag === "h2" || itemTag === "h3" || itemTag === "h4" || 
                          itemTag === "h5" || itemTag === "h6" || itemTag === "p" || itemTag === "span" || 
                          itemTag === "label" || itemTag === "strong" || itemTag === "em" || 
                          itemTag === "th" || itemTag === "td" || itemTag === "b" || itemTag === "i" || 
                          item.diffType === "typography" || item.diffType === "text");

      const liveTargetWin = liveTargetFrame?.contentWindow;
      const liveFallbackWin = liveFallbackFrame?.contentWindow;
      let frameScrollY = liveTargetWin ? (liveTargetWin.scrollY || liveTargetWin.pageYOffset || 0) : (liveFallbackWin ? (liveFallbackWin.scrollY || liveFallbackWin.pageYOffset || 0) : currentScrollY);
      let frameScrollX = liveTargetWin ? (liveTargetWin.scrollX || liveTargetWin.pageXOffset || 0) : (liveFallbackWin ? (liveFallbackWin.scrollX || liveFallbackWin.pageXOffset || 0) : currentScrollX);

      // Try querying the live DOM directly in the swipe frame if same-origin
      const hasLiveSwipeDom = Boolean(
        (liveTargetFrame?.contentDocument?.body?.children?.length > 0) ||
        (liveFallbackFrame?.contentDocument?.body?.children?.length > 0)
      );
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
            const elWin = el.ownerDocument?.defaultView;
            if (elWin) {
              frameScrollY = elWin.scrollY || elWin.pageYOffset || 0;
              frameScrollX = elWin.scrollX || elWin.pageXOffset || 0;
            }
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              const isFixed = Boolean(item.isFixed || (typeof isElementFixed === "function" && isElementFixed(el)));
              const isSticky = Boolean(item.isSticky || (typeof isElementSticky === "function" && isElementSticky(el)));

              if (isFixed) {
                drawX = Math.round(r.left);
                drawY = Math.round(r.top);
              } else if (isSticky && currentScrollY > (item.box?.y || 0)) {
                drawX = Math.round(r.left);
                drawY = Math.round(r.top);
              } else {
                const elDocY = r.top + frameScrollY;
                const elDocX = r.left + frameScrollX;
                drawX = Math.round(elDocX - currentScrollX);
                drawY = Math.round(elDocY - currentScrollY);
              }
              drawW = Math.round(r.width);
              drawH = Math.round(r.height);
              const altEl = (liveFallbackFrame && liveFallbackFrame.contentDocument && el.ownerDocument !== liveFallbackFrame.contentDocument)
                ? liveFallbackFrame.contentDocument.querySelector(item.selector)
                : null;
              if (altEl) {
                const rAlt = altEl.getBoundingClientRect();
                if (rAlt && rAlt.width > 0 && rAlt.height > 0) {
                  drawW = Math.max(drawW, Math.round(rAlt.width));
                  drawH = Math.max(drawH, Math.round(rAlt.height));
                }
              }
              hasExactBox = true;
            }
          }
        } catch (e) {
          // Cross-origin iframe
        }
      }

        // If live DOM is loaded and the selector is not present or hidden at this aspect ratio/page, skip it
        if (!hasExactBox && hasLiveSwipeDom) {
          return;
        }

        // If not queryable via contentDocument, use candidate measured box or estimated box
        if (!hasExactBox) {
          const box = item.swipeBox || item.stgBox || item.box || item.prodBox;
          const isBoxFromNarrow = box && box.measuredWidth && box.measuredWidth < 600 && swW > 800;
          if (isBoxFromNarrow) {
            const prodHref = (prodUrlInput?.value || "").toLowerCase();
            const isDemoSite = prodHref.includes("demo_") || prodHref.includes("demo-");
            if (isDemoSite) {
              const est = getEstimatedBoxForSelector(item.selector, swW);
              if (est) {
                drawX = est.x;
                drawY = (box && box.y ? box.y : est.y) - currentScrollY;
                drawW = est.width;
                drawH = (box && box.height ? box.height : est.height);
                hasExactBox = true;
              }
            }
          }

          if (!hasExactBox) {
            if (!box || (box.width === 0 && box.height === 0)) {
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
              const scaleX = (box.measuredWidth && box.measuredWidth > 0 && Math.abs(box.measuredWidth - swW) > 30) ? (swW / box.measuredWidth) : 1;
              const isFixed = Boolean(item.isFixed || box.isFixed);
              const isSticky = Boolean(item.isSticky || box.isSticky);
              drawX = Math.round((isFixed ? (box.viewportX !== undefined ? box.viewportX : box.x) : (box.x - currentScrollX)) * scaleX);
              drawY = (isFixed || (isSticky && currentScrollY > (box.y || 0))) ? (box.viewportY !== undefined ? box.viewportY : box.y) : (box.y - currentScrollY);
              drawW = Math.round(box.width * scaleX);
              drawH = box.height;
              hasExactBox = true;
            }
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
            const leafSel = (item.selector || "").split(",")[0].split(/(?:>|\s+)/).filter(Boolean).pop() || "";
            const isContainer = (leafSel && (leafSel.includes("card") || leafSel.includes("section") || leafSel.includes("container") || leafSel.includes("table") || leafSel.includes("site-header") || leafSel.includes("hero-section") || leafSel.includes("cta-section"))) || drawH > 90 || tag === "section" || tag === "div" || tag === "table" || tag === "header" || tag === "nav" || tag === "footer";
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
                  renderedGlyphs = renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, activeRenderFrame || liveTargetFrame, liveFallbackFrame);
                  if (!renderedGlyphs && ALLOW_SOLID_BOX_DIFF) {
                    offCtx.fillStyle = "rgba(225, 29, 72, 0.86)";
                    rects.forEach(r => {
                      const rx = Math.round((r.left + frameScrollX) - currentScrollX);
                      const ry = Math.round((r.top + frameScrollY) - currentScrollY);
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
            }

            // Skip broad structural containers and sections so identical child elements are never washed with red
            const isBroadSection = tag === "section" || tag === "header" || tag === "nav" || tag === "footer" || tag === "main" || 
                                   (leafSel && (leafSel.includes("section") || leafSel.includes("site-header") || leafSel.includes("hero-section") || leafSel.includes("cta-section")));
            if (isBroadSection) return;

            // If button, pill, badge, card, or container shape: fill exact shape with border-radius (ZERO OUTLINE!)
            if (!renderedGlyphs) {
              const rVal = parseFloat(compStyle.borderRadius) || (parseFloat(item.style?.radius) || 0);
              offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
              renderedGlyphs = renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, activeRenderFrame || liveTargetFrame, liveFallbackFrame);
              if (!renderedGlyphs && ALLOW_SOLID_BOX_DIFF) {
                offCtx.beginPath();
                if (rVal > 0 && typeof offCtx.roundRect === "function") {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
                } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("button") || item.selector.includes("tab") || item.selector.includes("badge"))) {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
                } else if (typeof offCtx.roundRect === "function" && isTextNode) {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, 4);
                } else {
                  offCtx.rect(drawX, drawY, drawW, drawH);
                }
                offCtx.fill();
                renderedGlyphs = true;
              }
            }
          }
        } catch (e) {}

        // Fallback if cross-origin or no live element
        if (!renderedGlyphs) {
          const itemText = (item.text || "").trim();
          const fallbackLeafSel = (item.selector || "").split(",")[0].split(/(?:>|\s+)/).filter(Boolean).pop() || "";
          const isBroadSection = fallbackLeafSel && (fallbackLeafSel.includes("section") || fallbackLeafSel.includes("site-header") || fallbackLeafSel.includes("hero-section") || fallbackLeafSel.includes("cta-section"));
          if (isBroadSection) return;
          const isCardOrContainer = (fallbackLeafSel && (fallbackLeafSel.includes("card") || fallbackLeafSel.includes("section") || fallbackLeafSel.includes("container") || fallbackLeafSel.includes("table"))) || drawH > 90;
          const rVal = parseFloat(item.style?.radius) || (item.selector.includes("btn") || item.selector.includes("tab") ? 6 : 0);
          offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
          renderedGlyphs = renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, null, null);
          if (!renderedGlyphs && ALLOW_SOLID_BOX_DIFF) {
            offCtx.beginPath();
            if (rVal > 0 && typeof offCtx.roundRect === "function") {
              offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
            } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("tab"))) {
              offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
            } else if (typeof offCtx.roundRect === "function" && isTextNode) {
              offCtx.roundRect(drawX, drawY, drawW, drawH, 4);
            } else {
              offCtx.rect(drawX, drawY, drawW, drawH);
            }
            offCtx.fill();
          }
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
      let regY = Math.round(reg.y - currentScrollY);
      try {
        const spacerSelector = reg.spacerId ? `.vc-hazard-stripe-spacer[data-spacer-id="${reg.spacerId}"]` : ".vc-hazard-stripe-spacer";
        const domSpacer = (liveFallbackFrame?.contentDocument?.querySelector?.(spacerSelector) || liveTargetFrame?.contentDocument?.querySelector?.(spacerSelector));
        if (domSpacer) {
          const r = domSpacer.getBoundingClientRect();
          if (r.height > 0) {
            const fWin = (domSpacer.ownerDocument?.defaultView) || liveTargetFrame?.contentWindow;
            const fScrollY = fWin ? (fWin.scrollY || fWin.pageYOffset || 0) : currentScrollY;
            regY = Math.round((r.top + fScrollY) - currentScrollY);
          }
        }
      } catch (e) {}

      if (regY + reg.h < -10 || regY > swH + 10) return;

      offCtx.save();
      offCtx.globalAlpha = 0.35;
      drawHazardStripes(offCtx, 0, regY, swW, reg.h, 14);
      offCtx.restore();
      drawCanvasShiftBadge(offCtx, swW, regY, reg.h, reg.label || reg.delta);
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

  // Enforce diff base page visibility state (Black Canvas vs Underlaid Page)
  if (!isDiffBasePageVisible) {
    if (iframeDiffBase) iframeDiffBase.style.display = "none";
    if (pixelDiffViewport) {
      pixelDiffViewport.classList.add("black-page");
      pixelDiffViewport.style.backgroundColor = "#000000";
    }
  } else {
    if (iframeDiffBase) iframeDiffBase.style.display = "block";
    if (pixelDiffViewport) {
      pixelDiffViewport.classList.remove("black-page");
      pixelDiffViewport.style.backgroundColor = "";
    }
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
  const height = wrapFrameProd?.clientHeight || wrapFrameStg?.clientHeight || wrapFrameDiff?.clientHeight || iframeProd?.clientHeight || 800;

  // Clamp horizontal scroll strictly to what the main pages can scroll
  const maxColScrollX = typeof getEffectiveMaxScrollX === "function"
    ? getEffectiveMaxScrollX(width)
    : (Number.isFinite(lastScrollState?.maxScrollX) ? Math.max(0, lastScrollState.maxScrollX) : 0);
  currentScrollX = Math.max(0, Math.min(maxColScrollX, currentScrollX || 0));

  if (pixelDiffCanvas.width !== width || pixelDiffCanvas.height !== height) {
    pixelDiffCanvas.width = width;
    pixelDiffCanvas.height = height;
  }
  pixelDiffCanvas.style.width = width + "px";
  pixelDiffCanvas.style.height = height + "px";
  pixelDiffCanvas.style.opacity = (colDiffOpacitySlider ? colDiffOpacitySlider.value / 100 : 0.85).toString();

  // 1. RENDER ONTO OFFSCREEN BUFFER FIRST (Double Buffering to kill all flickering)
  const offCanvas = getOffscreenCanvas(width, height);
  const offCtx = offCanvas.getContext("2d");
  offCtx.clearRect(0, 0, width, height);

  let totalDiffArea = 0;

  // If an actual captured subpixel screenshot diff exists matching this exact column width, draw it
  let drawnCapturedDiff = false;
  if (lastCapturedDiffCanvas && !isUserScrolling) {
    if (Math.abs(lastCapturedDiffCanvas.width - width) < 5) {
      const deltaY = (currentScrollY - (lastCapturedScrollY || 0));
      const deltaX = (currentScrollX - (lastCapturedScrollX || 0));
      if (Math.abs(deltaY) < height && Math.abs(deltaX) < width) {
        offCtx.drawImage(lastCapturedDiffCanvas, -deltaX, -deltaY);
        drawnCapturedDiff = true;
      }
    } else {
      lastCapturedDiffCanvas = null;
    }
  }
  const isBlackCanvas = !isDiffBasePageVisible;
  const liveTargetFrame = iframeDiffBase || iframeStg;
  const liveFallbackFrame = iframeProd;
  const activeRenderFrame = (!isBlackCanvas && iframeDiffBase) ? iframeDiffBase : (iframeStg || iframeProd);

  if (!drawnCapturedDiff || drawnCapturedDiff || Math.abs(currentScrollY - (lastCapturedScrollY || 0)) > 2) {
    // Draw viewport-visible DOM diff boxes (fills in any regions not yet captured or while gliding)
    const effectiveDiffs = (diffList && diffList.length > 0) ? diffList : (colRedDiffs && colRedDiffs.length > 0 ? colRedDiffs : activeRedDiffs);
    if (effectiveDiffs && effectiveDiffs.length > 0) {
      effectiveDiffs.forEach(item => {
        if (!item) return;

        let drawX = 0, drawY = 0, drawW = 0, drawH = 0;
        let hasExactBox = false;

        const itemTag = (item.tag || "").toLowerCase();
        const isTextNode = (itemTag === "h1" || itemTag === "h2" || itemTag === "h3" || itemTag === "h4" || 
                            itemTag === "h5" || itemTag === "h6" || itemTag === "p" || itemTag === "span" || 
                            itemTag === "label" || itemTag === "strong" || itemTag === "em" || 
                            itemTag === "th" || itemTag === "td" || itemTag === "b" || itemTag === "i" || 
                            item.diffType === "typography" || item.diffType === "text");

        const frameWin = (iframeDiffBase?.contentWindow || iframeStg?.contentWindow || iframeProd?.contentWindow);
        let frameScrollY = frameWin ? (frameWin.scrollY || frameWin.pageYOffset || 0) : currentScrollY;
        let frameScrollX = frameWin ? (frameWin.scrollX || frameWin.pageXOffset || 0) : currentScrollX;

        // Try querying live element directly in diff or staging frame
        const hasLiveColDom = Boolean(
          (iframeStg?.contentDocument?.body?.children?.length > 0) ||
          (iframeProd?.contentDocument?.body?.children?.length > 0) ||
          (iframeDiffBase?.contentDocument?.body?.children?.length > 0)
        );
        if (item.selector) {
          try {
            let el = null;
            if (!isBlackCanvas && iframeDiffBase && iframeDiffBase.contentDocument) {
              el = iframeDiffBase.contentDocument.querySelector(item.selector);
            }
            if (!el && iframeStg && iframeStg.contentDocument) {
              el = iframeStg.contentDocument.querySelector(item.selector);
            }
            if (!el && iframeProd && iframeProd.contentDocument) {
              el = iframeProd.contentDocument.querySelector(item.selector);
            }
            if (!el && iframeDiffBase && iframeDiffBase.contentDocument) {
              el = iframeDiffBase.contentDocument.querySelector(item.selector);
            }
            if (el) {
              const elWin = el.ownerDocument?.defaultView;
              if (elWin) {
                frameScrollY = elWin.scrollY || elWin.pageYOffset || 0;
                frameScrollX = elWin.scrollX || elWin.pageXOffset || 0;
              }
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) {
                const isFixed = Boolean(item.isFixed || (typeof isElementFixed === "function" && isElementFixed(el)));
                const isSticky = Boolean(item.isSticky || (typeof isElementSticky === "function" && isElementSticky(el)));
                if (isFixed) {
                  drawX = Math.round(r.left);
                  drawY = Math.round(r.top);
                } else if (isSticky && currentScrollY > (item.box?.y || 0)) {
                  drawX = Math.round(r.left);
                  drawY = Math.round(r.top);
                } else {
                  const elDocY = r.top + frameScrollY;
                  const elDocX = r.left + frameScrollX;
                  drawX = Math.round(elDocX - currentScrollX);
                  drawY = Math.round(elDocY - currentScrollY);
                }
                drawW = Math.round(r.width);
                drawH = Math.round(r.height);
                const altEl = (iframeProd && iframeProd.contentDocument && el.ownerDocument !== iframeProd.contentDocument)
                  ? iframeProd.contentDocument.querySelector(item.selector)
                  : null;
                if (altEl) {
                  const rAlt = altEl.getBoundingClientRect();
                  if (rAlt && rAlt.width > 0 && rAlt.height > 0) {
                    drawW = Math.max(drawW, Math.round(rAlt.width));
                    drawH = Math.max(drawH, Math.round(rAlt.height));
                  }
                }
                hasExactBox = true;
              }
            }
          } catch (e) {}
        }

        // When live DOM is loaded, skip any item whose selector does not exist or is hidden at the active device preset/page
        if (!hasExactBox && hasLiveColDom) {
          return;
        }

        if (!hasExactBox) {
          const box = item.stgBox || item.box || item.prodBox;
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
              const scaleX = (box.measuredWidth && box.measuredWidth > 0 && Math.abs(box.measuredWidth - width) > 30) ? (width / box.measuredWidth) : 1;
              const isFixed = Boolean(item.isFixed || box.isFixed);
              const isSticky = Boolean(item.isSticky || box.isSticky);
              drawX = Math.round((isFixed ? (box.viewportX !== undefined ? box.viewportX : box.x) : (box.x - currentScrollX)) * scaleX);
              drawY = (isFixed || (isSticky && currentScrollY > (box.y || 0))) ? (box.viewportY !== undefined ? box.viewportY : box.y) : (box.y - currentScrollY);
              drawW = Math.round(box.width * scaleX);
              drawH = box.height;
              hasExactBox = true;
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
            const scaleX = (box.measuredWidth && box.measuredWidth > 0 && Math.abs(box.measuredWidth - width) > 30) ? (width / box.measuredWidth) : 1;
            const isFixed = Boolean(item.isFixed || box.isFixed);
            const isSticky = Boolean(item.isSticky || box.isSticky);
            drawX = Math.round((isFixed ? (box.viewportX !== undefined ? box.viewportX : box.x) : (box.x - currentScrollX)) * scaleX);
            drawY = (isFixed || (isSticky && currentScrollY > (box.y || 0))) ? (box.viewportY !== undefined ? box.viewportY : box.y) : (box.y - currentScrollY);
            drawW = Math.round(box.width * scaleX);
            drawH = box.height;
            hasExactBox = true;
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
          const targetEl = (!isBlackCanvas && iframeDiffBase && iframeDiffBase.contentDocument)
            ? iframeDiffBase.contentDocument.querySelector(item.selector)
            : ((iframeStg && iframeStg.contentDocument) ? iframeStg.contentDocument.querySelector(item.selector) : iframeProd?.contentDocument?.querySelector(item.selector));
          if (targetEl && (liveTargetFrame?.contentWindow || liveFallbackFrame?.contentWindow)) {
            const win = targetEl.ownerDocument?.defaultView || liveTargetFrame?.contentWindow || liveFallbackFrame?.contentWindow;
            if (targetEl.ownerDocument?.defaultView) {
              frameScrollY = targetEl.ownerDocument.defaultView.scrollY || targetEl.ownerDocument.defaultView.pageYOffset || 0;
              frameScrollX = targetEl.ownerDocument.defaultView.scrollX || targetEl.ownerDocument.defaultView.pageXOffset || 0;
            }
            const compStyle = win.getComputedStyle(targetEl);
            const tag = targetEl.tagName.toLowerCase();
            const leafSel = (item.selector || "").split(",")[0].split(/(?:>|\s+)/).filter(Boolean).pop() || "";
            const isContainer = (leafSel && (leafSel.includes("card") || leafSel.includes("section") || leafSel.includes("container") || leafSel.includes("table") || leafSel.includes("site-header") || leafSel.includes("hero-section") || leafSel.includes("cta-section"))) || drawH > 90 || tag === "section" || tag === "div" || tag === "table" || tag === "header" || tag === "nav" || tag === "footer";
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
                  renderedGlyphs = renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, activeRenderFrame || liveTargetFrame, liveFallbackFrame);
                  if (!renderedGlyphs && ALLOW_SOLID_BOX_DIFF) {
                    offCtx.fillStyle = "rgba(225, 29, 72, 0.86)";
                    rects.forEach(r => {
                      const rx = Math.round((r.left + frameScrollX) - currentScrollX);
                      const ry = Math.round((r.top + frameScrollY) - currentScrollY);
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
            }

            // Skip broad structural containers and sections so identical child elements are never washed with red
            const isBroadSection = tag === "section" || tag === "header" || tag === "nav" || tag === "footer" || tag === "main" || 
                                   (leafSel && (leafSel.includes("section") || leafSel.includes("site-header") || leafSel.includes("hero-section") || leafSel.includes("cta-section")));
            if (isBroadSection) return;

            // If button, pill, badge, card, or container shape: fill exact shape with border-radius (ZERO OUTLINE!)
            if (!renderedGlyphs) {
              const rVal = parseFloat(compStyle.borderRadius) || (parseFloat(item.style?.radius) || 0);
              offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
              renderedGlyphs = renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, activeRenderFrame || liveTargetFrame, liveFallbackFrame);
              if (!renderedGlyphs && ALLOW_SOLID_BOX_DIFF) {
                offCtx.beginPath();
                if (rVal > 0 && typeof offCtx.roundRect === "function") {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
                } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("button") || item.selector.includes("tab") || item.selector.includes("badge"))) {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
                } else if (typeof offCtx.roundRect === "function" && isTextNode) {
                  offCtx.roundRect(drawX, drawY, drawW, drawH, 4);
                } else {
                  offCtx.rect(drawX, drawY, drawW, drawH);
                }
                offCtx.fill();
                renderedGlyphs = true;
              }
            }
          }
        } catch (e) {}

        // Fallback if cross-origin or no live element
        if (!renderedGlyphs) {
          const itemText = (item.text || "").trim();
          const fallbackLeafSel = (item.selector || "").split(",")[0].split(/(?:>|\s+)/).filter(Boolean).pop() || "";
          const isBroadSection = fallbackLeafSel && (fallbackLeafSel.includes("section") || fallbackLeafSel.includes("site-header") || fallbackLeafSel.includes("hero-section") || fallbackLeafSel.includes("cta-section"));
          if (isBroadSection) return;
          const isCardOrContainer = (fallbackLeafSel && (fallbackLeafSel.includes("card") || fallbackLeafSel.includes("section") || fallbackLeafSel.includes("container") || fallbackLeafSel.includes("table"))) || drawH > 90;
          const rVal = parseFloat(item.style?.radius) || (item.selector.includes("btn") || item.selector.includes("tab") ? 6 : 0);
          offCtx.fillStyle = isCardOrContainer ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.45)";
          renderedGlyphs = renderElementSubpixelDiff(offCtx, item, drawX, drawY, drawW, drawH, null, null);
          if (!renderedGlyphs && ALLOW_SOLID_BOX_DIFF) {
            offCtx.beginPath();
            if (rVal > 0 && typeof offCtx.roundRect === "function") {
              offCtx.roundRect(drawX, drawY, drawW, drawH, rVal);
            } else if (typeof offCtx.roundRect === "function" && (item.selector.includes("btn") || item.selector.includes("tab") || item.selector.includes("button") || item.selector.includes("badge"))) {
              offCtx.roundRect(drawX, drawY, drawW, drawH, 6);
            } else if (typeof offCtx.roundRect === "function" && isTextNode) {
              offCtx.roundRect(drawX, drawY, drawW, drawH, 4);
            } else {
              offCtx.rect(drawX, drawY, drawW, drawH);
            }
            offCtx.fill();
          }
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

      let regY = Math.round(reg.y - currentScrollY);
      try {
        const spacerSelector = reg.spacerId ? `.vc-hazard-stripe-spacer[data-spacer-id="${reg.spacerId}"]` : ".vc-hazard-stripe-spacer";
        const domSpacer = (!isBlackCanvas && iframeDiffBase?.contentDocument?.querySelector?.(spacerSelector))
          || iframeStg?.contentDocument?.querySelector?.(spacerSelector)
          || iframeProd?.contentDocument?.querySelector?.(spacerSelector)
          || iframeDiffBase?.contentDocument?.querySelector?.(spacerSelector);
        if (domSpacer) {
          const r = domSpacer.getBoundingClientRect();
          if (r.height > 0) {
            const fWin = (domSpacer.ownerDocument?.defaultView) || liveTargetFrame?.contentWindow;
            const fScrollY = fWin ? (fWin.scrollY || fWin.pageYOffset || 0) : currentScrollY;
            regY = Math.round((r.top + fScrollY) - currentScrollY);
          }
        }
      } catch (e) {}

      if (regY + reg.h < -10 || regY > height + 10) return;

      drawHazardStripes(offCtx, 0, regY, width, reg.h, 14);
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
    const aD = Math.abs(dataP[pIdx + 3] - dataS[pIdx + 3]);
    const dist = Math.round(Math.sqrt(rD * rD + gD * gD + bD * bD) * 0.7);
    baseDiff[idx] = Math.max(rD, gD, bD, aD, dist);
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
      if (y >= reg.y + reg.h && !reg.domCompensated) {
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
        const aS = dataS[pIdx + 3];

        for (let n = 0; n < 8; n++) {
          const nx = x + neighbors[n][0];
          const ny = y + neighbors[n][1];
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nPIdx = (ny * width + nx) * 4;
            const curRD = Math.abs(dataP[nPIdx] - rS);
            const curGD = Math.abs(dataP[nPIdx + 1] - gS);
            const curBD = Math.abs(dataP[nPIdx + 2] - bS);
            const curAD = Math.abs(dataP[nPIdx + 3] - aS);
            const curDist = Math.round(Math.sqrt(curRD * curRD + curGD * curGD + curBD * curBD) * 0.7);
            const curDiff = Math.max(curRD, curGD, curBD, curAD, curDist);
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
      const cropW = Math.max(1, Math.min(Math.round(rProd.width * dpr), Math.round(rStg.width * dpr)));
      const cropH = Math.max(1, Math.min(Math.round(rProd.height * dpr), Math.round(rStg.height * dpr)));

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

      const targetW = wrapFrameDiff?.clientWidth || iframeProd?.clientWidth || Math.round(rProd.width);
      const targetH = wrapFrameDiff?.clientHeight || iframeProd?.clientHeight || Math.round(rProd.height);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = targetW;
      outCanvas.height = targetH;
      const outCtx = outCanvas.getContext("2d");

      const scrollYNow = lastScrollState.scrollY || 0;
      const scaleY = cropH / Math.max(1, targetH);
      const captureShiftRegions = Array.isArray(shiftRegions)
        ? shiftRegions.map(reg => {
            if (!reg || !reg.h) return null;
            let regViewportY = reg.y - scrollYNow;
            try {
              const spacerSel = reg.spacerId ? `.vc-hazard-stripe-spacer[data-spacer-id="${reg.spacerId}"]` : ".vc-hazard-stripe-spacer";
              const domSp = iframeProd?.contentDocument?.querySelector?.(spacerSel) || iframeStg?.contentDocument?.querySelector?.(spacerSel);
              if (domSp) {
                const fWin = domSp.ownerDocument?.defaultView;
                const fScrollY = fWin ? (fWin.scrollY || fWin.pageYOffset || 0) : scrollYNow;
                const sr = domSp.getBoundingClientRect();
                if (sr.height > 0) regViewportY = (sr.top + fScrollY) - scrollYNow;
              }
            } catch (e) {}
            return {
              ...reg,
              y: Math.round(regViewportY * scaleY),
              h: Math.round(reg.h * scaleY),
              domCompensated: Boolean(checkSyncHazard && checkSyncHazard.checked)
            };
          }).filter(Boolean)
        : shiftRegions;

      // Sensitive delta matching diff_engine.py make_diff_mask_subpixel
      // Accurately flags subtle background shading gradients, radial fills, and border accents
      const { outData, diffPixels } = computeSubpixelPixelDiff(dataP, dataS, cropW, cropH, currentDiffTolerance || 20, captureShiftRegions);

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

      const pRight = rProd.right !== undefined ? rProd.right : (rProd.left + rProd.width);
      const pBottom = rProd.bottom !== undefined ? rProd.bottom : (rProd.top + rProd.height);
      const sRight = rStg.right !== undefined ? rStg.right : (rStg.left + rStg.width);
      const sBottom = rStg.bottom !== undefined ? rStg.bottom : (rStg.top + rStg.height);
      const isFullyOnScreen = rProd.left >= -2 && rProd.top >= -2 &&
        pRight <= (window.innerWidth || 99999) + 2 && pBottom <= (window.innerHeight || 99999) + 2 &&
        rStg.left >= -2 && rStg.top >= -2 &&
        sRight <= (window.innerWidth || 99999) + 2 && sBottom <= (window.innerHeight || 99999) + 2;
      const isNativeScale = Math.abs(rProd.width - targetW) <= 8 && Math.abs(rProd.height - targetH) <= 8;

      if ((diffPixels > 0 || shiftArea > 0) && isFullyOnScreen && isNativeScale) {
        lastCapturedDiffCanvas = outCanvas;
        lastCapturedScrollY = (lastScrollState.scrollY || 0);
        lastCapturedScrollX = (lastScrollState.scrollX || 0);
      } else if (!isFullyOnScreen || !isNativeScale) {
        lastCapturedDiffCanvas = null;
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
      const { outData, diffPixels } = computeSubpixelPixelDiff(dataP, dataS, cropW, cropH, currentDiffTolerance || 20, shiftRegions);

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

      const isFullyOnScreen = rSwipe.left >= -2 && rSwipe.top >= -2 &&
        (rSwipe.right === undefined || rSwipe.right <= (window.innerWidth || 99999) + 2) &&
        (rSwipe.bottom === undefined || rSwipe.bottom <= (window.innerHeight || 99999) + 2);
      const isNativeScale = !rSwipe.width || (Math.abs(rSwipe.width - swW) <= 8 && Math.abs(rSwipe.height - swH) <= 8);

      if ((diffPixels > 0 || shiftArea > 0) && isFullyOnScreen && isNativeScale) {
        lastCapturedDiffCanvas = outCanvas;
        lastCapturedScrollY = (lastScrollState.scrollY || 0);
        lastCapturedScrollX = (lastScrollState.scrollX || 0);
      } else if (!isFullyOnScreen || !isNativeScale) {
        lastCapturedDiffCanvas = null;
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
  // Disabled per user instruction: do not render yellow spacer shift text on canvas
}

function drawRedDiffCanvasBadge(ctx, x, y, label) {
  // Disabled per user instruction: pure pixel difference without text descriptions
}
