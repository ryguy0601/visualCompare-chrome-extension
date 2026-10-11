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
  let ghostCursor = null;

  // Handshake with parent studio
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "VC_INIT_AGENT") {
      paneId = data.paneId;
      initGhostCursor();
      console.log(`[VisualCompare Live] Agent initialized for pane: ${paneId}`);
      // Notify parent that agent is ready
      window.parent.postMessage({ type: "VC_AGENT_READY", paneId, href: window.location.href }, "*");
    } else if (data.type === "VC_MIRROR_ACTION") {
      handleMirroredAction(data.action);
    }
  });

  // If in frame, notify parent immediately in case parent is waiting
  if (isFramed) {
    window.parent.postMessage({ type: "VC_FRAME_PING", href: window.location.href }, "*");
  }

  // ----------------------------------------------------
  // GHOST POINTER
  // ----------------------------------------------------
  function initGhostCursor() {
    if (ghostCursor || !document.body) return;
    ghostCursor = document.createElement("div");
    ghostCursor.id = "vc-ghost-pointer";
    ghostCursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.9) 0%, rgba(56, 189, 248, 0.2) 70%, transparent 100%);
      border: 2px solid #38bdf8;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-50%, -50%);
      transition: transform 0.04s ease-out, opacity 0.2s ease;
      display: none;
      opacity: 0;
    `;
    document.body.appendChild(ghostCursor);
  }

  // Visual ripple on mirrored click
  function showClickRipple(x, y) {
    const ripple = document.createElement("div");
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

    if (!document.getElementById("vc-ripple-styles")) {
      const style = document.createElement("style");
      style.id = "vc-ripple-styles";
      style.textContent = `
        @keyframes vc-ripple-anim {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  }

  // ----------------------------------------------------
  // SELECTOR & DOM UTILS
  // ----------------------------------------------------
  function getElementSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return "";
    if (el.id && !el.id.match(/\d{4,}/) && !el.id.includes(":")) {
      return `#${CSS.escape(el.id)}`;
    }
    
    // Tag + meaningful classes
    let sel = el.tagName.toLowerCase();
    if (el.classList && el.classList.length > 0) {
      const classes = Array.from(el.classList)
        .filter(c => !c.startsWith("vc-") && !c.includes("hover") && !c.includes("active") && c.length < 30)
        .slice(0, 3);
      if (classes.length > 0) {
        sel += "." + classes.map(c => CSS.escape(c)).join(".");
      }
    }

    // Role or data-testid
    if (el.getAttribute("data-testid")) {
      return `[data-testid="${CSS.escape(el.getAttribute("data-testid"))}"]`;
    }
    if (el.getAttribute("aria-label")) {
      return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(el.getAttribute("aria-label"))}"]`;
    }

    // Climb up 2 levels for hierarchy
    let parent = el.parentElement;
    let path = [sel];
    let count = 0;
    while (parent && parent !== document.body && count < 2) {
      let pSel = parent.tagName.toLowerCase();
      if (parent.id && !parent.id.match(/\d{4,}/)) {
        path.unshift(`#${CSS.escape(parent.id)}`);
        break;
      }
      if (parent.classList && parent.classList.length > 0) {
        pSel += "." + CSS.escape(parent.classList[0]);
      }
      path.unshift(pSel);
      parent = parent.parentElement;
      count++;
    }

    return path.join(" > ");
  }

  function findMatchingElement(action) {
    // 1. Try precise selector
    if (action.selector) {
      try {
        const found = document.querySelector(action.selector);
        if (found) return found;
      } catch (err) {}
    }

    // 2. Link matching by href
    if (action.href) {
      try {
        // match exact or partial pathname
        const urlObj = new URL(action.href, window.location.href);
        const link = document.querySelector(`a[href="${action.href}"], a[href="${urlObj.pathname}"]`);
        if (link) return link;
      } catch (err) {}
    }

    // 3. Text-content matching for buttons, tabs, links, labels
    if (action.text && action.text.length > 1 && action.text.length < 50) {
      const cleanText = action.text.trim().toLowerCase();
      const candidates = document.querySelectorAll("button, a, [role='button'], [role='tab'], label, summary, .btn, .card");
      for (const cand of candidates) {
        if (cand.textContent && cand.textContent.trim().toLowerCase() === cleanText) {
          return cand;
        }
      }
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
      if (atPoint && atPoint !== ghostCursor) return atPoint;
    }

    return null;
  }

  // ----------------------------------------------------
  // EVENT LISTENERS (OUTGOING ACTIONS)
  // ----------------------------------------------------
  if (isFramed) {
    // 1. CLICK TRACKING
    document.addEventListener("click", (e) => {
      if (isSyncing || e.__vc_synthetic) return;

      const target = e.target;
      if (!target || target === ghostCursor) return;

      const rect = target.getBoundingClientRect();
      const pctX = e.clientX / window.innerWidth;
      const pctY = e.clientY / window.innerHeight;
      const selector = getElementSelector(target);
      const text = (target.textContent || "").trim().slice(0, 50);
      const href = target.getAttribute("href") || (target.closest("a") ? target.closest("a").getAttribute("href") : "");

      // Send to studio parent
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
          clientY: e.clientY
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

      window.parent.postMessage({
        type: "VC_ACTION_PERFORMED",
        paneId,
        action: {
          kind: "hover",
          pctX,
          pctY
        }
      }, "*");
    }, true);

    // 3. SCROLL TRACKING
    let scrollTimeout = null;
    window.addEventListener("scroll", () => {
      if (isSyncing) return;

      if (!scrollTimeout) {
        scrollTimeout = requestAnimationFrame(() => {
          scrollTimeout = null;
          const maxScrollY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          const maxScrollX = Math.max(1, document.documentElement.scrollWidth - window.innerWidth);
          const pctY = window.scrollY / maxScrollY;
          const pctX = window.scrollX / maxScrollX;

          window.parent.postMessage({
            type: "VC_ACTION_PERFORMED",
            paneId,
            action: {
              kind: "scroll",
              scrollY: window.scrollY,
              scrollX: window.scrollX,
              pctY,
              pctX
            }
          }, "*");
        });
      }
    }, { passive: true });

    // 4. FORM INPUT TRACKING
    document.addEventListener("input", (e) => {
      if (isSyncing || e.__vc_synthetic) return;
      const target = e.target;
      if (!target || !("value" in target)) return;

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
        const el = findMatchingElement(action);
        const clickX = action.pctX !== undefined ? Math.round(action.pctX * window.innerWidth) : 100;
        const clickY = action.pctY !== undefined ? Math.round(action.pctY * window.innerHeight) : 100;
        showClickRipple(clickX, clickY);

        if (el) {
          // If element is a details or dropdown toggle
          if (el.tagName === "DETAILS") {
            el.open = !el.open;
          }

          // Focus element
          if (typeof el.focus === "function") {
            el.focus();
          }

          // Synthesize mouse event sequence
          const evtOptions = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clickX,
            clientY: clickY
          };

          const downEvt = new MouseEvent("mousedown", evtOptions);
          downEvt.__vc_synthetic = true;
          el.dispatchEvent(downEvt);

          const upEvt = new MouseEvent("mouseup", evtOptions);
          upEvt.__vc_synthetic = true;
          el.dispatchEvent(upEvt);

          const clickEvt = new MouseEvent("click", evtOptions);
          clickEvt.__vc_synthetic = true;
          el.dispatchEvent(clickEvt);

          // If native .click() didn't fire handlers
          if (typeof el.click === "function" && el.tagName !== "A") {
            el.click();
          }

          // If it's a link and action didn't navigate
          if (action.href && (el.tagName === "A" || el.closest("a"))) {
            const link = el.tagName === "A" ? el : el.closest("a");
            if (link.href && link.target !== "_blank") {
              window.location.href = link.href;
            }
          }
        } else if (action.href) {
          // If element wasn't in DOM but href is known, navigate matching route
          try {
            const destUrl = new URL(action.href, window.location.href);
            window.location.pathname = destUrl.pathname;
          } catch (e) {}
        }
      } else if (action.kind === "hover") {
        if (!ghostCursor) initGhostCursor();
        if (ghostCursor && action.pctX !== undefined) {
          const x = Math.round(action.pctX * window.innerWidth);
          const y = Math.round(action.pctY * window.innerHeight);
          ghostCursor.style.display = "block";
          ghostCursor.style.opacity = "1";
          ghostCursor.style.left = `${x}px`;
          ghostCursor.style.top = `${y}px`;
        }
      } else if (action.kind === "scroll") {
        const maxScrollY = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const maxScrollX = Math.max(1, document.documentElement.scrollWidth - window.innerWidth);
        const targetY = action.pctY !== undefined ? Math.round(action.pctY * maxScrollY) : action.scrollY;
        const targetX = action.pctX !== undefined ? Math.round(action.pctX * maxScrollX) : action.scrollX;

        window.scrollTo({
          top: targetY,
          left: targetX,
          behavior: "auto"
        });
      } else if (action.kind === "input") {
        const el = findMatchingElement(action);
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
      // Release sync lock
      setTimeout(() => {
        isSyncing = false;
      }, 50);
    }
  }

  // Ensure ghost cursor hides when mouse leaves window
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

  // Observe dynamically loaded DOM content
  window.addEventListener("DOMContentLoaded", () => {
    initGhostCursor();
  });
})();
