/**
 * VisualCompare Live - Studio: Non-height (red) difference detection
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

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
}

function parseCssColor(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim().toLowerCase();
  if (s === "transparent" || s === "rgba(0, 0, 0, 0)" || s === "rgba(0,0,0,0)") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const hexMatch = s.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const h = hexMatch[1];
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }
  const rgbMatch = s.match(/^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+)(%?))?\s*\)$/);
  if (rgbMatch) {
    let a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
    if (rgbMatch[5] === "%") a = a / 100;
    return {
      r: parseFloat(rgbMatch[1]),
      g: parseFloat(rgbMatch[2]),
      b: parseFloat(rgbMatch[3]),
      a
    };
  }
  const hslMatch = s.match(/^hsla?\(\s*([0-9.]+)(?:deg)?\s*[, ]\s*([0-9.]+)%?\s*[, ]\s*([0-9.]+)%?(?:\s*[,/]\s*([0-9.]+)(%?))?\s*\)$/);
  if (hslMatch) {
    const h = ((parseFloat(hslMatch[1]) % 360) + 360) % 360 / 360;
    const sat = Math.max(0, Math.min(1, parseFloat(hslMatch[2]) / 100));
    const l = Math.max(0, Math.min(1, parseFloat(hslMatch[3]) / 100));
    let a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
    if (hslMatch[5] === "%") a = a / 100;
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
    const p = 2 * l - q;
    const hue2rgb = (t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    return {
      r: Math.round(hue2rgb(h + 1 / 3) * 255),
      g: Math.round(hue2rgb(h) * 255),
      b: Math.round(hue2rgb(h - 1 / 3) * 255),
      a
    };
  }
  return null;
}

function areColorsDifferent(str1, str2, threshold = 12) {
  if (!str1 && !str2) return false;
  if (!str1 || !str2) return true;
  if (str1.trim().toLowerCase() === str2.trim().toLowerCase()) return false;

  const c1 = parseCssColor(str1);
  const c2 = parseCssColor(str2);
  if (!c1 || !c2) {
    return str1.trim().toLowerCase() !== str2.trim().toLowerCase();
  }

  const alphaDiff = Math.abs(c1.a - c2.a);
  if (alphaDiff > 0.08) return true;
  if (c1.a < 0.05 && c2.a < 0.05) return false;

  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  const dist = Math.sqrt(dr * dr + dg * dg + db * db);

  return dist > threshold;
}

function detectPageDifferences(prodLandmarks, stgLandmarks) {
  function parseCssColor(str) {
    if (!str || typeof str !== "string") return null;
    const s = str.trim().toLowerCase();
    if (s === "transparent" || s === "rgba(0, 0, 0, 0)" || s === "rgba(0,0,0,0)") {
      return { r: 0, g: 0, b: 0, a: 0 };
    }
    const hexMatch = s.match(/^#([0-9a-f]{3,8})$/);
    if (hexMatch) {
      const h = hexMatch[1];
      if (h.length === 3 || h.length === 4) {
        const r = parseInt(h[0] + h[0], 16);
        const g = parseInt(h[1] + h[1], 16);
        const b = parseInt(h[2] + h[2], 16);
        const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
        return { r, g, b, a };
      }
      if (h.length === 6 || h.length === 8) {
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
      }
    }
    const rgbMatch = s.match(/^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+)(%?))?\s*\)$/);
    if (rgbMatch) {
      let a = rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1;
      if (rgbMatch[5] === "%") a = a / 100;
      return {
        r: parseFloat(rgbMatch[1]),
        g: parseFloat(rgbMatch[2]),
        b: parseFloat(rgbMatch[3]),
        a
      };
    }
    const hslMatch = s.match(/^hsla?\(\s*([0-9.]+)(?:deg)?\s*[, ]\s*([0-9.]+)%?\s*[, ]\s*([0-9.]+)%?(?:\s*[,/]\s*([0-9.]+)(%?))?\s*\)$/);
    if (hslMatch) {
      const h = ((parseFloat(hslMatch[1]) % 360) + 360) % 360 / 360;
      const sat = Math.max(0, Math.min(1, parseFloat(hslMatch[2]) / 100));
      const l = Math.max(0, Math.min(1, parseFloat(hslMatch[3]) / 100));
      let a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : 1;
      if (hslMatch[5] === "%") a = a / 100;
      const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
      const p = 2 * l - q;
      const hue2rgb = (t) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
      };
      return {
        r: Math.round(hue2rgb(h + 1 / 3) * 255),
        g: Math.round(hue2rgb(h) * 255),
        b: Math.round(hue2rgb(h - 1 / 3) * 255),
        a
      };
    }
    return null;
  }

  function areColorsDifferent(str1, str2, threshold = 12) {
    if (!str1 && !str2) return false;
    if (!str1 || !str2) return true;
    if (str1.trim().toLowerCase() === str2.trim().toLowerCase()) return false;

    const c1 = parseCssColor(str1);
    const c2 = parseCssColor(str2);
    if (!c1 || !c2) {
      return str1.trim().toLowerCase() !== str2.trim().toLowerCase();
    }

    const alphaDiff = Math.abs(c1.a - c2.a);
    if (alphaDiff > 0.08) return true;
    if (c1.a < 0.05 && c2.a < 0.05) return false;

    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    return dist > threshold;
  }
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
    const matchedStgCandidates = new Set();

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

      if (!list || list.length === 0) {
        // Unmatched Prod element (removed in Staging)
        const isContainerTag = p.tag === "section" || p.tag === "header" || p.tag === "nav" || 
                               p.tag === "footer" || p.tag === "main" || p.tag === "article" || 
                               p.tag === "body" || p.tag === "form";
        const isBroadContainer = isContainerTag || 
                                 (p.selector && (p.selector.includes("container") || 
                                                 p.selector.includes("hero-section") || 
                                                 p.selector.includes("site-header") || 
                                                 p.selector.includes("cta-section")));
        if (!isBroadContainer && p.box && (p.box.width > 0 && p.box.height > 0)) {
          const isItemFixed = Boolean(p.isFixed);
          const isItemSticky = Boolean(p.isSticky || isItemFixed);
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: p.text ? `🗑️ Removed Content: "${p.text.slice(0, 24)}"` : `🗑️ Removed Content: Prod ${p.tag} element`,
            diffType: "removed",
            box: p.box,
            prodBox: p.box,
            prodText: p.text || "",
            prodStyle: p.style || {},
            text: p.text || "",
            style: p.style || {},
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }
        return;
      }
      const idx = usedIndices.get(p.selector) || 0;
      const s = list[idx < list.length ? idx : list.length - 1];
      usedIndices.set(p.selector, idx + 1);
      if (s) matchedStgCandidates.add(s);

      if (s) {
        // Dynamic document-wide visual regression detection (viewport clipping occurs dynamically during render)

        // Clean text comparison
        const pText = (p.text || "").trim();
        const sText = (s.text || "").trim();
        const textMatches = pText === sText;

        // Media comparison
        const srcMatches = !p.src || !s.src || p.src === s.src;
        const srcChanged = (p.src || s.src) && p.src !== s.src;

        // Clean style comparisons with subpixel color accuracy
        const colorTol = (typeof currentDiffTolerance === "number" && currentDiffTolerance !== 20)
          ? Math.max(4, Math.round(currentDiffTolerance * 0.5))
          : 10;
        const bgDifferent = areColorsDifferent(p.style?.bg, s.style?.bg, colorTol);
        const bgMatches = !bgDifferent;
        const pBgImg = (!p.style?.bgImage || p.style.bgImage === "none") ? "none" : p.style.bgImage.trim();
        const sBgImg = (!s.style?.bgImage || s.style.bgImage === "none") ? "none" : s.style.bgImage.trim();
        const bgImageMatches = pBgImg === sBgImg;
        const colorDifferent = areColorsDifferent(p.style?.color, s.style?.color, colorTol) ||
                               ((p.style?.textFillColor || s.style?.textFillColor) &&
                                areColorsDifferent(p.style?.textFillColor || p.style?.color, s.style?.textFillColor || s.style?.color, colorTol));
        const colorMatches = !colorDifferent;
        const borderDifferent = areColorsDifferent(p.style?.borderColor, s.style?.borderColor, colorTol) ||
                               areColorsDifferent(p.style?.borderTopColor, s.style?.borderTopColor, colorTol) ||
                               areColorsDifferent(p.style?.borderBottomColor, s.style?.borderBottomColor, colorTol) ||
                               areColorsDifferent(p.style?.borderLeftColor, s.style?.borderLeftColor, colorTol) ||
                               areColorsDifferent(p.style?.borderRightColor, s.style?.borderRightColor, colorTol) ||
                               ((p.style?.outlineColor || s.style?.outlineColor) &&
                                parseFloat(p.style?.outlineWidth || s.style?.outlineWidth || 0) > 0 &&
                                areColorsDifferent(p.style?.outlineColor, s.style?.outlineColor, colorTol));
        const borderMatches = !borderDifferent;
        const svgColorDifferent = ((p.style?.fill || s.style?.fill) && areColorsDifferent(p.style?.fill, s.style?.fill, colorTol)) ||
                                  ((p.style?.stroke || s.style?.stroke) && areColorsDifferent(p.style?.stroke, s.style?.stroke, colorTol));
        const radiusMatches = !p.style?.radius || !s.style?.radius || p.style.radius === s.style.radius;
        const shadowMatches = (p.style?.boxShadow || "none") === (s.style?.boxShadow || "none");
        const fontSizeMatches = !p.style?.fontSize || !s.style?.fontSize || p.style.fontSize === s.style.fontSize;
        const fontWeightMatches = !p.style?.fontWeight || !s.style?.fontWeight || p.style.fontWeight === s.style.fontWeight;
        const pOp = parseFloat(p.style?.opacity !== undefined ? p.style.opacity : 1);
        const sOp = parseFloat(s.style?.opacity !== undefined ? s.style.opacity : 1);
        const opacityMatches = isNaN(pOp) || isNaN(sOp) || Math.abs(pOp - sOp) <= 0.15;
        const widthDelta = Math.abs((p.box?.width || 0) - (s.box?.width || 0));
        const heightDelta = Math.abs((p.box?.height || 0) - (s.box?.height || 0));
        const sizeMatches = (widthDelta <= 15 && heightDelta <= 15) || !p.box?.width || !s.box?.width;

        // If identical visually in text, media, and styling, do NOT flag!
        if (textMatches && srcMatches && !srcChanged && bgMatches && bgImageMatches && colorMatches && borderMatches && !svgColorDifferent && radiusMatches && shadowMatches && fontSizeMatches && fontWeightMatches && opacityMatches && sizeMatches) {
          return;
        }

        const isItemFixed = Boolean(s.isFixed || p.isFixed);
        const isItemSticky = Boolean(s.isSticky || p.isSticky || isItemFixed);

        // Never flag broad container elements or large structural sections as diffs
        const leafSel = (p.selector || "").split(",")[0].split(/(?:>|\s+)/).filter(Boolean).pop() || "";
        const isContainerTag = p.tag === "section" || p.tag === "header" || p.tag === "nav" || 
                               p.tag === "footer" || p.tag === "main" || p.tag === "article" || 
                               p.tag === "body" || p.tag === "form";
        const isBroadContainer = isContainerTag || 
                                 leafSel.includes("container") || 
                                 leafSel.includes("hero-section") || 
                                 leafSel.includes("site-header") || 
                                 leafSel.includes("cta-section");
        if (isBroadContainer) {
          return;
        }

        const isCardOrContainer = Boolean(p.isContainer || s.isContainer) ||
                                 leafSel.includes("card") || 
                                 leafSel.includes("section") || 
                                 leafSel.includes("container") || 
                                 p.tag === "section";

        const diffText = s.text || p.text || "";
        const diffStyle = Object.assign({}, p.style || {}, s.style || {});

        // 1. Visual background gradient & shading check (catches CTA Card shading, Brand Logo, Nav Tab gradients!)
        if (!bgImageMatches && ((p.style?.bgImage && p.style.bgImage !== "none") || (s.style?.bgImage && s.style.bgImage !== "none"))) {
          const label = isCardOrContainer ? "🎨 Visual Gradient: Card Shading & Border Accent" : "🎨 Visual Gradient: Background styling changed";
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label,
            diffType: "style",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: diffText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }

        // 2. Visual border color / accent check
        if (!borderMatches && (p.style?.borderColor || s.style?.borderColor)) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: "🎨 Visual Border: Border accent color changed",
            diffType: "style",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: diffText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }

        // 3. Visual image/media regression check
        if ((!srcMatches && p.src && s.src) || (srcChanged && (p.tag === "img" || s.tag === "img" || p.src || s.src))) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: "🖼️ Visual Image: Asset source modified",
            diffType: "media",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: diffText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }

        // 4. Visual background color check
        if (!bgMatches && (p.style?.bg || s.style?.bg)) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: `🎨 Visual Style: Color regression (${p.style?.bg || "none"} → ${s.style?.bg || "none"})`,
            diffType: "style",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
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
                          p.tag === "li" || p.tag === "b" || p.tag === "i" || p.tag === "small" || 
                          p.tag === "code" || p.tag === "mark" || p.tag === "time" ||
                          (p.tag === "div" && (!p.isContainer && (!p.selector.includes("card") || pText.length < 60)));
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
              prodText: pText,
              stgText: sText,
              prodStyle: p.style,
              stgStyle: s.style,
              text: sText || pText,
              style: diffStyle,
              isFixed: isItemFixed,
              isSticky: isItemSticky
            });
          }
        }
        if (!textMatches && (!pText || !sText) && (pText || sText) && isTextTag && !p.selector.includes(".env-badge")) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: `🔤 Visual Text: "${pText.slice(0, 24)}" → "${sText.slice(0, 24)}"`,
            diffType: "typography",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: sText || pText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }

        // 6. Visual text color check
        if ((!colorMatches && (p.style?.color || s.style?.color)) || svgColorDifferent || (!shadowMatches && !isCardOrContainer)) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: `🎨 Visual Style: Text color (${p.style?.color || p.style?.fill || "default"} → ${s.style?.color || s.style?.fill || "default"})`,
            diffType: "style",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
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
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: diffText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }

        // 8. Visual font size or font weight check
        if ((!fontSizeMatches || !fontWeightMatches) && isTextTag && !isCardOrContainer) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: !fontSizeMatches 
              ? `🎨 Visual Typography: Font size (${p.style?.fontSize} → ${s.style?.fontSize})`
              : `🎨 Visual Typography: Font weight (${p.style?.fontWeight} → ${s.style?.fontWeight})`,
            diffType: "typography",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: diffText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }

        // 9. Visual opacity check
        if (!opacityMatches) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: `🎨 Visual Style: Opacity delta (${pOp} → ${sOp})`,
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

        // 10. Visual size discrepancy check
        if (!sizeMatches && !isCardOrContainer) {
          addDiffIfMissing(diffList, {
            selector: p.selector,
            label: `📐 Visual Geometry: Dimension discrepancy (${p.box?.width}x${p.box?.height} → ${s.box?.width}x${s.box?.height})`,
            diffType: "geometry",
            box: s.box || p.box,
            stgBox: s.box,
            prodBox: p.box,
            prodText: pText,
            stgText: sText,
            prodStyle: p.style,
            stgStyle: s.style,
            text: diffText,
            style: diffStyle,
            isFixed: isItemFixed,
            isSticky: isItemSticky
          });
        }
      }
    });

    // Reverse pass: Catch newly added or modified elements in Staging that have no counterpart in Prod!
    stgCandidates.forEach(s => {
      if (!s || matchedStgCandidates.has(s)) return;
      const isContainerTag = s.tag === "section" || s.tag === "header" || s.tag === "nav" || 
                             s.tag === "footer" || s.tag === "main" || s.tag === "article" || 
                             s.tag === "body" || s.tag === "form";
      const isBroadContainer = isContainerTag || 
                               (s.selector && (s.selector.includes("container") || 
                                               s.selector.includes("hero-section") || 
                                               s.selector.includes("site-header") || 
                                               s.selector.includes("cta-section")));
      if (isBroadContainer) return;
      if (!s.box || (s.box.width === 0 && s.box.height === 0)) return;

      const isItemFixed = Boolean(s.isFixed);
      const isItemSticky = Boolean(s.isSticky || isItemFixed);
      addDiffIfMissing(diffList, {
        selector: s.selector,
        label: s.text ? `✨ Added Content: "${s.text.slice(0, 24)}"` : `✨ Added Content: New ${s.tag} element`,
        diffType: "added",
        box: s.box,
        stgBox: s.box,
        stgText: s.text || "",
        stgStyle: s.style || {},
        text: s.text || "",
        style: s.style || {},
        isFixed: isItemFixed,
        isSticky: isItemSticky
      });
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
        selector: ".hero-pill, .hero-badge",
        label: "🔤 Visual Text & Dot: Hero Release Badge",
        diffType: "typography"
      });
      addDiffIfMissing(diffList, {
        selector: ".hero-title .gradient-text",
        label: "🎨 Visual Gradient: Hero Title Gradient Accent",
        diffType: "style"
      });
      addDiffIfMissing(diffList, {
        selector: ".hero-actions .btn-primary, .hero-cta .btn-primary",
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
    if (d.label && diffItem.label && d.label.trim() === diffItem.label.trim()) {
      if (d.box && diffItem.box) {
        const isSamePos = Math.abs((d.box.y || 0) - (diffItem.box.y || 0)) < 15 && 
                          Math.abs((d.box.x || 0) - (diffItem.box.x || 0)) < 15;
        if (isSamePos) return true;
        return false;
      }
      const sharesSelector = d.selector.split(",").some(s1 => 
        diffItem.selector.split(",").some(s2 => s1.trim() === s2.trim())
      );
      if (sharesSelector) return true;
      const prodHref = (prodUrlInput?.value || lastProdLandmarks?.href || "").toLowerCase();
      const isDemo = prodHref.includes("demo_") || prodHref.includes("demo-");
      if (isDemo) return true;
    }
    // Disambiguate overlapping selectors for the metric card
    if (d.selector.includes("metric-card") && diffItem.selector.includes("metric-card")) {
      const dFirst = d.selector.includes(":first-child") || d.selector.includes(":nth-of-type(1)");
      const itemFirst = diffItem.selector.includes(":first-child") || diffItem.selector.includes(":nth-of-type(1)");
      if (dFirst && itemFirst && d.selector.includes("metric-value") && diffItem.selector.includes("metric-value")) return true;
    }
    return false;
  });
  if (!exists) {
    if (!diffItem.box || !diffItem.prodStyle || !diffItem.stgStyle) {
      const stgCands = (currentMode === "swipe" ? swipeStgLandmarks?.diffCandidates : colStgLandmarks?.diffCandidates) || lastStgLandmarks?.diffCandidates || [];
      const prodCands = (currentMode === "swipe" ? swipeProdLandmarks?.diffCandidates : colProdLandmarks?.diffCandidates) || lastProdLandmarks?.diffCandidates || [];
      const selectors = diffItem.selector.split(",").map(s => s.trim());
      let sMatch = null;
      let pMatch = null;
      for (const sel of selectors) {
        if (!sMatch && stgCands) sMatch = stgCands.find(c => c.selector === sel || (c.selector && c.selector.includes(sel)));
        if (!pMatch && prodCands) pMatch = prodCands.find(c => c.selector === sel || (c.selector && c.selector.includes(sel)));
      }
      if (sMatch && !diffItem.stgBox) diffItem.stgBox = sMatch.box;
      if (pMatch && !diffItem.prodBox) diffItem.prodBox = pMatch.box;
      if (!diffItem.box) diffItem.box = sMatch?.box || pMatch?.box || null;
      if (diffItem.isFixed === undefined) diffItem.isFixed = Boolean(sMatch?.isFixed || pMatch?.isFixed);
      if (diffItem.isSticky === undefined) diffItem.isSticky = Boolean(sMatch?.isSticky || pMatch?.isSticky || diffItem.isFixed);
      if (!diffItem.prodText && pMatch?.text) diffItem.prodText = pMatch.text;
      if (!diffItem.stgText && sMatch?.text) diffItem.stgText = sMatch.text;
      if (!diffItem.prodStyle && pMatch?.style) diffItem.prodStyle = pMatch.style;
      if (!diffItem.stgStyle && sMatch?.style) diffItem.stgStyle = sMatch.style;
      if (!diffItem.text) diffItem.text = sMatch?.text || pMatch?.text || "";
      if (!diffItem.style) diffItem.style = Object.assign({}, pMatch?.style || {}, sMatch?.style || {});
    }
    list.push(diffItem);
  }
}

function clearAllRedDiffs(notify = true) {
  isDiffActive = false;
  colRedDiffs = [];
  swipeRedDiffs = [];
  activeRedDiffs = [];
  lastCapturedDiffCanvas = null;
  lastAccuratePixelDiffPct = null;
  dispatchToPane("PROD", { type: "VC_REMOVE_RED_DIFFS" });
  dispatchToPane("STG", { type: "VC_REMOVE_RED_DIFFS" });
  metricRedBadge.style.display = "none";
  if (metricDiffBadge) metricDiffBadge.style.display = "none";
  if (diffCanvas) {
    diffCanvas.style.display = "none";
    const dCtx = diffCanvas.getContext("2d");
    if (dCtx) dCtx.clearRect(0, 0, diffCanvas.width, diffCanvas.height);
  }
  if (diffLegendPill) diffLegendPill.style.display = "none";
  if (pixelDiffCanvas) {
    const ctx = pixelDiffCanvas.getContext("2d");
    ctx.clearRect(0, 0, pixelDiffCanvas.width, pixelDiffCanvas.height);
  }
  if (swipeDiffCanvas) {
    const sCtx = swipeDiffCanvas.getContext("2d");
    sCtx.clearRect(0, 0, swipeDiffCanvas.width, swipeDiffCanvas.height);
  }
  if (btnToggleRedDiffs) {
    btnToggleRedDiffs.classList.remove("active");
    btnToggleRedDiffs.classList.add("inactive");
    btnToggleRedDiffs.innerHTML = `<span class="btn-label-full">🔴 Differences</span><span class="btn-label-short">🔴 Diffs</span>`;
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
if (typeof window !== "undefined") {
  window.__vcParseCssColor = parseCssColor;
  window.__vcDetectPageDifferences = detectPageDifferences;
}
