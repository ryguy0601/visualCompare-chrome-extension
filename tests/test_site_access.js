// Tests site-access parsing/plans (site_access.js) and the background worker's
// enforcement (content-script registration + session header rule) with a mocked chrome API.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const SA = require("../site_access.js");

console.log("1. parseExcludedSites");
let r = SA.parseExcludedSites("Bank.com, https://mail.google.com/inbox *.foo.org\nbank.com bad_host!");
assert.deepStrictEqual(r.hosts, ["bank.com", "mail.google.com", "foo.org"], "normalises, strips *., dedupes");
assert.deepStrictEqual(r.invalid, ["bad_host!"]);
assert.deepStrictEqual(SA.parseExcludedSites("").hosts, []);

console.log("2. isExcluded / hostOf");
assert(SA.isExcluded("https://www.bank.com/x", ["bank.com"]), "subdomains are excluded");
assert(!SA.isExcluded("https://notbank.com/", ["bank.com"]), "suffix lookalikes are NOT excluded");
assert.strictEqual(SA.hostOf("chrome-extension://abc/demo.html"), null);

console.log("3. buildAccessPlan");
let p = SA.buildAccessPlan({ mode: "urls" }, ["https://a.com/x", "http://b.org", "chrome-extension://id/demo/demo_prod.html"]);
assert.deepStrictEqual(p.origins, ["http://a.com/*", "https://a.com/*", "http://b.org/*", "https://b.org/*"]);
assert.deepStrictEqual(p.requestDomains, ["a.com", "b.org"]);
p = SA.buildAccessPlan({ mode: "urls" }, ["chrome-extension://id/demo/demo_prod.html"]);
assert.deepStrictEqual(p.origins, [], "demo pages need no permission");
p = SA.buildAccessPlan({ mode: "all" }, ["https://a.com"]);
assert.deepStrictEqual(p.origins, ["http://*/*", "https://*/*"]);
assert.deepStrictEqual(p.excludeMatches, []);
p = SA.buildAccessPlan({ mode: "all_except", excluded: ["bank.com"] }, []);
assert.deepStrictEqual(p.excludeMatches, ["*://bank.com/*", "*://*.bank.com/*"]);
assert.deepStrictEqual(p.excludedDomains, ["bank.com"]);
assert.strictEqual(SA.buildAccessPlan({ mode: "bogus" }, []).mode, "urls", "unknown mode falls back to least privilege");
assert.deepStrictEqual(SA.buildAccessPlan({ mode: "all", excluded: ["x.com"] }, []).excludedDomains, [], "exclusions only apply in all_except mode");

console.log("4. background worker enforcement (mock chrome)");
const local = {}, session = {};
const calls = { registered: [], unregistered: 0, sessionRules: [] };
const listeners = {};
const chrome = {
  runtime: { id: "me", onInstalled: { addListener() {} }, onMessage: { addListener: (f) => (listeners.msg = f) }, getURL: (x) => x },
  storage: {
    local: { get: async (k) => Object.fromEntries(k.map((x) => [x, local[x]])), set: async (o) => Object.assign(local, o) },
    session: { get: async (k) => Object.fromEntries(k.map((x) => [x, session[x]])), set: async (o) => Object.assign(session, o) }
  },
  tabs: { onRemoved: { addListener: (f) => (listeners.removed = f) }, create() {}, query() {}, captureVisibleTab() {} },
  scripting: {
    unregisterContentScripts: async () => { calls.unregistered++; },
    registerContentScripts: async (s) => calls.registered.push(...s)
  },
  declarativeNetRequest: { updateSessionRules: async (u) => calls.sessionRules.push(u) }
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../background.js"), "utf8"), {
  chrome, console, importScripts: () => {}, self: {}, VCSiteAccess: SA
});
const send = (msg, sender = { id: "me", tab: { id: 7 } }) => new Promise((res) => {
  const async = listeners.msg(msg, sender, res);
  if (!async) res("ignored");
});

// Clone out of the vm realm so deepStrictEqual compares plain prototypes.
const clone = (x) => JSON.parse(JSON.stringify(x));

(async () => {
  assert.strictEqual(await send({ type: "APPLY_SITE_ACCESS", plan: p }, { id: "evil" }), "ignored", "foreign senders are ignored");
  assert.strictEqual(calls.registered.length, 0);

  const urlsPlan = SA.buildAccessPlan({ mode: "urls" }, ["https://a.com"]);
  assert.strictEqual((await send({ type: "APPLY_SITE_ACCESS", plan: urlsPlan })).status, "ok");
  assert.deepStrictEqual(clone(calls.registered[0]).matches, urlsPlan.origins, "agent registered only on the chosen sites");
  assert.strictEqual(calls.registered[0].excludeMatches, undefined);
  let last = () => clone(calls.sessionRules[calls.sessionRules.length - 1]);
  assert.deepStrictEqual(last().addRules, [], "no header rule until a studio tab exists");

  await send({ type: "VC_STUDIO_READY" });
  let rule = last().addRules[0];
  assert.deepStrictEqual(rule.condition.tabIds, [7], "rule limited to the studio tab");
  assert.deepStrictEqual(rule.condition.resourceTypes, ["sub_frame"]);
  assert.deepStrictEqual(rule.condition.requestDomains, ["a.com"], "rule limited to the chosen domains");

  const exceptPlan = SA.buildAccessPlan({ mode: "all_except", excluded: ["bank.com"] }, []);
  await send({ type: "APPLY_SITE_ACCESS", plan: exceptPlan });
  assert.deepStrictEqual(clone(calls.registered.at(-1)).excludeMatches, exceptPlan.excludeMatches, "agent skips excluded sites");
  rule = last().addRules[0];
  assert.deepStrictEqual(rule.condition.excludedRequestDomains, ["bank.com"], "header rule skips excluded sites");
  assert.strictEqual(rule.condition.requestDomains, undefined);

  await send({ type: "APPLY_SITE_ACCESS", plan: SA.buildAccessPlan({ mode: "urls" }, ["chrome-extension://x/demo.html"]) });
  assert.deepStrictEqual(last().addRules, [], "demo-only plan installs no header rule");

  await send({ type: "APPLY_SITE_ACCESS", plan: urlsPlan });
  await listeners.removed(7);
  assert.deepStrictEqual(last().addRules, [], "rule removed when the studio tab closes");
  console.log("PASS");
})().catch((e) => { console.error(e); process.exit(1); });

// Regression: the permission prompt must NOT be requested from the popup (a popup closes
// as soon as Chrome's prompt takes focus, losing the request and leaving the browser stuck).
console.log("5. permission prompt lives in the studio page, not the popup");
const popupSrc = fs.readFileSync(path.join(__dirname, "../popup.js"), "utf8");
assert(!/permissions\.request/.test(popupSrc), "popup.js must not call chrome.permissions.request");
const navSrc = fs.readFileSync(path.join(__dirname, "../studio/navigation.js"), "utf8");
assert(/permissions\.request/.test(navSrc), "studio must request permission from the Grant access button");
assert(/addEventListener\("click"[\s\S]{0,80}\n\s*chrome\.permissions\.request/.test(navSrc), "request must happen inside a click handler (user gesture)");
console.log("PASS 5");
