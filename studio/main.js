/**
 * VisualCompare Live - Studio: startup
 * Loaded LAST. Runs the initial UI sync and first iframe load once every
 * function from the other studio/*.js files is defined.
 */

function startStudio() {
  updateSyncChipStyles();
  updateDiffBaseVisibility(false);

  // Load iframes
  navigateWithAccess(initialProd, initialStg);
  setTimeout(() => {
    if (typeof applyViewportPresetAndZoom === "function" && viewportSelect && viewportSelect.value !== "responsive") {
      applyViewportPresetAndZoom(true);
    }
  }, 150);
}

// Tell the background worker this tab is a Studio tab (so frame-header relaxing
// applies to it only) and wait for it before loading any iframe.
if (hasChromeRuntime && typeof chrome.runtime.sendMessage === "function") {
  chrome.runtime.sendMessage({ type: "VC_STUDIO_READY" }, () => {
    void chrome.runtime.lastError; // ignore: studio still works for sites that allow framing
    startStudio();
  });
} else {
  startStudio();
}
