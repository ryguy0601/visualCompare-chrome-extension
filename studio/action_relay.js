/**
 * VisualCompare Live - Studio: Cross-frame action relay (mirror engine)
 * Part of the studio controller; loaded as a classic script (see studio.html for order).
 * Top-level declarations are shared with the other studio/*.js files.
 */

// ----------------------------------------------------
// 3. CROSS-FRAME ACTION RELAY (THE CORE MIRROR ENGINE)
// ----------------------------------------------------
function mergeDiffCandidates(prevList, nextList) {
  if (!Array.isArray(nextList) || nextList.length === 0) return Array.isArray(prevList) ? prevList : [];
  if (!Array.isArray(prevList) || prevList.length === 0) return nextList;
  const prevW = prevList[0]?.box?.measuredWidth || 0;
  const nextW = nextList[0]?.box?.measuredWidth || 0;
  if (prevW > 0 && nextW > 0 && Math.abs(prevW - nextW) > 20) {
    return nextList.slice();
  }
  const merged = nextList.slice();
  const seenKeys = new Set(nextList.map((c, idx) => `${c.selector || ""}#${idx}`));
  const nextBySelector = new Map();
  nextList.forEach(c => {
    if (!c || !c.selector) return;
    nextBySelector.set(c.selector, (nextBySelector.get(c.selector) || 0) + 1);
  });
  const prevBySelector = new Map();
  prevList.forEach(c => {
    if (!c || !c.selector) return;
    const occ = (prevBySelector.get(c.selector) || 0) + 1;
    prevBySelector.set(c.selector, occ);
    const nextCount = nextBySelector.get(c.selector) || 0;
    if (occ > nextCount && !seenKeys.has(`${c.selector}#${occ - 1}`)) {
      merged.push(c);
    }
  });
  return merged;
}
if (typeof window !== "undefined") {
  window.__vcMergeDiffCandidates = mergeDiffCandidates;
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "VC_CAPTURE_READY") {
    if (msg.paneId === "PROD") lastCaptureReadyProd = msg;
    if (msg.paneId === "STG") lastCaptureReadyStg = msg;
    return;
  }

  // Frame ping / initial handshake
  if (msg.type === "VC_FRAME_PING") {
    const sourceWindow = event.source;
    const targetPane = (sourceWindow === iframeProd.contentWindow || sourceWindow === iframeSwipeProd.contentWindow || sourceWindow === iframeFlickerProd.contentWindow || sourceWindow === iframeOverlayProd.contentWindow) ? "PROD" : "STG";
    try {
      sourceWindow.postMessage({ type: "VC_INIT_AGENT", paneId: targetPane }, "*");
    } catch (e) {}

    // If active staging frame pings on navigation, immediately sync diff base frames
    if (msg.href && sourceWindow === iframeStg?.contentWindow) {
      if (stgUrlInput && document.activeElement !== stgUrlInput) {
        stgUrlInput.value = msg.href;
      }
      if (iframeDiffBase && iframeDiffBase.src !== msg.href) {
        iframeDiffBase.src = msg.href;
      }
      if (iframeSwipeDiff && iframeSwipeDiff.src !== msg.href) {
        iframeSwipeDiff.src = msg.href;
      }
    }
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

        if (msg.paneId === "STG") {
          // Keep 3rd column pixel diff base iframe synchronized to the new Staging route
          if (iframeDiffBase && sourceWindow !== iframeDiffBase.contentWindow) {
            if (iframeDiffBase.src !== msg.href) {
              iframeDiffBase.src = msg.href;
            }
          }
          if (iframeSwipeDiff && sourceWindow !== iframeSwipeDiff.contentWindow) {
            if (iframeSwipeDiff.src !== msg.href) {
              iframeSwipeDiff.src = msg.href;
            }
          }
          if (isColDiffActive && currentMode === "side-by-side") {
            setTimeout(() => {
              renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
            }, 250);
          }
        }

        if (msg.paneId === "PROD") {
          if (isColDiffActive && currentMode === "side-by-side") {
            setTimeout(() => {
              renderPixelDiffColumn3(activeRedDiffs, activeShiftRegions);
            }, 250);
          }
        }
      }
      reapplyActiveSpacersToWindow(sourceWindow, msg.paneId);
      reapplyActiveRedDiffsToWindow(sourceWindow);
      if (lastScrollState.scrollY > 0 || lastScrollState.scrollX > 0) {
        try {
          sourceWindow.postMessage({
            type: "VC_MIRROR_ACTION",
            action: {
              kind: "scroll",
              scrollY: lastScrollState.scrollY,
              scrollX: lastScrollState.scrollX
            }
          }, "*");
        } catch (e) {}
      }
    }
    return;
  }

  // Landmark report for layout shift alignment
  if (msg.type === "VC_LANDMARKS_REPORT") {
    const sourceWindow = event.source;
    const active = getActiveFramesForMode(currentMode);

    // Only accept landmark reports from the active frames of the currently viewed mode
    const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
    const isFromActiveStg = (active.stg && sourceWindow === active.stg.contentWindow) || 
                            (active.baseStg && sourceWindow === active.baseStg.contentWindow) || 
                            (active.diff && sourceWindow === active.diff.contentWindow);
    if (!isFromActiveProd && !isFromActiveStg) {
      return;
    }

    const initW = msg.diffCandidates?.[0]?.box?.measuredWidth || msg.docWidth ||
      (currentMode === "swipe" ? (swipeContainer?.clientWidth || 1200) : (iframeProd?.clientWidth || 400));

    if (currentMode === "swipe") {
      if (msg.paneId === "PROD") {
        const prevW = swipeProdLandmarks?.measuredWidth || lastProdLandmarks?.measuredWidth || 0;
        const prevCandidates = (prevW > 0 && Math.abs(prevW - initW) > 20) ? [] : (swipeProdLandmarks?.diffCandidates || lastProdLandmarks?.diffCandidates || []);
        swipeProdLandmarks = { ...msg, measuredWidth: initW, diffCandidates: msg.diffCandidates?.length ? msg.diffCandidates : prevCandidates };
        lastProdLandmarks = swipeProdLandmarks;
      } else if (msg.paneId === "STG") {
        const prevW = swipeStgLandmarks?.measuredWidth || lastStgLandmarks?.measuredWidth || 0;
        const prevCandidates = (prevW > 0 && Math.abs(prevW - initW) > 20) ? [] : (swipeStgLandmarks?.diffCandidates || lastStgLandmarks?.diffCandidates || []);
        swipeStgLandmarks = { ...msg, measuredWidth: initW, diffCandidates: msg.diffCandidates?.length ? msg.diffCandidates : prevCandidates };
        lastStgLandmarks = swipeStgLandmarks;
      }
    } else {
      if (msg.paneId === "PROD") {
        const prevW = colProdLandmarks?.measuredWidth || lastProdLandmarks?.measuredWidth || 0;
        const prevCandidates = (prevW > 0 && Math.abs(prevW - initW) > 20) ? [] : (colProdLandmarks?.diffCandidates || lastProdLandmarks?.diffCandidates || []);
        colProdLandmarks = { ...msg, measuredWidth: initW, diffCandidates: msg.diffCandidates?.length ? msg.diffCandidates : prevCandidates };
        lastProdLandmarks = colProdLandmarks;
      } else if (msg.paneId === "STG") {
        const prevW = colStgLandmarks?.measuredWidth || lastStgLandmarks?.measuredWidth || 0;
        const prevCandidates = (prevW > 0 && Math.abs(prevW - initW) > 20) ? [] : (colStgLandmarks?.diffCandidates || lastStgLandmarks?.diffCandidates || []);
        colStgLandmarks = { ...msg, measuredWidth: initW, diffCandidates: msg.diffCandidates?.length ? msg.diffCandidates : prevCandidates };
        lastStgLandmarks = colStgLandmarks;
      }
    }

    // Calculate shift alignment & re-evaluate active diffs whenever both active frames have reported
    if (lastProdLandmarks && lastStgLandmarks) {
      clearTimeout(alignDebounceTimer);
      alignDebounceTimer = setTimeout(() => {
        if (checkSyncHazard && checkSyncHazard.checked && lastProdLandmarks && lastStgLandmarks) {
          calculateAndApplyLayoutShifts();
        }
        if (checkSyncRedDiff && checkSyncRedDiff.checked && (isDiffActive || isColDiffActive || (currentMode === "swipe" && swipeCompareMode === "diff") || currentMode === "overlay")) {
          runVisualDiffCalculation(false);
        }
      }, 80);
    }
    return;
  }

  if (msg.type === "VC_DIFF_CANDIDATES_REPORT") {
    const sourceWindow = event.source;
    const active = getActiveFramesForMode(currentMode);

    // Only accept candidate reports from active frames of currently viewed mode
    const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
    const isFromActiveStg = (active.stg && sourceWindow === active.stg.contentWindow) || 
                            (active.baseStg && sourceWindow === active.baseStg.contentWindow) || 
                            (active.diff && sourceWindow === active.diff.contentWindow);
    if (!isFromActiveProd && !isFromActiveStg) {
      return;
    }

    const frameWidth = msg.candidates?.[0]?.box?.measuredWidth || 
      (currentMode === "swipe" ? (swipeContainer?.clientWidth || 1200) : (iframeProd?.clientWidth || 400));

    if (currentMode === "swipe") {
      if (msg.paneId === "PROD") {
        swipeProdLandmarks = {
          ...swipeProdLandmarks,
          landmarks: swipeProdLandmarks?.landmarks || lastProdLandmarks?.landmarks || [],
          docHeight: swipeProdLandmarks?.docHeight || lastProdLandmarks?.docHeight || 0,
          diffCandidates: mergeDiffCandidates(swipeProdLandmarks?.diffCandidates, msg.candidates),
          measuredWidth: frameWidth,
          href: msg.href
        };
        lastProdLandmarks = swipeProdLandmarks;
      } else if (msg.paneId === "STG") {
        swipeStgLandmarks = {
          ...swipeStgLandmarks,
          landmarks: swipeStgLandmarks?.landmarks || lastStgLandmarks?.landmarks || [],
          docHeight: swipeStgLandmarks?.docHeight || lastStgLandmarks?.docHeight || 0,
          diffCandidates: mergeDiffCandidates(swipeStgLandmarks?.diffCandidates, msg.candidates),
          measuredWidth: frameWidth,
          href: msg.href
        };
        lastStgLandmarks = swipeStgLandmarks;
      }
      if (checkSyncHazard && checkSyncHazard.checked && !isUserScrolling && activeShiftRegions.length === 0 && lastProdLandmarks?.landmarks?.length > 0 && lastStgLandmarks?.landmarks?.length > 0) {
        calculateAndApplyLayoutShifts();
      }
      if (checkSyncRedDiff && checkSyncRedDiff.checked) {
        if (swipeProdLandmarks && swipeStgLandmarks && Math.abs(swipeProdLandmarks.measuredWidth - swipeStgLandmarks.measuredWidth) < 120) {
          computeAndApplyRedDifferences(true);
          if (swipeCompareMode === "diff") {
            renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
          }
        }
      }
    } else {
      if (msg.paneId === "PROD") {
        colProdLandmarks = {
          ...colProdLandmarks,
          landmarks: colProdLandmarks?.landmarks || lastProdLandmarks?.landmarks || [],
          docHeight: colProdLandmarks?.docHeight || lastProdLandmarks?.docHeight || 0,
          diffCandidates: mergeDiffCandidates(colProdLandmarks?.diffCandidates, msg.candidates),
          measuredWidth: frameWidth,
          href: msg.href
        };
        lastProdLandmarks = colProdLandmarks;
      } else if (msg.paneId === "STG") {
        colStgLandmarks = {
          ...colStgLandmarks,
          landmarks: colStgLandmarks?.landmarks || lastStgLandmarks?.landmarks || [],
          docHeight: colStgLandmarks?.docHeight || lastStgLandmarks?.docHeight || 0,
          diffCandidates: mergeDiffCandidates(colStgLandmarks?.diffCandidates, msg.candidates),
          measuredWidth: frameWidth,
          href: msg.href
        };
        lastStgLandmarks = colStgLandmarks;
      }
      if (checkSyncHazard && checkSyncHazard.checked && !isUserScrolling && activeShiftRegions.length === 0 && lastProdLandmarks?.landmarks?.length > 0 && lastStgLandmarks?.landmarks?.length > 0) {
        calculateAndApplyLayoutShifts();
      }
      if (checkSyncRedDiff && checkSyncRedDiff.checked) {
        if (colProdLandmarks && colStgLandmarks && Math.abs(colProdLandmarks.measuredWidth - colStgLandmarks.measuredWidth) < 120) {
          computeAndApplyRedDifferences(true);
          if (isColDiffActive) {
            renderPixelDiffColumn3(colRedDiffs, activeShiftRegions, lastScrollState.scrollY || 0, lastScrollState.scrollX || 0);
          } else if (currentMode === "overlay") {
            renderDiffCanvasHeatmap(colRedDiffs, activeShiftRegions);
          }
        }
      }
    }
    return;
  }

  // Live bounding rect report from applied red diff highlights
  if (msg.type === "VC_RED_DIFFS_APPLIED") {
    const sourceWindow = event.source;
    const active = getActiveFramesForMode(currentMode);

    // Only accept applied reports from active frames of currently viewed mode
    const isFromActiveProd = active.prod && sourceWindow === active.prod.contentWindow;
    const isFromActiveStg = (active.stg && sourceWindow === active.stg.contentWindow) || 
                            (active.baseStg && sourceWindow === active.baseStg.contentWindow) || 
                            (active.diff && sourceWindow === active.diff.contentWindow);
    if (!isFromActiveProd && !isFromActiveStg) {
      return;
    }

    const activeDiffsList = (currentMode === "swipe") ? swipeRedDiffs : (currentMode === "side-by-side" ? colRedDiffs : activeRedDiffs);

    if (Array.isArray(msg.boxes) && msg.boxes.length > 0) {
      const expectedW = (currentMode === "swipe") 
        ? (swipeContainer?.clientWidth || 1200) 
        : (wrapFrameDiff?.clientWidth || iframeProd?.clientWidth || 400);

      msg.boxes.forEach(box => {
        if (box.measuredWidth && Math.abs(box.measuredWidth - expectedW) > 150) {
          return;
        }
        const match = activeDiffsList.find(d => d.selector === box.selector);
        if (match) {
          const boxObj = {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            viewportX: box.viewportX,
            viewportY: box.viewportY,
            measuredWidth: box.measuredWidth
          };
          if (msg.paneId === "STG" || isFromActiveStg) {
            match.stgBox = boxObj;
            match.box = boxObj;
          } else if (msg.paneId === "PROD" || isFromActiveProd) {
            match.prodBox = boxObj;
            if (!match.stgBox) {
              match.box = boxObj;
            }
          } else {
            match.box = boxObj;
          }
          if (box.isFixed !== undefined) match.isFixed = box.isFixed;
          if (box.isSticky !== undefined) match.isSticky = box.isSticky;
          if (box.text) match.text = box.text;
          if (box.style) match.style = Object.assign(match.style || {}, box.style);
        }
      });
      activeRedDiffs = activeDiffsList;
      if (isDiffActive && currentMode === "overlay") {
        renderDiffCanvasHeatmap(activeRedDiffs, activeShiftRegions);
      }
      if (isColDiffActive || (paneColDiff && paneColDiff.style.display !== "none")) {
        renderPixelDiffColumn3(colRedDiffs, activeShiftRegions);
      }
      if (currentMode === "swipe" && swipeCompareMode === "diff") {
        renderSwipeDiffCanvas(swipeRedDiffs, activeShiftRegions);
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
    return;
  }

  if (msg.type === "VC_WHEEL_SCROLL") {
    if (msg.ctrlKey || msg.metaKey) {
      if (typeof stepColumnZoom === "function") {
        const colKey = msg.paneId === "PROD" ? "prod" : (msg.paneId === "STG" ? "stg" : "all");
        stepColumnZoom(colKey, (msg.deltaY || 0) < 0 ? 0.25 : -0.25, !msg.altKey);
      }
      return;
    }
    if (!checkSyncScroll || !checkSyncScroll.checked) return;
    activeScrollLeader = "WHEEL";
    clearTimeout(scrollLeaderTimer);
    scrollLeaderTimer = setTimeout(() => { activeScrollLeader = null; }, 120);

    if (currentMode === "side-by-side") {
      handleSideBySideWheel({ deltaY: msg.deltaY, deltaX: msg.deltaX });
    } else if (currentMode === "swipe") {
      handleSwipeWheel({ deltaY: msg.deltaY, deltaX: msg.deltaX });
    } else if (currentMode === "flicker") {
      handleFlickerWheel({ deltaY: msg.deltaY, deltaX: msg.deltaX });
    } else if (currentMode === "overlay") {
      handleOverlayWheel({ deltaY: msg.deltaY, deltaX: msg.deltaX });
    }
    return;
  }

  if (msg.type === "VC_ACTION_PERFORMED") {
    const { paneId, action } = msg;
    if (!action) return;

    const sourceWindow = event.source;
    const active = getActiveFramesForMode(currentMode);

    // Drop messages from iframes that do not belong to the currently visible mode
    if (sourceWindow !== active.prod?.contentWindow &&
        sourceWindow !== active.stg?.contentWindow &&
        (!active.diff || sourceWindow !== active.diff.contentWindow) &&
        (!active.baseStg || sourceWindow !== active.baseStg.contentWindow)) {
      return;
    }

    // Track last known scroll position across all panes
    if (action.kind === "scroll") {
      const scrollSender = (active.diff && sourceWindow === active.diff.contentWindow) ? "DIFF" : paneId;
      // Prevent echo loop fighting between leader and follower pane
      if (activeScrollLeader && activeScrollLeader !== scrollSender && activeScrollLeader !== "WHEEL") {
        return;
      }
      if (activeScrollLeader !== "WHEEL") {
        activeScrollLeader = scrollSender;
        clearTimeout(scrollLeaderTimer);
        scrollLeaderTimer = setTimeout(() => {
          activeScrollLeader = null;
        }, 120);
      } else {
        activeScrollLeader = scrollSender;
      }

      const viewW = (currentMode === "swipe")
        ? (swipeContainer?.clientWidth || 1200)
        : (wrapFrameProd?.clientWidth || iframeProd?.clientWidth || 400);
      const effectiveMaxX = Number.isFinite(action.maxScrollX)
        ? Math.max(0, action.maxScrollX)
        : (typeof getEffectiveMaxScrollX === "function" ? getEffectiveMaxScrollX(viewW) : 0);
      const clampedScrollX = Math.max(0, Math.min(effectiveMaxX, action.scrollX || 0));

      lastScrollState = {
        scrollX: clampedScrollX,
        scrollY: action.scrollY || 0,
        maxScrollX: effectiveMaxX,
        maxScrollY: action.maxScrollY,
        pctX: effectiveMaxX > 0 ? (clampedScrollX / effectiveMaxX) : 0,
        pctY: action.pctY || 0
      };
      // Keep 3rd column scroll in sync
      if (iframeDiffBase && iframeDiffBase.contentWindow) {
        if (sourceWindow !== iframeDiffBase.contentWindow) {
          try {
            iframeDiffBase.contentWindow.postMessage({
              type: "VC_MIRROR_ACTION",
              action: { kind: "scroll", scrollY: lastScrollState.scrollY, scrollX: lastScrollState.scrollX, maxScrollY: action.maxScrollY, maxScrollX: action.maxScrollX, pctY: lastScrollState.pctY, pctX: lastScrollState.pctX }
            }, "*");
          } catch (e) {}
        }
      }
      // Keep swipe diff base frame in sync
      if (iframeSwipeDiff && iframeSwipeDiff.contentWindow) {
        if (sourceWindow !== iframeSwipeDiff.contentWindow) {
          try {
            iframeSwipeDiff.contentWindow.postMessage({
              type: "VC_MIRROR_ACTION",
              action: { kind: "scroll", scrollY: lastScrollState.scrollY, scrollX: lastScrollState.scrollX, maxScrollY: action.maxScrollY, maxScrollX: action.maxScrollX, pctY: lastScrollState.pctY, pctX: lastScrollState.pctX }
            }, "*");
          } catch (e) {}
        }
      }
      if (wrapFrameDiff) {
        wrapFrameDiff.scrollTop = lastScrollState.scrollY || 0;
        wrapFrameDiff.scrollLeft = lastScrollState.scrollX || 0;
      }
      triggerScrollDiffSync(lastScrollState.scrollY, lastScrollState.scrollX);
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

    // Forward action to target iframes based on active mode
    forwardActionToPane(targetPane, action, sourceWindow);
  }
});

function forwardActionToPane(targetPane, action, originWindow = null) {
  const message = { type: "VC_MIRROR_ACTION", action };

  // Function to safely dispatch to an iframe contentWindow
  const send = (iframe) => {
    if (iframe && iframe.contentWindow && (!originWindow || iframe.contentWindow !== originWindow)) {
      try {
        iframe.contentWindow.postMessage(message, "*");
      } catch (e) {}
    }
  };

  if (currentMode === "side-by-side") {
    send(targetPane === "PROD" ? iframeProd : iframeStg);
    if (targetPane === "STG" && iframeDiffBase) {
      send(iframeDiffBase);
    }
    if (originWindow && iframeDiffBase && originWindow === iframeDiffBase.contentWindow) {
      send(iframeStg);
    }
    if (originWindow && iframeStg && originWindow === iframeStg.contentWindow && iframeDiffBase) {
      send(iframeDiffBase);
    }
  } else if (currentMode === "swipe") {
    if (targetPane === "PROD") {
      send(iframeSwipeProd);
    } else {
      send(iframeSwipeStg);
    }
    send(iframeSwipeDiff);
    if (originWindow && iframeSwipeDiff && originWindow === iframeSwipeDiff.contentWindow) {
      send(iframeSwipeStg);
    }
  } else if (currentMode === "flicker") {
    send(targetPane === "PROD" ? iframeFlickerProd : iframeFlickerStg);
  } else if (currentMode === "overlay") {
    send(targetPane === "PROD" ? iframeOverlayProd : iframeOverlayStg);
  }
}
