/**
 * VisualCompare Live - Site Access helpers (shared by popup, studio and background).
 *
 * Pure functions that turn the user's site-access choice into the match patterns
 * Chrome needs. Loaded as a plain script (popup/studio), via importScripts()
 * (service worker) and via require() (tests).
 *
 * Access modes:
 *   "urls"       - only the sites of the two URLs being compared (default, least privilege)
 *   "all"        - every http(s) site
 *   "all_except" - every http(s) site except the hosts the user lists
 *
 * NOTE: Chrome cannot grant "all sites except X". For "all_except" the extension
 * asks for all sites, then enforces the exclusions itself: the sync agent is not
 * registered on excluded hosts and header-relaxing rules skip them.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VCSiteAccess = api;
})(typeof self !== "undefined" ? self : this, function () {
  const MODES = ["urls", "all", "all_except"];
  const ALL_HTTP = ["http://*/*", "https://*/*"];
  const HOST_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

  /** Hostname of an http(s) URL, or null (extension pages, file:, junk). */
  function hostOf(url) {
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:" ? u.hostname.toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  /** Origin match patterns (http + https) for a URL's host, or [] if it needs no permission. */
  function originPatternsFor(url) {
    const host = hostOf(url);
    return host ? [`http://${host}/*`, `https://${host}/*`] : [];
  }

  /**
   * Parse the "except these sites" text box. Accepts hostnames, "*.example.com"
   * and full URLs, separated by newlines, commas or spaces.
   * @returns {{hosts: string[], invalid: string[]}} `*.` prefixes are stripped (subdomains are always included).
   */
  function parseExcludedSites(text) {
    const hosts = [];
    const invalid = [];
    String(text || "").split(/[\s,;]+/).filter(Boolean).forEach((raw) => {
      let entry = raw.trim().toLowerCase();
      if (/^https?:\/\//.test(entry)) entry = hostOf(entry) || "";
      entry = entry.replace(/^\*\./, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
      if (entry && HOST_RE.test(entry)) {
        if (!hosts.includes(entry)) hosts.push(entry);
      } else {
        invalid.push(raw);
      }
    });
    return { hosts, invalid };
  }

  /** True if `url`'s host is, or is a subdomain of, one of `excludedHosts`. */
  function isExcluded(url, excludedHosts) {
    const host = hostOf(url);
    if (!host) return false;
    return (excludedHosts || []).some((h) => host === h || host.endsWith("." + h));
  }

  /**
   * Build everything Chrome needs for a given choice.
   * @param {{mode: string, excluded?: string[]}} config
   * @param {string[]} urls  The URLs being compared.
   * @returns {{mode, origins: string[], excludeMatches: string[], excludedDomains: string[], requestDomains: string[]}}
   */
  function buildAccessPlan(config, urls) {
    const mode = MODES.includes(config && config.mode) ? config.mode : "urls";
    const excluded = mode === "all_except" ? (config.excluded || []) : [];
    const excludeMatches = [];
    excluded.forEach((h) => excludeMatches.push(`*://${h}/*`, `*://*.${h}/*`));

    let origins;
    let requestDomains = [];
    if (mode === "urls") {
      origins = [];
      (urls || []).forEach((u) => {
        originPatternsFor(u).forEach((p) => { if (!origins.includes(p)) origins.push(p); });
        const h = hostOf(u);
        if (h && !requestDomains.includes(h)) requestDomains.push(h);
      });
    } else {
      origins = ALL_HTTP.slice();
    }
    return { mode, origins, excludeMatches, excludedDomains: excluded.slice(), requestDomains };
  }

  return { MODES, ALL_HTTP, hostOf, originPatternsFor, parseExcludedSites, isExcluded, buildAccessPlan };
});
