/**
 * Background Service Worker for VisualCompare Live Extension
 *
 * Besides the small message handlers below, it enforces the user's site-access
 * choice (see site_access.js):
 *   - registers the sync agent content script ONLY on the allowed sites, and
 *   - strips frame-blocking headers ONLY for sub-frames loaded inside open
 *     Studio tabs (never for the user's normal browsing).
 */

importScripts("site_access.js");

const AGENT_SCRIPT_ID = "vc-sync-agent";
const FRAME_RULE_ID = 1;
const STORAGE_PLAN = "vc_site_access_plan";
const SESSION_STUDIO_TABS = "vc_studio_tabs";

/** (Re)register the sync agent on the sites in `plan`, or remove it if none. */
async function registerSyncAgent(plan) {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [AGENT_SCRIPT_ID] });
  } catch (e) { /* not registered yet */ }
  if (!plan || !plan.origins.length) return;
  const script = {
    id: AGENT_SCRIPT_ID,
    js: ["sync_agent.js"],
    matches: plan.origins,
    allFrames: true,
    runAt: "document_start",
    persistAcrossSessions: true
  };
  if (plan.excludeMatches.length) script.excludeMatches = plan.excludeMatches;
  await chrome.scripting.registerContentScripts([script]);
}

/**
 * Header-relaxing rule (lets sites load inside the Studio iframes). It is a session
 * rule limited to Studio tabs and sub-frames, and to the allowed request domains.
 */
async function refreshFrameRule() {
  const store = await chrome.storage.session.get([SESSION_STUDIO_TABS]);
  const tabIds = store[SESSION_STUDIO_TABS] || [];
  const { [STORAGE_PLAN]: plan } = await chrome.storage.local.get([STORAGE_PLAN]);
  const update = { removeRuleIds: [FRAME_RULE_ID], addRules: [] };
  const hasScope = plan && (plan.mode !== "urls" || plan.requestDomains.length > 0);
  if (tabIds.length && hasScope) {
    const condition = { resourceTypes: ["sub_frame"], tabIds };
    if (plan.mode === "urls") condition.requestDomains = plan.requestDomains;
    else if (plan.excludedDomains.length) condition.excludedRequestDomains = plan.excludedDomains;
    update.addRules.push({
      id: FRAME_RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          { header: "frame-options", operation: "remove" },
          { header: "content-security-policy", operation: "remove" }
        ]
      },
      condition
    });
  }
  await chrome.declarativeNetRequest.updateSessionRules(update);
}

async function applySiteAccessPlan(plan) {
  await chrome.storage.local.set({ [STORAGE_PLAN]: plan });
  await registerSyncAgent(plan);
  await refreshFrameRule();
}

async function trackStudioTab(tabId) {
  const store = await chrome.storage.session.get([SESSION_STUDIO_TABS]);
  const tabIds = store[SESSION_STUDIO_TABS] || [];
  if (!tabIds.includes(tabId)) tabIds.push(tabId);
  await chrome.storage.session.set({ [SESSION_STUDIO_TABS]: tabIds });
  await refreshFrameRule();
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const store = await chrome.storage.session.get([SESSION_STUDIO_TABS]);
  const tabIds = store[SESSION_STUDIO_TABS] || [];
  if (tabIds.includes(tabId)) {
    await chrome.storage.session.set({ [SESSION_STUDIO_TABS]: tabIds.filter((id) => id !== tabId) });
    await refreshFrameRule();
  }
});

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
  // Only our own extension pages may change site access.
  if (sender.id !== chrome.runtime.id) return false;

  if (message.type === "APPLY_SITE_ACCESS") {
    applySiteAccessPlan(message.plan)
      .then(() => sendResponse({ status: "ok" }))
      .catch((err) => sendResponse({ status: "error", message: String(err && err.message || err) }));
    return true;
  }

  if (message.type === "VC_STUDIO_READY") {
    if (sender.tab && sender.tab.id !== undefined) {
      trackStudioTab(sender.tab.id).then(() => sendResponse({ status: "ok" }), () => sendResponse({ status: "error" }));
    } else {
      sendResponse({ status: "error" });
    }
    return true;
  }

  if (message.type === "OPEN_STUDIO") {
    const prodUrl = encodeURIComponent(message.prodUrl || "");
    const stgUrl = encodeURIComponent(message.stgUrl || "");
    const studioUrl = chrome.runtime.getURL(`studio.html?prod=${prodUrl}&stg=${stgUrl}`);
    chrome.tabs.create({ url: studioUrl });
    sendResponse({ status: "ok" });
    return true;
  }

  if (message.type === "CAPTURE_ACTIVE_TAB") {
    // Capture visible tab screenshot for pixel diff analysis and GoFullPage export
    const winId = (sender && sender.tab && sender.tab.windowId !== undefined) ? sender.tab.windowId : null;
    chrome.tabs.captureVisibleTab(winId, { format: "png" }, (dataUrl) => {
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
