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
});
