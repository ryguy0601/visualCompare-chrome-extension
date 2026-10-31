/**
 * VisualCompare Live - Popup Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  const prodInput = document.getElementById("prod-url-input");
  const stgInput = document.getElementById("stg-url-input");
  const deviceSelect = document.getElementById("device-select");
  const syncClicks = document.getElementById("sync-clicks-check");
  const syncScroll = document.getElementById("sync-scroll-check");
  const syncHover = document.getElementById("sync-hover-check");
  const syncInputs = document.getElementById("sync-inputs-check");

  const btnUseActiveProd = document.getElementById("btn-use-active-prod");
  const btnUseActiveStg = document.getElementById("btn-use-active-stg");
  const btnLaunch = document.getElementById("btn-launch-studio");
  const btnSwap = document.getElementById("btn-quick-swap");
  const btnDemo = document.getElementById("btn-demo-preset");

  const accessRadios = document.querySelectorAll('input[name="site-access"]');
  const excludedInput = document.getElementById("site-access-excluded");

  function selectedAccessMode() {
    const checked = document.querySelector('input[name="site-access"]:checked');
    return checked ? checked.value : "urls";
  }
  function syncExcludedState() {
    excludedInput.disabled = selectedAccessMode() !== "all_except";
  }
  accessRadios.forEach((r) => r.addEventListener("change", syncExcludedState));

  // Load saved state
  chrome.storage.local.get(["vc_saved_urls", "vc_defaults", "vc_site_access_config"], (data) => {
    if (data.vc_site_access_config) {
      const cfg = data.vc_site_access_config;
      const radio = document.querySelector(`input[name="site-access"][value="${cfg.mode}"]`);
      if (radio) radio.checked = true;
      excludedInput.value = (cfg.excluded || []).join(", ");
      syncExcludedState();
    }
    if (data.vc_saved_urls) {
      prodInput.value = data.vc_saved_urls.prod || "";
      stgInput.value = data.vc_saved_urls.stg || "";
    }
    if (data.vc_defaults) {
      if (data.vc_defaults.device) deviceSelect.value = data.vc_defaults.device;
      if (data.vc_defaults.syncClicks !== undefined) syncClicks.checked = data.vc_defaults.syncClicks;
      if (data.vc_defaults.syncScroll !== undefined) syncScroll.checked = data.vc_defaults.syncScroll;
      if (data.vc_defaults.syncHover !== undefined) syncHover.checked = data.vc_defaults.syncHover;
      if (data.vc_defaults.syncInputs !== undefined) syncInputs.checked = data.vc_defaults.syncInputs;
    }
  });

  // "Use Current Tab" button for Prod
  btnUseActiveProd.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_URL" }, (res) => {
      if (res && res.url) {
        prodInput.value = res.url;
      }
    });
  });

  // "Use Current Tab" button for Stg
  btnUseActiveStg.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_URL" }, (res) => {
      if (res && res.url) {
        stgInput.value = res.url;
      }
    });
  });

  // Swap URLs
  btnSwap.addEventListener("click", () => {
    const temp = prodInput.value;
    prodInput.value = stgInput.value;
    stgInput.value = temp;
  });

  // Load Demo Test
  btnDemo.addEventListener("click", () => {
    prodInput.value = chrome.runtime.getURL("demo/demo_prod.html");
    stgInput.value = chrome.runtime.getURL("demo/demo_stg.html");
  });

  // Launch Studio
  btnLaunch.addEventListener("click", () => {
    let prod = prodInput.value.trim();
    let stg = stgInput.value.trim();

    if (!prod && !stg) {
      alert("Please enter at least one URL to compare!");
      return;
    }

    // Default staging to prod if empty
    if (!stg) stg = prod;
    if (!prod) prod = stg;

    // Work out which sites the extension needs access to
    const mode = selectedAccessMode();
    const parsed = VCSiteAccess.parseExcludedSites(excludedInput.value);
    if (mode === "all_except" && parsed.invalid.length) {
      alert("These excluded sites are not valid hostnames: " + parsed.invalid.join(", "));
      return;
    }
    if (mode === "all_except" && [prod, stg].some((u) => VCSiteAccess.isExcluded(u, parsed.hosts))) {
      alert("One of the URLs you want to compare is in your excluded list.");
      return;
    }
    const accessConfig = { mode, excluded: mode === "all_except" ? parsed.hosts : [] };

    // Save URLs and preferences
    chrome.storage.local.set({
      vc_saved_urls: { prod, stg },
      vc_site_access_config: accessConfig,
      vc_defaults: {
        syncClicks: syncClicks.checked,
        syncScroll: syncScroll.checked,
        syncHover: syncHover.checked,
        syncInputs: syncInputs.checked,
        device: deviceSelect.value
      }
    });

    // Open the studio. Chrome's permission prompt is shown there (not here): a popup
    // closes as soon as the prompt takes focus, which would lose the request.
    const params = new URLSearchParams({
      prod,
      stg,
      device: deviceSelect.value,
      syncClicks: syncClicks.checked,
      syncScroll: syncScroll.checked,
      syncHover: syncHover.checked,
      syncInputs: syncInputs.checked
    });
    chrome.tabs.create({ url: chrome.runtime.getURL(`studio.html?${params.toString()}`) });
    window.close();
  });
});
