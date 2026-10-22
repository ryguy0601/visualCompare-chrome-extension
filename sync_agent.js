/**
 * VisualCompare Live - In-Page Sync Agent
 * Injected into frames to track & mirror user interactions:
 * - Clicks & Dropdowns
 * - Scroll sync
 * - Ghost hover pointer
 * - Form input typing
 * - In-app link navigation
 */

(() => {
  // Prevent duplicate injection
  if (window.__VC_SYNC_AGENT_LOADED__) return;
  window.__VC_SYNC_AGENT_LOADED__ = true;

  // Check if we are inside a frame (VisualCompare Studio)
  const isFramed = window.self !== window.top;
  let paneId = null; // "PROD" or "STG"
  let isSyncing = false;
  let syncScrollTimeout = null;
  let lastMirroredClickTime = 0;
  let ghostCursor = null;
  let hasSentInitialLandmarks = false;
  let currentHoveredElements = [];
  let currentFocusedElement = null;

  // Enforce instant scroll sync by disabling sluggish smooth scroll animation
  function ensureScrollBehaviorOverride() {
    if (document.getElementById("vc-disable-smooth-scroll")) return;
    const style = document.createElement("style");
    style.id = "vc-disable-smooth-scroll";
    style.textContent = "html, body { scroll-behavior: auto !important; }";
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureScrollBehaviorOverride);
  } else {
    ensureScrollBehaviorOverride();
  }

  // Handshake with parent studio
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "VC_INIT_AGENT") {
      paneId = data.paneId;
      initGhostCursor();
      mirrorHoverAndFocusRules();
      initDimensionObserver();
      console.log(`[VisualCompare Live] Agent initialized for pane: ${paneId}`);
      // Notify parent that agent is ready
      if (window.parent) {
        window.parent.postMessage({ type: "VC_AGENT_READY", paneId, href: window.location.href }, "*");
      }
      if (!hasSentInitialLandmarks) {
        setTimeout(() => sendLandmarksReport(false), 200);
      }
    } else if (data.type === "VC_MIRROR_ACTION") {
      handleMirroredAction(data.action);
    } else if (data.type === "VC_REQUEST_LANDMARKS") {
      removeHazardSpacers();
      requestAnimationFrame(() => {
        sendLandmarksReport(true);
      });
    } else if (data.type === "VC_APPLY_HAZARD_SPACER") {
      applyHazardSpacer(data);
    } else if (data.type === "VC_REMOVE_HAZARD_SPACERS") {
      removeHazardSpacers();
    } else if (data.type === "VC_APPLY_RED_DIFFS") {
      applyRedDiffs(data.diffs);
    } else if (data.type === "VC_REMOVE_RED_DIFFS") {
      removeRedDiffs();
    } else if (data.type === "VC_REQUEST_DIFF_CANDIDATES") {
      sendDiffCandidatesReport();
    } else if (data.type === "VC_PREPARE_CAPTURE") {
      prepareForCapture();
    } else if (data.type === "VC_RESTORE_CAPTURE") {
      restoreAfterCapture();
    } else if (data.type === "VC_CAPTURE_SLICE_START") {
      hideFixedHeadersForSlice(data.sliceIndex > 0);
    }
  });

  let captureFreezeStyle = null;

  function hideFixedHeadersForSlice(hide) {
    document.querySelectorAll("*").forEach(el => {
      try {
        const style = window.getComputedStyle(el);
        const isFixed = style.position === "fixed" || (style.position === "sticky" && (style.top === "0px" || style.top === "0"));
        if (isFixed) {
          if (hide) {
            if (!el.dataset.vcOrigVis) {
              el.dataset.vcOrigVis = el.style.visibility || "visible";
            }
            el.style.setProperty("visibility", "hidden", "important");
          } else if (el.dataset.vcOrigVis !== undefined) {
            el.style.visibility = el.dataset.vcOrigVis === "visible" ? "" : el.dataset.vcOrigVis;
            delete el.dataset.vcOrigVis;
          }
        }
      } catch (e) {}
    });
  }

  async function prepareForCapture() {
    hideFixedHeadersForSlice(false);

    // 1. FREEZE_ANIMATIONS_JS & hide_overlays.css matching Python browser.py
    if (!captureFreezeStyle) {
      captureFreezeStyle = document.createElement("style");
      captureFreezeStyle.id = "vc-capture-freeze";
      captureFreezeStyle.textContent = `
        html, body {
          scroll-behavior: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: none !important;
        }
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
        }
        video, audio { opacity: 0 !important; visibility: hidden !important; }
        ::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }
      `;
      (document.head || document.documentElement).appendChild(captureFreezeStyle);
    }

    // 2. PAUSE_CAROUSELS_JS matching Python visualCompare browser.py
    document.querySelectorAll(".carousel").forEach((el) => {
      try {
        if (window.bootstrap && window.bootstrap.Carousel) {
          const c = window.bootstrap.Carousel.getOrCreateInstance(el);
          c.pause();
          if (typeof c.to === "function") c.to(0);
        } else if (window.jQuery && window.jQuery.fn && window.jQuery.fn.carousel) {
          window.jQuery(el).carousel("pause");
          if (typeof window.jQuery(el).carousel === "function") window.jQuery(el).carousel(0);
        }
      } catch (e) {}
    });

    // 3. HIDE_FLOATING_JS matching Python browser.py (hides sticky banners, floating trays, ISI overlays)
    const isiToken = /(^|[-_])isi($|[-_])/;
    document.querySelectorAll("*").forEach((el) => {
      try {
        const style = window.getComputedStyle(el);
        if (style.position !== "fixed" && style.position !== "sticky") return;
        const cls = (el.getAttribute("class") || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const tag = el.tagName.toLowerCase();
        if (tag === "footer" || cls.includes("footer") || id.includes("footer")) return;
        const tokens = cls.split(/\s+/).filter(Boolean);
        const hit = tokens.some(t => isiToken.test(t)) || isiToken.test(id)
                    || cls.includes("sticky-banner") || cls.includes("floating-tray");
        if (hit) {
          if (!el.dataset.vcOrigDisp) el.dataset.vcOrigDisp = el.style.display || "";
          el.style.setProperty("display", "none", "important");
        }
      } catch (e) {}
    });

    // 4. Await document fonts ready
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }

    // 5. Await image decoding
    try {
      await Promise.all(
        Array.from(document.images).map(img => {
          if (img.complete) return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
          return new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 1500); });
        })
      );
    } catch (e) {}

    // 6. Hard-clamp scroll to absolute origin (0, 0)
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    // 7. Measure exact stable document height and report back
    const docH = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement ? document.documentElement.scrollHeight : 0,
      document.body ? document.body.offsetHeight : 0,
      document.documentElement ? document.documentElement.offsetHeight : 0
    );

    if (window.parent && isFramed) {
      window.parent.postMessage({
        type: "VC_CAPTURE_READY",
        paneId,
        docHeight: docH,
        docWidth: Math.max(
          document.body ? document.body.scrollWidth : 0,
          document.documentElement ? document.documentElement.scrollWidth : 0
        )
      }, "*");
    }
  }

  function restoreAfterCapture() {
    hideFixedHeadersForSlice(false);
    if (captureFreezeStyle) {
      captureFreezeStyle.remove();
      captureFreezeStyle = null;
    }
    // Restore hidden floating trays
    document.querySelectorAll("[data-vc-orig-disp]").forEach(el => {
      el.style.display = el.dataset.vcOrigDisp;
      delete el.dataset.vcOrigDisp;
    });
  }

  // If in frame, notify parent immediately in case parent is waiting
  if (isFramed && window.parent) {
    window.parent.postMessage({ type: "VC_FRAME_PING", href: window.location.href }, "*");

    // Intercept client-side route changes (pushState, replaceState, hashchange)
    const origPushState = history.pushState;
    if (typeof origPushState === "function") {
      history.pushState = function(...args) {
        origPushState.apply(this, args);
        if (paneId) {
          window.parent.postMessage({ type: "VC_AGENT_READY", paneId, href: window.location.href }, "*");
        }
      };
    }
    const origReplaceState = history.replaceState;
    if (typeof origReplaceState === "function") {
      history.replaceState = function(...args) {
        origReplaceState.apply(this, args);
        if (paneId) {
          window.parent.postMessage({ type: "VC_AGENT_READY", paneId, href: window.location.href }, "*");
        }
      };
    }
    window.addEventListener("hashchange", () => {
      if (paneId) {
        window.parent.postMessage({ type: "VC_AGENT_READY", paneId, href: window.location.href }, "*");
      }
    });
  }

  // ----------------------------------------------------
  // HOVER & FOCUS PSEUDO-STATE MIRROR STYLES
  // ----------------------------------------------------
  function mirrorHoverAndFocusRules() {
    try {
      if (document.getElementById("vc-pseudo-mirror-styles")) return;

      const rulesToAdd = [];

      function processRules(ruleList) {
        for (const rule of ruleList) {
          try {
            if (rule.cssRules && rule.cssRules.length > 0) {
              processRules(rule.cssRules);
              continue;
            }
            if (!rule.selectorText || !rule.style || !rule.style.cssText) continue;

            // Skip rules that already contain our mirrored pseudo-classes
            if (rule.selectorText.includes(".vc-hovered-pseudo") || rule.selectorText.includes(".vc-focused-pseudo")) {
              continue;
            }

            if (rule.selectorText.includes(":hover")) {
              const parts = rule.selectorText.split(",");
              const clonedParts = parts
                .filter(p => p.includes(":hover"))
                .map(p => p.trim().replace(/:hover/g, ".vc-hovered-pseudo"));
              if (clonedParts.length > 0) {
                rulesToAdd.push(`${clonedParts.join(", ")} { ${rule.style.cssText} }`);
              }
            }

            if (rule.selectorText.includes(":focus") || rule.selectorText.includes(":focus-visible")) {
              const parts = rule.selectorText.split(",");
              const clonedParts = parts
                .filter(p => p.includes(":focus") || p.includes(":focus-visible"))
                .map(p => p.trim().replace(/:focus-visible/g, ".vc-focused-pseudo").replace(/:focus/g, ".vc-focused-pseudo"));
              if (clonedParts.length > 0) {
                rulesToAdd.push(`${clonedParts.join(", ")} { ${rule.style.cssText} }`);
              }
            }
          } catch (e) {
            // Ignore browser-specific unsupported pseudo selectors
          }
        }
      }

      // Clone site's own :hover and :focus rules onto .vc-hovered-pseudo and .vc-focused-pseudo
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules || sheet.rules;
        } catch (e) {
          continue; // Cross-origin stylesheets
        }
        if (!rules) continue;
        processRules(rules);
      }

      if (rulesToAdd.length > 0) {
        const styleEl = document.createElement("style");
        styleEl.id = "vc-pseudo-mirror-styles";
        styleEl.textContent = rulesToAdd.join("\n");
        document.head.appendChild(styleEl);
      }
    } catch (err) {
      console.warn("[VisualCompare Live] Error preparing pseudo-state mirror styles:", err);
    }
  }

  // ----------------------------------------------------
  // GHOST POINTER (Fake mouse cursor on counterpart pane)
  // ----------------------------------------------------
  function initGhostCursor() {
    if (ghostCursor || !document.body) return;
    ghostCursor = document.createElement("div");
    ghostCursor.id = "vc-ghost-pointer";
    ghostCursor.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
        <path d="M4 2L20 10.5L12 12.5L9.5 20.5L4 2Z" fill="#38bdf8" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
    ghostCursor.style.cssText = `
      position: fixed;
      left: 0;
      top: 0;
      width: 22px;
      height: 22px;
      pointer-events: none;
      z-index: 2147483647;
      transition: opacity 0.15s ease;
      display: none;
      opacity: 0;
    `;
    document.body.appendChild(ghostCursor);
  }

  function clearHoveredElements() {
    if (!currentHoveredElements || currentHoveredElements.length === 0) return;
    for (const el of currentHoveredElements) {
      if (!el || !el.classList) continue;
      el.classList.remove("vc-hovered-pseudo");
      const leaveEvt = new MouseEvent("mouseleave", { bubbles: false, cancelable: true, view: window });
      leaveEvt.__vc_synthetic = true;
      el.dispatchEvent(leaveEvt);
      const outEvt = new MouseEvent("mouseout", { bubbles: true, cancelable: true, view: window });
      outEvt.__vc_synthetic = true;
      el.dispatchEvent(outEvt);
    }
    currentHoveredElements = [];
  }

  function setHoveredElement(targetEl) {
    if (!targetEl || targetEl === document.body || targetEl === document.documentElement) {
      clearHoveredElements();
      return;
    }

    const newHovered = [];
    let curr = targetEl;
    while (curr && curr !== document.body && curr !== document.documentElement && curr.nodeType === Node.ELEMENT_NODE) {
      newHovered.push(curr);
      curr = curr.parentElement;
    }

    // Un-hover elements that are no longer hovered
    for (const el of currentHoveredElements) {
      if (!newHovered.includes(el) && el && el.classList) {
        el.classList.remove("vc-hovered-pseudo");
        const leaveEvt = new MouseEvent("mouseleave", { bubbles: false, cancelable: true, view: window });
        leaveEvt.__vc_synthetic = true;
        el.dispatchEvent(leaveEvt);
        const outEvt = new MouseEvent("mouseout", { bubbles: true, cancelable: true, view: window });
        outEvt.__vc_synthetic = true;
        el.dispatchEvent(outEvt);
      }
    }

    // Hover elements that are newly hovered (outermost ancestor to target)
    const elementsToHover = [...newHovered].reverse();
    for (const el of elementsToHover) {
      if (!currentHoveredElements.includes(el) && el && el.classList) {
        el.classList.add("vc-hovered-pseudo");
        const enterEvt = new MouseEvent("mouseenter", { bubbles: false, cancelable: true, view: window });
        enterEvt.__vc_synthetic = true;
        el.dispatchEvent(enterEvt);
        const overEvt = new MouseEvent("mouseover", { bubbles: true, cancelable: true, view: window });
        overEvt.__vc_synthetic = true;
        el.dispatchEvent(overEvt);
      }
      if (el === targetEl) {
        const moveEvt = new MouseEvent("mousemove", { bubbles: true, cancelable: true, view: window });
        moveEvt.__vc_synthetic = true;
        el.dispatchEvent(moveEvt);
      }
    }

    currentHoveredElements = newHovered;
  }

  // Visual ripple on mirrored click
  function showClickRipple(x, y) {
    if (!document.getElementById("vc-ripple-styles")) {
      const style = document.createElement("style");
      style.id = "vc-ripple-styles";
      style.textContent = `
        @keyframes vc-ripple-anim {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const ripple = document.createElement("div");
    ripple.className = "vc-click-ripple";
    ripple.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: transparent;
      border: 3px solid #f43f5e;
      box-shadow: 0 0 12px #f43f5e;
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-50%, -50%) scale(1);
      animation: vc-ripple-anim 0.5s ease-out forwards;
    `;

    (document.body || document.documentElement).appendChild(ripple);
    setTimeout(() => {
      try { ripple.remove(); } catch (e) {}
    }, 550);
  }

  // Resolve topmost element at specified viewport coordinates (pure X/Y basis relative to visible viewport)
  function getViewportElementAt(x, y) {
    let el = null;
    if (typeof document.elementsFromPoint === "function") {
      const list = document.elementsFromPoint(x, y);
      for (const item of list) {
        if (!item) continue;
        if (item === ghostCursor || (ghostCursor && ghostCursor.contains(item))) continue;
        if (item.classList && item.classList.contains("vc-click-ripple")) continue;
        if (item.classList && (item.classList.contains("vc-hazard-badge") || item.classList.contains("vc-hazard-close"))) continue;
        el = item;
        break;
      }
    }
    if (!el && typeof document.elementFromPoint === "function") {
      const atPoint = document.elementFromPoint(x, y);
      if (atPoint && atPoint !== ghostCursor && (!ghostCursor || !ghostCursor.contains(atPoint))) {
        el = atPoint;
      }
    }

    // Pierce open shadow roots if any
    while (el && el.shadowRoot && typeof el.shadowRoot.elementFromPoint === "function") {
      const shadowEl = el.shadowRoot.elementFromPoint(x, y);
      if (!shadowEl || shadowEl === el) break;
      el = shadowEl;
    }

    // If point resolved directly to html or body, probe adjacent ±2px and ±4px boundary offsets
    // to catch any interactive button, link, or tab near the pixel boundary
    if (!el || el === document.body || el === document.documentElement) {
      const probes = [
        { dx: 0, dy: -2 }, { dx: 0, dy: 2 }, { dx: -2, dy: 0 }, { dx: 2, dy: 0 },
        { dx: 0, dy: -4 }, { dx: 0, dy: 4 }, { dx: -4, dy: 0 }, { dx: 4, dy: 0 }
      ];
      for (const { dx, dy } of probes) {
        const px = Math.max(0, Math.min(window.innerWidth - 1, x + dx));
        const py = Math.max(0, Math.min(window.innerHeight - 1, y + dy));
        const cand = document.elementFromPoint(px, py);
        if (cand && cand !== document.body && cand !== document.documentElement && cand !== ghostCursor) {
          const interactive = cand.closest ? cand.closest("button, a, input, select, textarea, [role='button'], summary, label") : null;
          if (interactive) {
            el = cand;
            break;
          }
        }
      }
    }

    return el || document.body;
  }

  // ----------------------------------------------------
  // SELECTOR & DOM UTILS
  // ----------------------------------------------------
  function getElementSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
    if (el.id && !el.id.match(/\d{4,}/) && !el.id.includes(":")) {
      return `#${CSS.escape(el.id)}`;
    }

    // Role or data-testid or name
    if (el.getAttribute("data-testid")) {
      return `[data-testid="${CSS.escape(el.getAttribute("data-testid"))}"]`;
    }
    if (el.getAttribute("aria-label")) {
      return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(el.getAttribute("aria-label"))}"]`;
    }
    if (el.name && (el.tagName === "INPUT" || el.tagName === "BUTTON" || el.tagName === "SELECT")) {
      return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
    }
    if (el.tagName === "A" && el.getAttribute("href")) {
      const href = el.getAttribute("href");
      const isNavTab = el.classList && (el.classList.contains("nav-tab") || el.classList.contains("btn-nav"));
      const isEnvSpecific = /([_-])(?:prod|stg)\b|\b(?:prod|stg)([_-])|(?:prod|stg)\.html/i.test(href);
      if (!href.startsWith("javascript:") && !isNavTab && !isEnvSpecific && !el.closest("nav")) {
        return `a[href="${CSS.escape(href)}"]`;
      }
    }

    // Filter out modifier/state/pseudo/regression classes that differ between environments
    const ignoredClasses = /^(vc-|hover|active|focus|selected|current|open|highlight|warning|danger|success|error|info|disabled)/i;

    // Tag + meaningful base classes
    let sel = el.tagName.toLowerCase();
    if (el.classList && el.classList.length > 0) {
      const classes = Array.from(el.classList)
        .filter(c => !ignoredClasses.test(c) && c.length < 30);
      if (classes.length > 0) {
        sel += "." + classes.slice(0, 2).map(c => CSS.escape(c)).join(".");
      }
    }

    // Sibling disambiguation: if there are siblings with the same tag in parent, add nth-of-type
    if (el.parentElement) {
      const sameTagSiblings = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName);
      if (sameTagSiblings.length > 1) {
        const idx = sameTagSiblings.indexOf(el) + 1;
        sel += `:nth-of-type(${idx})`;
      }
    }

    // Climb up to 3 levels for hierarchy with parent sibling disambiguation
    let parent = el.parentElement;
    let path = [sel];
    let count = 0;
    while (parent && parent !== document.body && count < 3) {
      if (parent.id && !parent.id.match(/\d{4,}/) && !parent.id.includes(":")) {
        path.unshift(`#${CSS.escape(parent.id)}`);
        break;
      }
      let pSel = parent.tagName.toLowerCase();
      if (parent.classList && parent.classList.length > 0) {
        const pClasses = Array.from(parent.classList)
          .filter(c => !ignoredClasses.test(c) && c.length < 30);
        if (pClasses.length > 0) {
          pSel += "." + CSS.escape(pClasses[0]);
        }
      }
      // CRITICAL: Disambiguate parent among siblings of the same tag so sibling containers never collide!
      if (parent.parentElement) {
        const sameTagParentSiblings = Array.from(parent.parentElement.children).filter(c => c.tagName === parent.tagName);
        if (sameTagParentSiblings.length > 1) {
          const pIdx = sameTagParentSiblings.indexOf(parent) + 1;
          pSel += `:nth-of-type(${pIdx})`;
        }
      }
      path.unshift(pSel);
      parent = parent.parentElement;
      count++;
    }

    return path.join(" > ");
  }

  function findMatchingElement(action) {
    if (!action) return null;

    // 1. Link matching by href (most unambiguous for navigation/anchors)
    if (action.href) {
      try {
        let link = document.querySelector(`a[href="${CSS.escape(action.href)}"]`);
        if (link) return link;

        // Counterpart environment filename translation (_prod <-> _stg)
        const counterpartHref = paneId === "STG"
          ? action.href.replace(/([_-])prod\b/gi, '$1stg').replace(/\bprod([_-])/gi, 'stg$1')
          : action.href.replace(/([_-])stg\b/gi, '$1prod').replace(/\bstg([_-])/gi, 'prod$1');

        if (counterpartHref && counterpartHref !== action.href) {
          link = document.querySelector(`a[href="${CSS.escape(counterpartHref)}"]`);
          if (link) return link;
          link = document.querySelector(`a[href$="${CSS.escape(counterpartHref)}"]`);
          if (link) return link;
        }

        const urlObj = new URL(action.href, window.location.href);
        const link2 = document.querySelector(`a[href="${CSS.escape(urlObj.pathname)}"], a[href="${CSS.escape(urlObj.hash)}"]`);
        if (link2) return link2;
      } catch (err) {}
    }

    // 2. Text-content matching for buttons, tabs, links, labels
    if (action.text && action.text.length >= 2 && action.text.length < 50) {
      const cleanText = action.text.trim().toLowerCase();
      const candidates = document.querySelectorAll("a, button, [role='button'], [role='tab'], label, summary, .btn");
      for (const cand of candidates) {
        if (cand.textContent && cand.textContent.trim().toLowerCase() === cleanText) {
          return cand;
        }
      }
    }

    // 3. Try precise selector
    if (action.selector) {
      try {
        const found = document.querySelector(action.selector);
        if (found) {
          // If action has text, verify that found element doesn't contradict text
          if (!action.text || !found.textContent || found.textContent.trim().toLowerCase().includes(action.text.trim().toLowerCase())) {
            return found;
          }
        }
      } catch (err) {}
    }

    // 4. Input matching by name/type
    if (action.tagName === "INPUT" || action.tagName === "TEXTAREA" || action.tagName === "SELECT") {
      if (action.name) {
        const input = document.querySelector(`[name="${CSS.escape(action.name)}"]`);
        if (input) return input;
      }
    }

    // 5. Fallback to coordinate point
    if (action.pctX !== undefined && action.pctY !== undefined) {
      const targetX = Math.round(action.pctX * window.innerWidth);
      const targetY = Math.round(action.pctY * window.innerHeight);
      const atPoint = document.elementFromPoint(targetX, targetY);
      if (atPoint && atPoint !== ghostCursor && (!ghostCursor || !ghostCursor.contains(atPoint))) return atPoint;
    }

    return null;
  }

  // ----------------------------------------------------
  // EVENT LISTENERS (OUTGOING ACTIONS)
  // ----------------------------------------------------
  if (isFramed) {
    // 1. CLICK TRACKING (Viewport X/Y coordinates)
    document.addEventListener("click", (e) => {
      if (isSyncing || e.__vc_synthetic || (Date.now() - lastMirroredClickTime < 150)) return;
      if (e.button !== undefined && e.button !== 0) return;

      const target = e.target;
      if (!target || target === ghostCursor || (target.classList && target.classList.contains("vc-click-ripple"))) return;

      const rect = target.getBoundingClientRect();
      const pctX = e.clientX / window.innerWidth;
      const pctY = e.clientY / window.innerHeight;
      const selector = getElementSelector(target);
      const text = (target.textContent || "").trim().slice(0, 50);
      const href = target.getAttribute("href") || (target.closest("a") ? target.closest("a").getAttribute("href") : "");

      // Send to studio parent with explicit viewport dimensions and coordinates
      window.parent.postMessage({
        type: "VC_ACTION_PERFORMED",
        paneId,
        action: {
          kind: "click",
          selector,
          tagName: target.tagName,
          text,
          href,
          name: target.getAttribute("name") || "",
          pctX,
          pctY,
          clientX: e.clientX,
          clientY: e.clientY,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        }
      }, "*");
    }, true);

    // 2. MOUSE HOVER TRACKING (Throttled)
    let lastHoverTime = 0;
    document.addEventListener("mousemove", (e) => {
      if (isSyncing) return;
      const now = performance.now();
      if (now - lastHoverTime < 35) return; // ~30 FPS
      lastHoverTime = now;

      const pctX = e.clientX / window.innerWidth;
      const pctY = e.clientY / window.innerHeight;
      const target = e.target;
      const selector = (target && target !== ghostCursor && target !== document.body && target !== document.documentElement) ? getElementSelector(target) : "";
      const tagName = target ? target.tagName : "";
      const text = (target && target.textContent) ? target.textContent.trim().slice(0, 50) : "";
      const href = target ? (target.getAttribute("href") || (target.closest("a") ? target.closest("a").getAttribute("href") : "")) : "";

      if (window.parent) {
        window.parent.postMessage({
          type: "VC_ACTION_PERFORMED",
          paneId,
          action: {
            kind: "hover",
            pctX,
            pctY,
            selector,
            tagName,
            text,
            href
          }
        }, "*");
      }
    }, true);

    // 3. SCROLL TRACKING
    let scrollTimeout = null;

    window.addEventListener("scroll", () => {
      if (isSyncing) return;

      if (!scrollTimeout) {
        scrollTimeout = requestAnimationFrame(() => {
          scrollTimeout = null;
          if (isSyncing) return;

          const maxScrollY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          const maxScrollX = Math.max(1, document.documentElement.scrollWidth - window.innerWidth);
          const pctY = window.scrollY / maxScrollY;
          const pctX = window.scrollX / maxScrollX;

          if (window.parent) {
            window.parent.postMessage({
              type: "VC_ACTION_PERFORMED",
              paneId,
              action: {
                kind: "scroll",
                scrollY: window.scrollY,
                scrollX: window.scrollX,
                maxScrollY,
                maxScrollX,
                pctY,
                pctX
              }
            }, "*");
          }
        });
      }
    }, { passive: true });

    // 3b. SYNCHRONIZED WHEEL SCROLLING (Instant smooth lockstep scroll across all panes)
    window.addEventListener("wheel", (e) => {
      if (window.parent) {
        window.parent.postMessage({
          type: "VC_WHEEL_SCROLL",
          paneId,
          deltaY: e.deltaY,
          deltaX: e.deltaX
        }, "*");
      }
    }, { passive: true });

    // 4. FORM INPUT TRACKING
    document.addEventListener("input", (e) => {
      if (isSyncing || e.__vc_synthetic) return;
      const target = e.target;
      if (!target || !("value" in target)) return;

      if (window.parent) {
        window.parent.postMessage({
          type: "VC_ACTION_PERFORMED",
          paneId,
          action: {
            kind: "input",
            selector: getElementSelector(target),
            name: target.name || "",
            value: target.value,
            checked: target.checked,
            tagName: target.tagName
          }
        }, "*");
      }
    }, true);

    // 5. FOCUS & BLUR TRACKING
    document.addEventListener("focusin", (e) => {
      if (isSyncing || e.__vc_synthetic) return;
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;

      if (window.parent) {
        window.parent.postMessage({
          type: "VC_ACTION_PERFORMED",
          paneId,
          action: {
            kind: "focus",
            selector: getElementSelector(target),
            tagName: target.tagName,
            name: target.getAttribute("name") || "",
            text: (target.textContent || "").trim().slice(0, 50),
            href: target.getAttribute("href") || ""
          }
        }, "*");
      }
    }, true);

    document.addEventListener("focusout", (e) => {
      if (isSyncing || e.__vc_synthetic) return;
      const target = e.target;
      if (!target || target === document.body || target === document.documentElement) return;

      if (window.parent) {
        window.parent.postMessage({
          type: "VC_ACTION_PERFORMED",
          paneId,
          action: {
            kind: "blur",
            selector: getElementSelector(target),
            tagName: target.tagName
          }
        }, "*");
      }
    }, true);
  }

  // ----------------------------------------------------
  // ACTION EXECUTION (INCOMING MIRRORED ACTIONS)
  // ----------------------------------------------------
  function handleMirroredAction(action) {
    if (!action || !action.kind) return;
    isSyncing = true;

    try {
      if (action.kind === "click") {
        lastMirroredClickTime = Date.now();

        // 1. Calculate viewport coordinates (X/Y basis relative to visible viewport)
        let clickX;
        let clickY;

        if (action.clientX !== undefined && action.viewportWidth && Math.abs(window.innerWidth - action.viewportWidth) < 2) {
          clickX = action.clientX;
        } else if (action.pctX !== undefined) {
          clickX = Math.round(action.pctX * window.innerWidth);
        } else {
          clickX = action.clientX !== undefined ? action.clientX : 100;
        }

        if (action.clientY !== undefined && action.viewportHeight && Math.abs(window.innerHeight - action.viewportHeight) < 2) {
          clickY = action.clientY;
        } else if (action.pctY !== undefined) {
          clickY = Math.round(action.pctY * window.innerHeight);
        } else {
          clickY = action.clientY !== undefined ? action.clientY : 100;
        }

        // Clamp inside current window viewport boundaries
        clickX = Math.max(0, Math.min(window.innerWidth - 1, clickX));
        clickY = Math.max(0, Math.min(window.innerHeight - 1, clickY));

        // 2. Locate topmost element directly at viewport (X, Y) - NOT on class or ID basis!
        const el = getViewportElementAt(clickX, clickY);

        if (!ghostCursor) initGhostCursor();
        if (ghostCursor) {
          ghostCursor.style.display = "block";
          ghostCursor.style.opacity = "1";
          ghostCursor.style.left = `${clickX - 4}px`;
          ghostCursor.style.top = `${clickY - 2}px`;
        }
        showClickRipple(clickX, clickY);

        if (el) {
          // Identify closest interactive element if clicked inside a child node (e.g. span/svg inside button or link)
          const interactiveEl = (el.closest)
            ? (el.closest("a, button, input, select, textarea, [role='button'], summary, label") || el)
            : el;

          // Focus target element
          const focusTarget = (interactiveEl && typeof interactiveEl.focus === "function")
            ? interactiveEl
            : (typeof el.focus === "function" ? el : null);
          if (focusTarget && focusTarget !== document.body && focusTarget !== document.documentElement) {
            try {
              focusTarget.focus({ preventScroll: true });
            } catch (e) {
              try { focusTarget.focus(); } catch (err) {}
            }
          }

          // If element is a details or dropdown toggle
          if (el.tagName === "DETAILS") {
            el.open = !el.open;
          } else if (interactiveEl && interactiveEl.tagName === "SUMMARY" && interactiveEl.parentElement && interactiveEl.parentElement.tagName === "DETAILS") {
            interactiveEl.parentElement.open = !interactiveEl.parentElement.open;
          }

          // Synthesize full pointer and mouse event chain with exact viewport clientX and clientY
          const evtOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clickX,
            clientY: clickY,
            screenX: clickX,
            screenY: clickY,
            button: 0,
            buttons: 1
          };

          if (typeof window.PointerEvent === "function") {
            try {
              const pDown = new PointerEvent("pointerdown", evtOptions);
              pDown.__vc_synthetic = true;
              el.dispatchEvent(pDown);
            } catch (e) {}
          }

          const downEvt = new MouseEvent("mousedown", evtOptions);
          downEvt.__vc_synthetic = true;
          el.dispatchEvent(downEvt);

          if (typeof window.PointerEvent === "function") {
            try {
              const pUp = new PointerEvent("pointerup", { ...evtOptions, buttons: 0 });
              pUp.__vc_synthetic = true;
              el.dispatchEvent(pUp);
            } catch (e) {}
          }

          const upEvt = new MouseEvent("mouseup", { ...evtOptions, buttons: 0 });
          upEvt.__vc_synthetic = true;
          el.dispatchEvent(upEvt);

          const clickEvt = new MouseEvent("click", { ...evtOptions, buttons: 0 });
          clickEvt.__vc_synthetic = true;
          el.dispatchEvent(clickEvt);

          // If interactive element has native .click() (e.g. buttons, checkboxes, inputs, tabs), trigger it
          const link = (el.tagName === "A") ? el : (el.closest ? el.closest("a") : null);
          if (interactiveEl && typeof interactiveEl.click === "function") {
            if (interactiveEl !== link || interactiveEl.hasAttribute("data-page") || (interactiveEl.closest && interactiveEl.closest("[data-page]"))) {
              try {
                interactiveEl.click();
              } catch (e) {}
            }
          }

          // If it's a normal navigation link without in-page routing, navigate
          if (link && !clickEvt.defaultPrevented && !link.hasAttribute("data-page") && (!link.closest || !link.closest("[data-page]"))) {
            if (link.href && !link.href.startsWith("javascript:void") && !link.href.startsWith("javascript:;")) {
              if (link.hash && link.origin === window.location.origin && link.pathname === window.location.pathname) {
                window.location.hash = link.hash;
              } else if (link.target !== "_blank") {
                window.location.href = link.href;
              }
            }
          }
        } else if (action.href) {
          // Fallback if coordinate point yielded nothing and counterpart route is known
          try {
            const destHref = paneId === "STG"
              ? action.href.replace(/([_-])prod\b/gi, '$1stg').replace(/\bprod([_-])/gi, 'stg$1')
              : action.href.replace(/([_-])stg\b/gi, '$1prod').replace(/\bstg([_-])/gi, 'prod$1');
            window.location.href = destHref;
          } catch (e) {}
        }
      } else if (action.kind === "hover") {
        if (!ghostCursor) initGhostCursor();
        let x = (action.clientX !== undefined && action.viewportWidth && Math.abs(window.innerWidth - action.viewportWidth) < 2)
          ? action.clientX
          : (action.pctX !== undefined ? Math.round(action.pctX * window.innerWidth) : (action.clientX || 0));
        let y = (action.clientY !== undefined && action.viewportHeight && Math.abs(window.innerHeight - action.viewportHeight) < 2)
          ? action.clientY
          : (action.pctY !== undefined ? Math.round(action.pctY * window.innerHeight) : (action.clientY || 0));

        x = Math.max(0, Math.min(window.innerWidth - 1, x));
        y = Math.max(0, Math.min(window.innerHeight - 1, y));

        if (ghostCursor) {
          ghostCursor.style.display = "block";
          ghostCursor.style.opacity = "1";
          ghostCursor.style.left = `${x - 4}px`;
          ghostCursor.style.top = `${y - 2}px`;
        }

        // Mirror authentic :hover state onto element at viewport (x, y)
        const hoveredEl = getViewportElementAt(x, y) || findMatchingElement(action);
        setHoveredElement(hoveredEl);
      } else if (action.kind === "hover_leave") {
        if (ghostCursor) {
          ghostCursor.style.opacity = "0";
        }
        clearHoveredElements();
      } else if (action.kind === "focus") {
        let el = null;
        if (action.clientX !== undefined && action.clientY !== undefined) {
          const atPoint = getViewportElementAt(action.clientX, action.clientY);
          if (atPoint && atPoint.closest) {
            el = atPoint.closest("input, textarea, select, button, a, [tabindex]") || atPoint;
          }
        }
        if (!el) {
          el = findMatchingElement(action);
        }
        if (el) {
          if (currentFocusedElement && currentFocusedElement !== el) {
            currentFocusedElement.classList.remove("vc-focused-pseudo");
          }
          currentFocusedElement = el;
          el.classList.add("vc-focused-pseudo");
          if (typeof el.focus === "function") {
            try {
              el.focus({ preventScroll: true });
            } catch (e) {}
          }
          const focusEvt = new FocusEvent("focus", { bubbles: false, cancelable: false, view: window });
          focusEvt.__vc_synthetic = true;
          el.dispatchEvent(focusEvt);
          const inEvt = new FocusEvent("focusin", { bubbles: true, cancelable: false, view: window });
          inEvt.__vc_synthetic = true;
          el.dispatchEvent(inEvt);
        }
      } else if (action.kind === "blur") {
        if (currentFocusedElement) {
          currentFocusedElement.classList.remove("vc-focused-pseudo");
          if (typeof currentFocusedElement.blur === "function") {
            try {
              currentFocusedElement.blur();
            } catch (e) {}
          }
          const blurEvt = new FocusEvent("blur", { bubbles: false, cancelable: false, view: window });
          blurEvt.__vc_synthetic = true;
          currentFocusedElement.dispatchEvent(blurEvt);
          const outEvt = new FocusEvent("focusout", { bubbles: true, cancelable: false, view: window });
          outEvt.__vc_synthetic = true;
          currentFocusedElement.dispatchEvent(outEvt);
          currentFocusedElement = null;
        }
      } else if (action.kind === "scroll") {
        clearTimeout(syncScrollTimeout);
        isSyncing = true;

        const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const maxScrollX = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);

        let targetY;
        if (action.scrollY === 0) {
          targetY = 0;
        } else if (action.pctY !== undefined && action.maxScrollY !== undefined && Math.abs(maxScrollY - action.maxScrollY) > 30) {
          targetY = Math.min(maxScrollY, Math.max(0, Math.round(action.pctY * maxScrollY)));
        } else {
          targetY = (action.scrollY !== undefined) ? Math.min(maxScrollY, Math.max(0, action.scrollY)) : Math.round((action.pctY || 0) * maxScrollY);
        }

        const targetX = (action.scrollX !== undefined) ? Math.min(maxScrollX, Math.max(0, action.scrollX)) : 0;

        window.scrollTo({
          top: targetY,
          left: targetX,
          behavior: "auto"
        });

        requestAnimationFrame(() => {
          isSyncing = false;
        });
        syncScrollTimeout = setTimeout(() => {
          isSyncing = false;
        }, 40);
      } else if (action.kind === "input") {
        let el = currentFocusedElement;
        if (!el || !("value" in el)) {
          if (action.clientX !== undefined && action.clientY !== undefined) {
            const atPoint = getViewportElementAt(action.clientX, action.clientY);
            if (atPoint && ("value" in atPoint)) el = atPoint;
          }
        }
        if (!el || !("value" in el)) {
          el = findMatchingElement(action);
        }
        if (el && ("value" in el)) {
          el.value = action.value;
          if (action.checked !== undefined) el.checked = action.checked;
          const inputEvt = new Event("input", { bubbles: true });
          inputEvt.__vc_synthetic = true;
          el.dispatchEvent(inputEvt);

          const changeEvt = new Event("change", { bubbles: true });
          changeEvt.__vc_synthetic = true;
          el.dispatchEvent(changeEvt);
        }
      }
    } catch (err) {
      console.warn("[VisualCompare Live] Error handling mirrored action:", err);
    } finally {
      // Release sync lock for non-scroll actions
      if (action.kind !== "scroll") {
        setTimeout(() => {
          isSyncing = false;
        }, 50);
      }
    }
  }

  // Notify when mouse leaves window to clear mirrored hover state and hide fake mouse
  document.addEventListener("mouseleave", () => {
    if (ghostCursor) {
      ghostCursor.style.opacity = "0";
    }
    if (isFramed) {
      window.parent.postMessage({
        type: "VC_ACTION_PERFORMED",
        paneId,
        action: { kind: "hover_leave" }
      }, "*");
    }
  });

  // ----------------------------------------------------
  // DOM LANDMARK EXTRACTION & LAYOUT SHIFT HAZARD SPACERS
  // (Ported from VisualCompare Python Engine: dom_extractor.js & diff_engine.py)
  // ----------------------------------------------------
  const LANDMARK_SELECTORS = [
    '[data-rendering-id]',
    '[data-component]',
    'header',
    'nav',
    'footer',
    'main',
    'section',
    'article',
    '.card',
    '.component',
    '.list-group-item',
    '.alert',
    'main > div',
    '#maincontent > div',
    '.container > div',
    'h1, h2, h3'
  ].join(',');

  function isDynamicId(id) {
    if (!id) return true;
    if (/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(id)) return false;
    return /^(react-|ember-|ext-|ng-|_ngcontent|headlessui-)/i.test(id) || /\d{5,}/.test(id);
  }

  const infoMap = new Map();
  function getInfo(el) {
    let i = infoMap.get(el);
    if (i) return i;
    const rect = el.getBoundingClientRect();
    const renderingId = el.getAttribute('data-rendering-id') || el.getAttribute('data-component') || '';
    const rawId = (el.id || '').trim();
    const id = rawId && !isDynamicId(rawId) ? rawId : '';
    const headingEl = el.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
    const heading = headingEl ? (headingEl.innerText || headingEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    const score = renderingId ? 4 : (id ? 3 : (heading ? 2 : 1));
    i = { rect, renderingId, id, heading, score };
    infoMap.set(el, i);
    return i;
  }

  function extractLandmarks() {
    infoMap.clear();
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);

    const candidates = [];
    document.querySelectorAll(LANDMARK_SELECTORS).forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      if (el.classList.contains('vc-hazard-stripe-spacer') || el.id === 'vc-ghost-pointer') return;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0 || style.position === 'fixed') {
        return;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 20) return;
      if (rect.right + scrollX <= 0 || rect.left + scrollX >= docWidth) return;

      candidates.push(el);
    });

    const candidateSet = new Set(candidates);

    const sameFootprint = (a, b) => {
      const areaA = a.width * a.height;
      const areaB = b.width * b.height;
      if (areaA <= 0 || areaB <= 0) return false;
      const overlapRatio = Math.min(areaA, areaB) / Math.max(areaA, areaB);
      return (overlapRatio > 0.88) && (Math.abs(a.top - b.top) <= 2);
    };

    const dropped = new Set();
    for (const node of candidates) {
      const nInfo = getInfo(node);
      for (let anc = node.parentElement; anc; anc = anc.parentElement) {
        if (!candidateSet.has(anc)) continue;
        const ancInfo = getInfo(anc);
        if (!sameFootprint(nInfo.rect, ancInfo.rect)) continue;
        if (nInfo.score > ancInfo.score) dropped.add(anc);
        else dropped.add(node);
      }
    }

    const kept = candidates.filter(el => !dropped.has(el));
    const keptSet = new Set(kept);

    // Section root tree: keep major section roots like dom_extractor.js
    const children = new Map();
    const roots = [];
    for (const node of kept) {
      let anc = node.parentElement;
      while (anc && !keptSet.has(anc)) anc = anc.parentElement;
      if (anc) {
        if (!children.has(anc)) children.set(anc, []);
        children.get(anc).push(node);
      } else {
        roots.push(node);
      }
    }

    const MAX_BLOCK_H = Math.max(900, Math.round((window.innerHeight || 800) * 1.2));
    const sectionRoots = [];
    const emit = (node) => {
      const kids = children.get(node) || [];
      if (kids.length && (getInfo(node).rect.height > MAX_BLOCK_H)) {
        kids.forEach(emit);
      } else {
        sectionRoots.push(node);
      }
    };
    roots.forEach(emit);

    sectionRoots.sort((a, b) => {
      const ra = getInfo(a).rect;
      const rb = getInfo(b).rect;
      return (ra.top - rb.top) || (rb.height - ra.height);
    });

    const landmarks = sectionRoots.map(el => {
      const i = getInfo(el);
      const rect = i.rect;
      const snippet = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const tag = el.tagName.toLowerCase();

      let key = '';
      if (i.renderingId) key = `RENDERING::${i.renderingId}`;
      else if (i.id) key = `ID::${i.id}`;
      else if (i.heading && i.heading.length >= 3) key = `HEAD::${i.heading.toLowerCase()}`;
      else if (snippet && snippet.length >= 20) key = `SNIP::${tag}::${snippet.toLowerCase()}`;
      else key = `TAG::${tag}::`;

      return {
        box: {
          x: Math.round(rect.left + scrollX),
          y: Math.round(rect.top + scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        key,
        heading: i.heading,
        tag,
        snippet,
        selector: getElementSelector(el)
      };
    });

    return { landmarks, docHeight, docWidth };
  }

  function sendLandmarksReport(force = false) {
    if (!isFramed) return;
    if (hasSentInitialLandmarks && !force) return;
    hasSentInitialLandmarks = true;

    try {
      const data = extractLandmarks();
      const diffCandidates = extractDiffCandidates();
      if (window.parent) {
        window.parent.postMessage({
          type: "VC_LANDMARKS_REPORT",
          paneId,
          landmarks: data.landmarks,
          docHeight: data.docHeight,
          docWidth: data.docWidth,
          href: window.location.href,
          diffCandidates
        }, "*");
      }
    } catch (err) {
      console.warn("[VisualCompare Live] Error extracting landmarks:", err);
    }
  }

  function sendDiffCandidatesReport() {
    if (!isFramed || !window.parent) return;
    try {
      const diffCandidates = extractDiffCandidates();
      window.parent.postMessage({
        type: "VC_DIFF_CANDIDATES_REPORT",
        paneId,
        candidates: diffCandidates,
        href: window.location.href
      }, "*");
    } catch (err) {
      console.warn("[VisualCompare Live] Error sending diff candidates report:", err);
    }
  }

  function isElementFixed(el) {
    if (!el || !el.ownerDocument || !el.ownerDocument.defaultView) return false;
    let curr = el;
    while (curr && curr !== curr.ownerDocument.body && curr !== curr.ownerDocument.documentElement) {
      try {
        const s = curr.ownerDocument.defaultView.getComputedStyle(curr);
        if (s && s.position === 'fixed') {
          return true;
        }
      } catch (e) { break; }
      curr = curr.parentElement;
    }
    return false;
  }

  function isElementSticky(el) {
    if (!el || !el.ownerDocument || !el.ownerDocument.defaultView) return false;
    let curr = el;
    while (curr && curr !== curr.ownerDocument.body && curr !== curr.ownerDocument.documentElement) {
      try {
        const s = curr.ownerDocument.defaultView.getComputedStyle(curr);
        if (s && (s.position === 'sticky' || s.position === 'fixed')) {
          return true;
        }
      } catch (e) { break; }
      curr = curr.parentElement;
    }
    return false;
  }

  function extractDiffCandidates() {
    const candidates = [];
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;

    const selector = [
      // Standard semantic, typography, & media elements
      'button', 'a', 'input', 'select', 'textarea',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'li', 'th', 'td', 'img', 'svg',
      'span', 'label', 'b', 'strong', 'em', 'i', 'small', 'code', 'mark',
      '[role="button"]', '[role="link"]', '[role="tab"]', '[role="heading"]',
      // Class patterns commonly used across modern websites
      '.btn', '.btn-primary', '.btn-secondary', '[class*="btn-"]', '[class*="button"]',
      '[class*="card"]', '[class*="item"]', '[class*="badge"]', '[class*="tag"]',
      '[class*="chip"]', '[class*="pill"]', '[class*="status"]', '[class*="color"]',
      '[class*="metric"]', '[class*="price"]', '[class*="amount"]', '[class*="currency"]',
      '[class*="logo"]', '[class*="brand"]', '[class*="title"]', '[class*="heading"]',
      '[class*="nav"]', '[class*="tab"]',
      '[class*="banner"]', '[class*="alert"]',
      '[class*="bg-"]', '[class*="text-"]', '[class*="border"]'
    ].join(',');

    const seenElements = new Set();
    try {
      document.querySelectorAll(selector).forEach(el => {
        if (seenElements.has(el)) return;
        if (el.classList.contains('vc-hazard-stripe-spacer') || el.id === 'vc-ghost-pointer' || el.classList.contains('vc-red-diff-badge')) return;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const tag = el.tagName.toLowerCase();
        // Skip structural container elements and broad section wrappers so container backgrounds never turn red
        const isContainerTag = tag === 'header' || tag === 'nav' || tag === 'footer' || 
                               tag === 'main' || tag === 'section' || tag === 'article' || 
                               tag === 'body' || tag === 'form';
        const isContainerClass = el.classList.contains('container') || 
                                 el.classList.contains('site-header') || 
                                 el.classList.contains('hero-section') || 
                                 el.classList.contains('cta-section');
        const isBroadWrapper = el.children.length > 0 && (rect.width > 250 && rect.height > 80);
        if (isContainerTag || isContainerClass || isBroadWrapper) {
          return;
        }

        const isFixed = isElementFixed(el);
        const isSticky = isElementSticky(el);

        const vh = window.innerHeight || document.documentElement.clientHeight || 800;
        const vw = window.innerWidth || document.documentElement.clientWidth || 1200;
        const inViewport = (rect.bottom >= -40 && rect.top <= vh + 40 && rect.right >= -40 && rect.left <= vw + 40);

        // Viewport-only filtering: strictly only process elements in or near the viewport (or sticky headers)
        if (!inViewport && !isSticky) return;

        seenElements.add(el);

        // Sanitize element text: remove any diff badge text so badges never bleed into candidate text
        let text = "";
        if (el.querySelector(".vc-red-diff-badge")) {
          const clone = el.cloneNode(true);
          clone.querySelectorAll(".vc-red-diff-badge").forEach(b => b.remove());
          text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        } else {
          text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        }
        text = text.replace(/Visual (Text|Metric|Style|Heading|Geometry):[^\n]*/gi, '').trim();

        const elSelector = getElementSelector(el);
        const srcAttr = el.getAttribute('src') || el.currentSrc || '';
        const hrefAttr = el.getAttribute('href') || '';
        const altAttr = el.getAttribute('alt') || '';
        const titleAttr = el.getAttribute('title') || '';

        let origBg = style.backgroundColor;
        if (el.classList.contains("vc-red-diff-hug") && el.dataset.vcOriginalBg !== undefined) {
          origBg = el.dataset.vcOriginalBg;
        }

        candidates.push({
          selector: elSelector,
          tag,
          text,
          src: srcAttr,
          href: hrefAttr,
          alt: altAttr,
          title: titleAttr,
          isFixed,
          isSticky,
          inViewport: (isFixed || isSticky || inViewport),
          box: {
            x: Math.round(rect.left + (isSticky ? 0 : scrollX)),
            y: Math.round(rect.top + (isSticky ? 0 : scrollY)),
            viewportX: Math.round(rect.left),
            viewportY: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            measuredWidth: vw
          },
          style: {
            bg: origBg,
            bgImage: style.backgroundImage,
            color: style.color,
            radius: style.borderRadius,
            border: style.borderColor,
            borderColor: style.borderColor,
            borderTopColor: style.borderTopColor,
            borderBottomColor: style.borderBottomColor,
            borderLeftColor: style.borderLeftColor,
            borderRightColor: style.borderRightColor,
            borderWidth: style.borderWidth,
            boxShadow: style.boxShadow,
            padding: style.padding,
            paddingLeft: style.paddingLeft,
            paddingTop: style.paddingTop,
            opacity: style.opacity,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontFamily: style.fontFamily,
            fontStyle: style.fontStyle,
            textAlign: style.textAlign
          }
        });
      });
    } catch (e) {
      console.warn("[VisualCompare Live] Error extracting diff candidates:", e);
    }

    return candidates;
  }

  function ensureHazardSpacerStyles() {
    if (document.getElementById("vc-hazard-spacer-styles")) return;
    const style = document.createElement("style");
    style.id = "vc-hazard-spacer-styles";
    style.textContent = `
      .vc-hazard-stripe-spacer {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        flex: 0 0 auto !important;
        clear: both !important;
        background-color: #facc15 !important;
        background-image: repeating-linear-gradient(
          -45deg,
          #facc15,
          #facc15 14px,
          #1e293b 14px,
          #1e293b 28px
        ) !important;
        border-top: 2px solid #ca8a04 !important;
        border-bottom: 2px solid #ca8a04 !important;
        position: relative !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: inset 0 2px 8px rgba(0,0,0,0.35), inset 0 -2px 8px rgba(0,0,0,0.35) !important;
        transition: opacity 0.2s ease !important;
        z-index: 99999 !important;
        opacity: 0.95 !important;
      }
      .vc-hazard-stripe-spacer:hover {
        opacity: 1 !important;
      }
      .vc-hazard-badge {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        background: rgba(15, 23, 42, 0.95) !important;
        color: #facc15 !important;
        border: 1px solid #facc15 !important;
        border-radius: 9999px !important;
        padding: 4px 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.3px !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
        white-space: nowrap !important;
        user-select: none !important;
        pointer-events: auto !important;
      }
      .vc-hazard-icon {
        font-size: 13px !important;
        display: inline-block !important;
        animation: vc-hazard-pulse 1.8s infinite ease-in-out !important;
      }
      .vc-hazard-close {
        background: transparent !important;
        border: none !important;
        color: #94a3b8 !important;
        font-size: 12px !important;
        cursor: pointer !important;
        padding: 0 2px !important;
        line-height: 1 !important;
        margin-left: 2px !important;
      }
      .vc-hazard-close:hover {
        color: #ef4444 !important;
      }
      @keyframes vc-hazard-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(style);
  }

  function applyHazardSpacer(info) {
    if (document.readyState === "loading" || !document.body) {
      window.addEventListener("DOMContentLoaded", () => applyHazardSpacer(info), { once: true });
      return;
    }

    ensureHazardSpacerStyles();
    const { spacerId, targetSelector, targetY, height, counterpart, insertPosition } = info;
    if (!height || height <= 2) return;

    let targetEl = null;
    if (targetSelector) {
      try {
        targetEl = document.querySelector(targetSelector);
      } catch (e) {}
    }

    if (!targetEl && targetY !== undefined) {
      const all = document.querySelectorAll(LANDMARK_SELECTORS);
      let closestEl = null;
      let minDistance = Infinity;
      for (const el of all) {
        if (el.classList.contains("vc-hazard-stripe-spacer")) continue;
        const r = el.getBoundingClientRect();
        const y = r.top + (window.scrollY || 0);
        const dist = Math.abs(y - targetY);
        if (dist < minDistance && dist < 200) {
          minDistance = dist;
          closestEl = el;
        }
      }
      if (closestEl) targetEl = closestEl;
    }

    let spacer = document.querySelector(`.vc-hazard-stripe-spacer[data-spacer-id="${spacerId}"]`);
    if (spacer) {
      spacer.style.setProperty("height", `${height}px`, "important");
      spacer.style.setProperty("min-height", `${height}px`, "important");
      spacer.style.setProperty("max-height", `${height}px`, "important");
      spacer.style.setProperty("flex", `0 0 ${height}px`, "important");
      spacer.style.setProperty("clear", "both", "important");
      // If spacer was previously appended to document.body (e.g., when frame was hidden or target not yet ready),
      // relocate it directly to target element now that targetEl is found
      if (spacer.parentElement === document.body && targetEl && targetEl.parentNode && targetEl !== document.body) {
        if (insertPosition === "before") {
          targetEl.insertAdjacentElement("beforebegin", spacer);
        } else {
          targetEl.insertAdjacentElement("afterend", spacer);
        }
      }
      return;
    }

    spacer = document.createElement("div");
    spacer.className = "vc-hazard-stripe-spacer";
    spacer.dataset.spacerId = spacerId;
    spacer.style.setProperty("height", `${height}px`, "important");
    spacer.style.setProperty("min-height", `${height}px`, "important");
    spacer.style.setProperty("max-height", `${height}px`, "important");
    spacer.style.setProperty("flex", `0 0 ${height}px`, "important");
    spacer.style.setProperty("clear", "both", "important");

    const badge = document.createElement("div");
    badge.className = "vc-hazard-badge";
    badge.innerHTML = `
      <span class="vc-hazard-icon">⚠️</span>
      <span>LAYOUT SHIFT: +${height}px (${counterpart || "Counterpart"} section is larger)</span>
      <button class="vc-hazard-close" title="Dismiss layout shift spacer">✕</button>
    `;

    badge.querySelector(".vc-hazard-close").addEventListener("click", (e) => {
      e.stopPropagation();
      spacer.style.height = "0px";
      spacer.style.opacity = "0";
      setTimeout(() => spacer.remove(), 250);
      if (isFramed) {
        window.parent.postMessage({ type: "VC_SPACER_DISMISSED", paneId, spacerId }, "*");
      }
    });

    spacer.appendChild(badge);

    if (targetEl && targetEl.parentNode) {
      if (insertPosition === "before") {
        targetEl.insertAdjacentElement("beforebegin", spacer);
      } else {
        // Default: attach after shorter section so the section matches the counterpart's height
        targetEl.insertAdjacentElement("afterend", spacer);
      }
    } else {
      document.body.appendChild(spacer);
    }
  }

  function removeHazardSpacers() {
    document.querySelectorAll(".vc-hazard-stripe-spacer").forEach(el => el.remove());
  }

  // ----------------------------------------------------
  // NON-HEIGHT RED DIFFERENCE ENGINE
  // (Highlights non-height visual, styling, & content regressions in RED)
  // ----------------------------------------------------
  function ensureRedDiffStyles() {
    let style = document.getElementById("vc-red-diff-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "vc-red-diff-styles";
      document.head.appendChild(style);
    }
    style.textContent = `
      .vc-red-diff-hug {
        outline: none !important;
        box-shadow: none !important;
        background-color: rgba(239, 68, 68, 0.28) !important;
        border-radius: inherit !important;
      }
      .vc-red-diff-hug::after {
        content: "" !important;
        position: absolute !important;
        inset: 0 !important;
        background-color: rgba(239, 68, 68, 0.18) !important;
        border-radius: inherit !important;
        pointer-events: none !important;
        z-index: 1000 !important;
      }
      .vc-red-diff-highlight {
        outline: none !important;
        box-shadow: none !important;
      }
      .vc-red-diff-badge {
        display: none !important;
      }
      .vc-red-diff-dot {
        display: none !important;
      }
    `;
  }

  function applyRedDiffs(diffList) {
    if (!Array.isArray(diffList) || diffList.length === 0) {
      removeRedDiffs();
      return;
    }
    ensureRedDiffStyles();
    removeRedDiffs(); // Clear existing highlights before applying

    const appliedBoxes = [];
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const processedElements = new Set();

    for (const item of diffList) {
      if (!item || !item.selector) continue;
      try {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach(el => {
          if (el.classList.contains("vc-hazard-stripe-spacer")) return;
          if (processedElements.has(el)) return;

          // Never apply red diff hug to structural container elements or wide wrappers!
          const tag = el.tagName.toLowerCase();
          const rect = el.getBoundingClientRect();
          const isContainerTag = tag === 'header' || tag === 'nav' || tag === 'footer' || 
                                 tag === 'main' || tag === 'section' || tag === 'article' || 
                                 tag === 'body' || tag === 'form';
          const isContainerClass = el.classList.contains('container') || 
                                   el.classList.contains('site-header') || 
                                   el.classList.contains('hero-section') || 
                                   el.classList.contains('cta-section');
          const isBroadWrapper = el.children.length > 0 && (rect.width > 250 && rect.height > 80);
          if (isContainerTag || isContainerClass || isBroadWrapper) {
            return;
          }

          processedElements.add(el);

          // Pure red hug on differing tags hugging tag's exact shape with zero outlines
          const isTextTag = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || 
                            tag === 'h5' || tag === 'h6' || tag === 'p' || tag === 'span' || 
                            tag === 'label' || tag === 'strong' || tag === 'em' || 
                            tag === 'th' || tag === 'td' || tag === 'li';
          const isTextDiff = item.diffType === "typography" || item.diffType === "text";

          const style = window.getComputedStyle(el);
          // USER REQUIREMENT: When text in a tag changes, NEVER highlight the whole tag background red!
          // Strictly highlight differing pixels only via the diff canvas overlay.
          if (!isTextDiff && (!isTextTag || item.diffType?.includes("background"))) {
            const pos = style.position;
            if (pos === "static") {
              el.style.position = "relative";
              el.dataset.vcOriginalStatic = "true";
            }
            if (el.dataset.vcOriginalBg === undefined) {
              el.dataset.vcOriginalBg = style.backgroundColor;
            }
            el.classList.add("vc-red-diff-hug");
          }

          // Remove any text description badges so differences have no text clutter
          el.querySelectorAll(".vc-red-diff-badge").forEach(b => b.remove());

          const labelText = (item.label && typeof item.label === "string") ? item.label.trim() : "";

          const isFixed = isElementFixed(el);
          const isSticky = isElementSticky(el);

          appliedBoxes.push({
            selector: item.selector,
            label: labelText,
            isFixed,
            isSticky,
            viewportX: Math.round(rect.left),
            viewportY: Math.round(rect.top),
            x: Math.round(rect.left + (isSticky ? 0 : scrollX)),
            y: Math.round(rect.top + (isSticky ? 0 : scrollY)),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            measuredWidth: (window.innerWidth || document.documentElement.clientWidth || 1200),
            text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100),
            style: {
              radius: style.borderRadius,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontFamily: style.fontFamily
            }
          });
        });
      } catch (err) {
        console.warn("[VisualCompare Live] Error applying red diff selector:", item.selector, err);
      }
    }

    if (isFramed && window.parent && appliedBoxes.length > 0) {
      window.parent.postMessage({
        type: "VC_RED_DIFFS_APPLIED",
        paneId,
        count: appliedBoxes.length,
        boxes: appliedBoxes
      }, "*");
    }
  }

  function removeRedDiffs() {
    document.querySelectorAll(".vc-red-diff-hug").forEach(el => {
      el.classList.remove("vc-red-diff-hug");
      if (el.dataset.vcOriginalStatic === "true") {
        el.style.position = "";
        delete el.dataset.vcOriginalStatic;
      }
      delete el.dataset.vcOriginalBg;
    });
    document.querySelectorAll(".vc-red-diff-highlight").forEach(el => {
      el.classList.remove("vc-red-diff-highlight");
    });
    document.querySelectorAll(".vc-red-diff-badge").forEach(badge => {
      badge.remove();
    });
  }

  // ----------------------------------------------------
  // DIMENSION CHANGE OBSERVER (Re-aligns yellow hazard spacers when page dimensions change)
  // ----------------------------------------------------
  let lastContentDimensions = null;
  let dimensionDebounceTimer = null;
  let resizeObserver = null;

  function getRawContentDimensions() {
    // Sum up heights of existing hazard spacers so spacer insertion doesn't count as a content change
    const spacers = document.querySelectorAll(".vc-hazard-stripe-spacer");
    let spacerHeight = 0;
    spacers.forEach(s => {
      spacerHeight += s.offsetHeight || 0;
    });

    const scrollW = Math.max(document.documentElement ? document.documentElement.scrollWidth : 0, document.body ? document.body.scrollWidth : 0);
    const scrollH = Math.max(document.documentElement ? document.documentElement.scrollHeight : 0, document.body ? document.body.scrollHeight : 0);
    const rawH = Math.max(0, scrollH - spacerHeight);
    const viewW = window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : 0);
    const viewH = window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : 0);

    return {
      scrollWidth: scrollW,
      scrollHeight: rawH,
      viewportWidth: viewW,
      viewportHeight: viewH
    };
  }

  function onDimensionMaybeChanged(source = "unknown") {
    if (!isFramed) return;
    const current = getRawContentDimensions();

    // If frame is hidden or collapsed (0x0 viewport), ignore to avoid false layout shift triggers
    if (current.viewportWidth <= 0 || current.viewportHeight <= 0) return;

    if (!lastContentDimensions) {
      lastContentDimensions = current;
      return;
    }

    const vwDiff = Math.abs(current.viewportWidth - lastContentDimensions.viewportWidth);
    const vhDiff = Math.abs(current.viewportHeight - lastContentDimensions.viewportHeight);
    const wDiff = Math.abs(current.scrollWidth - lastContentDimensions.scrollWidth);
    const hDiff = Math.abs(current.scrollHeight - lastContentDimensions.scrollHeight);

    // Only notify if viewport changed by >= 4px or content dimensions changed by >= 10px
    if (vwDiff >= 4 || vhDiff >= 4 || wDiff >= 10 || hDiff >= 10) {
      clearTimeout(dimensionDebounceTimer);
      dimensionDebounceTimer = setTimeout(() => {
        const settled = getRawContentDimensions();
        lastContentDimensions = settled;
        if (window.parent) {
          window.parent.postMessage({
            type: "VC_DIMENSIONS_CHANGED",
            paneId,
            dimensions: settled,
            source
          }, "*");
        }
      }, 250);
    }
  }

  function initDimensionObserver() {
    if (!lastContentDimensions) {
      lastContentDimensions = getRawContentDimensions();
    }
    if (typeof ResizeObserver === "undefined") return;
    if (resizeObserver) resizeObserver.disconnect();
    try {
      resizeObserver = new ResizeObserver(() => {
        onDimensionMaybeChanged("resize-observer");
      });
      if (document.documentElement) {
        resizeObserver.observe(document.documentElement);
      }
      if (document.body) {
        resizeObserver.observe(document.body);
      }
    } catch (e) {}
  }

  window.addEventListener("resize", () => {
    onDimensionMaybeChanged("window-resize");
  });

  // Observe dynamically loaded DOM content
  window.addEventListener("DOMContentLoaded", () => {
    initGhostCursor();
    mirrorHoverAndFocusRules();
    initDimensionObserver();
  });
  window.addEventListener("load", () => {
    mirrorHoverAndFocusRules();
    initDimensionObserver();
    onDimensionMaybeChanged("window-load");
  });
})();
