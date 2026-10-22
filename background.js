/**
 * Background Service Worker for VisualCompare Live Extension
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[VisualCompare Live] Extension installed and active.");
  // Initialize storage defaults if empty
  chrome.storage.local.get(["vc_defaults"], (res) => {
    if (!res.vc_defaults) {
      chrome.storage.local.set({
        vc_defaults: {
          syncClicks: true,
          syncScroll: true,
          syncHover: true,
          syncInputs: true,
          syncNav: true,
          device: "desktop",
          desktopRes: "1920x1080",
          mobileRes: "440x956",
          diffTolerance: 15
        }
      });
    }
  });
});

// Message listener for tab actions, screenshot requests, and relaying
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_STUDIO") {
    const prodUrl = encodeURIComponent(message.prodUrl || "");
    const stgUrl = encodeURIComponent(message.stgUrl || "");
    const studioUrl = chrome.runtime.getURL(`studio.html?prod=${prodUrl}&stg=${stgUrl}`);
    chrome.tabs.create({ url: studioUrl });
    sendResponse({ status: "ok" });
    return true;
  }

  if (message.type === "CAPTURE_ACTIVE_TAB") {
    // Capture visible tab screenshot for pixel diff analysis
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
      } else {
        sendResponse({ status: "ok", dataUrl });
      }
    });
    return true;
  }

  if (message.type === "GET_ACTIVE_TAB_URL") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ url: tabs[0].url, title: tabs[0].title });
      } else {
        sendResponse({ url: "", title: "" });
      }
    });
    return true;
  }

  // ----------------------------------------------------
  // HEADLESS CAPTURE ENGINE VIA CHROME DEVTOOLS PROTOCOL
  // (Zero scrolling in extension screen, background CDP full-page render)
  // ----------------------------------------------------
  if (message.type === "CAPTURE_HEADLESS_PAGE") {
    captureHeadlessPage(message.url, message.width || 1280, message.format || "pdf")
      .then((res) => sendResponse({ status: "ok", ...res }))
      .catch((err) => {
        console.warn("[VisualCompare Live] Headless capture failed:", err);
        sendResponse({ status: "error", message: err.message });
      });
    return true;
  }
});

function sendCdpCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(res || {});
      }
    });
  });
}

/**
 * Headlessly captures a webpage without scrolling in the extension screen.
 * Uses a background inactive tab with Chrome DevTools Protocol Page.captureScreenshot
 * (captureBeyondViewport: true) and Page.printToPDF.
 */
async function captureHeadlessPage(url, width = 1280, format = "pdf") {
  if (!url || url.startsWith("about:")) {
    throw new Error("Invalid URL for headless capture.");
  }
  if (!chrome.debugger) {
    throw new Error("Debugger API unavailable.");
  }

  // 1. Create background tab (active: false so user never sees it)
  const tab = await chrome.tabs.create({ url, active: false });

  try {
    // 2. Wait for tab to complete loading
    await new Promise((resolve) => {
      let settled = false;
      const onUpdated = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === "complete") {
          settled = true;
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => {
        if (!settled) {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      }, 12000);
    });

    // 3. Attach debugger
    await new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId: tab.id }, "1.3", () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });

    // 4. Emulate device metrics matching desktop width
    await sendCdpCommand(tab.id, "Emulation.setDeviceMetricsOverride", {
      width: Math.max(800, width),
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 5. Run Python browser.py pre-capture cleanup script
    const cleanupScript = `
      (() => {
        try {
          const style = document.createElement("style");
          style.id = "vc-capture-freeze";
          style.textContent = "html, body { scroll-behavior: auto !important; overflow-x: hidden !important; scrollbar-width: none !important; } *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; } ::-webkit-scrollbar { display: none !important; width: 0px !important; }";
          (document.head || document.documentElement).appendChild(style);

          document.querySelectorAll(".carousel").forEach(el => {
            try {
              if (window.bootstrap && window.bootstrap.Carousel) window.bootstrap.Carousel.getOrCreateInstance(el).pause();
              else if (window.jQuery && window.jQuery.fn && window.jQuery.fn.carousel) window.jQuery(el).carousel("pause");
            } catch (e) {}
          });

          const isiToken = /(^|[-_])isi($|[-_])/;
          document.querySelectorAll("*").forEach(el => {
            try {
              const s = window.getComputedStyle(el);
              if (s.position !== "fixed" && s.position !== "sticky") return;
              const cls = (el.getAttribute("class") || "").toLowerCase();
              const id = (el.id || "").toLowerCase();
              if (el.tagName.toLowerCase() === "footer" || cls.includes("footer") || id.includes("footer")) return;
              if (isiToken.test(cls) || isiToken.test(id) || cls.includes("sticky-banner") || cls.includes("floating-tray")) {
                el.style.setProperty("display", "none", "important");
              }
            } catch (e) {}
          });

          window.scrollTo(0, 0);
        } catch (e) {}
      })()
    `;

    try {
      await sendCdpCommand(tab.id, "Runtime.evaluate", { expression: cleanupScript, awaitPromise: true });
    } catch (e) {}

    // Await fonts and settle
    await new Promise((r) => setTimeout(r, 450));

    // 6. Capture full-page screenshot (lossless PNG) via Page.captureScreenshot
    const shotRes = await sendCdpCommand(tab.id, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      fromSurface: true
    });

    let pdfData = null;
    if (format === "pdf" || format === "both") {
      try {
        const pdfRes = await sendCdpCommand(tab.id, "Page.printToPDF", {
          printBackground: true,
          preferCSSPageSize: true,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0
        });
        if (pdfRes && pdfRes.data) pdfData = pdfRes.data;
      } catch (e) {
        console.warn("[VisualCompare Live] Page.printToPDF note:", e);
      }
    }

    // 7. Cleanup & close background tab
    try { await chrome.debugger.detach({ tabId: tab.id }); } catch (e) {}
    try { await chrome.tabs.remove(tab.id); } catch (e) {}

    return {
      pngDataUrl: shotRes && shotRes.data ? `data:image/png;base64,${shotRes.data}` : null,
      pdfBase64: pdfData,
      width,
      url
    };
  } catch (err) {
    try { await chrome.debugger.detach({ tabId: tab.id }); } catch (e) {}
    try { await chrome.tabs.remove(tab.id); } catch (e) {}
    throw err;
  }
}
