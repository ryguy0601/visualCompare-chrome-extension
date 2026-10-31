/**
 * VisualCompare Live - Studio: DOM-aware landmark alignment and hazard spacers
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

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
  if (typeof window !== "undefined" && window.__vcAlignedDocHeight > 0) {
    sendSpacerToWindow(win, { type: "VC_SET_MIN_DOC_HEIGHT", minDocHeight: window.__vcAlignedDocHeight });
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

  const hadPrevSpacers = (activeHazardSpacers.PROD.length > 0 || activeHazardSpacers.STG.length > 0);

  activeHazardSpacers = { PROD: [], STG: [] };
  activeShiftRegions = [];

  let totalShiftDelta = 0;
  let shiftCount = 0;
  let prevProdBot = 0;
  let prevStgBot = 0;
  let currAlignedY = 0;

  for (let idx = 0; idx < pairs.length; idx++) {
    const pSec = pairs[idx].prod;
    const sSec = pairs[idx].stg;

    // 1. GAP / INSERTED SECTION CHECK (Did one page insert an extra section or banner before this section?)
    const pGap = Math.max(0, pSec.box.y - prevProdBot);
    const sGap = Math.max(0, sSec.box.y - prevStgBot);
    const gapDiff = Math.abs(pGap - sGap);

    // Advance aligned coordinate by common baseline gap
    const commonGap = Math.min(pGap, sGap);
    currAlignedY += commonGap;

    if (gapDiff > 4) {
      totalShiftDelta += gapDiff;
      shiftCount++;
      const gapSpacerId = `vc-spacer-gap-${idx}`;
      const y = currAlignedY;
      activeShiftRegions.push({ y, h: gapDiff, label: `+${gapDiff}px (inserted space)` });
      currAlignedY += gapDiff;
      activeShiftRegions[activeShiftRegions.length - 1].spacerId = gapSpacerId;
      activeShiftRegions[activeShiftRegions.length - 1].pane = pGap < sGap ? "PROD" : "STG";
      activeShiftRegions[activeShiftRegions.length - 1].targetSelector = pGap < sGap ? pSec.selector : sSec.selector;

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
      }
    }

    // 2. SAME-SECTION SIZE CHECK: Is this section larger on one page than the other?
    const pH = pSec.box.height;
    const sH = sSec.box.height;
    const secDiff = Math.abs(pH - sH);
    const overlapH = Math.min(pH, sH);

    // Both sections share overlapH height
    currAlignedY += overlapH;

    // ONLY show yellow if one section is larger than the other page's same section!
    if (secDiff > 4) {
      totalShiftDelta += secDiff;
      shiftCount++;
      const secSpacerId = `vc-spacer-sec-${idx}`;
      const y = currAlignedY;
      activeShiftRegions.push({ y, h: secDiff, label: `+${secDiff}px ("${pSec.heading || pSec.tag || sSec.heading || sSec.tag}" is larger)` });
      currAlignedY += secDiff;
      activeShiftRegions[activeShiftRegions.length - 1].spacerId = secSpacerId;
      activeShiftRegions[activeShiftRegions.length - 1].pane = pH < sH ? "PROD" : "STG";
      activeShiftRegions[activeShiftRegions.length - 1].targetSelector = pH < sH ? pSec.selector : sSec.selector;

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
      }
    }

    prevProdBot = pSec.box.y + pH;
    prevStgBot = sSec.box.y + sH;
  }

  // Prune only obsolete spacers in-place so active spacers never tear down or jump during updates
  if (hadPrevSpacers || activeHazardSpacers.PROD.length > 0 || activeHazardSpacers.STG.length > 0) {
    dispatchToPane("PROD", {
      type: "VC_REMOVE_HAZARD_SPACERS",
      keepIds: activeHazardSpacers.PROD.map(s => s.spacerId)
    });
    dispatchToPane("STG", {
      type: "VC_REMOVE_HAZARD_SPACERS",
      keepIds: activeHazardSpacers.STG.map(s => s.spacerId)
    });
  }

  // Synchronize unified aligned document height across PROD, STG, and Column 3 (iframeDiffBase)
  const prodSpacerSum = activeHazardSpacers.PROD.reduce((sum, s) => sum + (s.height || 0), 0);
  const stgSpacerSum = activeHazardSpacers.STG.reduce((sum, s) => sum + (s.height || 0), 0);
  const alignedDocHeight = Math.max(
    (lastProdLandmarks.docHeight || 0) + prodSpacerSum,
    (lastStgLandmarks.docHeight || 0) + stgSpacerSum,
    currAlignedY
  );
  if (typeof window !== "undefined") {
    window.__vcAlignedDocHeight = alignedDocHeight;
  }
  if (alignedDocHeight > 0) {
    dispatchToPane("PROD", { type: "VC_SET_MIN_DOC_HEIGHT", minDocHeight: alignedDocHeight });
    dispatchToPane("STG", { type: "VC_SET_MIN_DOC_HEIGHT", minDocHeight: alignedDocHeight });
  }

  if (shiftCount > 0) {
    metricShiftBadge.style.display = "none";
    metricShiftVal.textContent = `+${totalShiftDelta}px`;
    if (chipSyncHazard) {
      chipSyncHazard.title = `Layout Shift Compensation: +${totalShiftDelta}px shifted (${shiftCount} yellow spacer${shiftCount === 1 ? "" : "s"})`;
    }
  } else {
    metricShiftBadge.style.display = "none";
    metricShiftVal.textContent = "+0px";
    if (chipSyncHazard) {
      chipSyncHazard.title = "Toggle Yellow Layout Shift Hazard Spacers";
    }
  }

  // Automatically evaluate & apply Red Differences if enabled
  if (checkSyncRedDiff && checkSyncRedDiff.checked) {
    computeAndApplyRedDifferences();
  }

  // Request post-spacer candidate positions so elements shifted by hazard spacers report aligned coordinates
  if (shiftCount > 0 && typeof requestScrollDiffCandidates === "function") {
    setTimeout(() => {
      requestScrollDiffCandidates();
    }, 50);
  }

  if (currentMode === "swipe" && swipeCompareMode === "diff") {
    renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
  } else if (currentMode === "side-by-side" && isColDiffActive) {
    renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
  }
}

function clearAllHazardSpacers(notify = true) {
  activeHazardSpacers = { PROD: [], STG: [] };
  activeShiftRegions = [];
  if (typeof window !== "undefined") {
    window.__vcAlignedDocHeight = 0;
  }
  dispatchToPane("PROD", { type: "VC_REMOVE_HAZARD_SPACERS" });
  dispatchToPane("STG", { type: "VC_REMOVE_HAZARD_SPACERS" });
  dispatchToPane("PROD", { type: "VC_SET_MIN_DOC_HEIGHT", minDocHeight: 0 });
  dispatchToPane("STG", { type: "VC_SET_MIN_DOC_HEIGHT", minDocHeight: 0 });
  metricShiftBadge.style.display = "none";
  if (chipSyncHazard) {
    chipSyncHazard.title = "Toggle Yellow Layout Shift Hazard Spacers";
  }
  if (currentMode === "swipe" && swipeCompareMode === "diff") {
    renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
  } else if (currentMode === "side-by-side" && isColDiffActive) {
    renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
  }
}
