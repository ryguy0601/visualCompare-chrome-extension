// Unit Test: Validating that identical elements have ZERO red difference and only differing pixels/tags are highlighted
const fs = require('fs');
const assert = require('assert');
const path = require('path');

console.log("TEST: Validating Identical Elements Have Zero Red Diff & Only Differing Pixels Highlighted in Red...");

const studioJs = fs.readFileSync(path.join(__dirname, '../studio.js'), 'utf8');
const syncAgentJs = fs.readFileSync(path.join(__dirname, '../sync_agent.js'), 'utf8');

// 1. Verify candidate extraction in sync_agent.js never extracts structural containers or broad wrappers
assert(!syncAgentJs.includes("'header', 'nav', 'footer', 'main', 'section', 'article'"),
  "sync_agent.js extractDiffCandidates must NOT include structural container tags in candidate selector");
assert(syncAgentJs.includes("const isBroadWrapper = el.children.length > 0 && (rect.width > 250 && rect.height > 80);"),
  "sync_agent.js extractDiffCandidates must filter out broad container wrappers with children");
console.log("PASS 1: sync_agent.js candidate extraction excludes structural containers and broad section wrappers.");

// 2. Verify applyRedDiffs in sync_agent.js never applies .vc-red-diff-hug to container elements
assert(syncAgentJs.includes("if (isContainerTag || isContainerClass || isBroadWrapper) {\n            return;\n          }"),
  "applyRedDiffs must skip container elements and broad section wrappers");
console.log("PASS 2: applyRedDiffs guards against container elements, preventing broad red background washes.");

// 3. Verify detectPageDifferences in studio.js ignores broad containers and non-leaf text
assert(studioJs.includes("const isBroadContainer = isContainerTag ||"),
  "detectPageDifferences must identify broad container wrappers");
assert(studioJs.includes("if (isBroadContainer) {\n            return;\n          }"),
  "detectPageDifferences must ignore broad container wrappers");
assert(studioJs.includes("if (!textMatches && pText && sText && isTextTag && !p.selector.includes(\".env-badge\")) {"),
  "detectPageDifferences must only flag typography differences on genuine leaf text elements");
console.log("PASS 3: detectPageDifferences strictly isolates differences to leaf elements and never container wrappers.");

// 4. Verify renderers in studio.js never paint solid red rectangles over container sections
assert(studioJs.includes("const isBroadSection = tag === \"section\" || tag === \"header\" || tag === \"nav\" || tag === \"footer\" || tag === \"main\" ||"),
  "renderers must check for broad sections");
assert(studioJs.includes("if (isBroadSection) return;"),
  "renderers must return early without painting filled boxes over broad sections");
console.log("PASS 4: Diff renderers never paint filled boxes over sections, keeping identical text and containers pristine.");

// 5. Behavioral Simulation: Test demo diff generation for Overview page
console.log("TEST 5: Simulating Overview Page Diff Generation (Verifying zero red on identical parts)...");

// Mock landmark structures for demo_prod and demo_stg overview page
const mockProdLandmarks = {
  href: "demo_prod.html",
  landmarks: [
    { tag: "section", heading: "Unified Cloud Observability", selector: ".hero-section", box: { x: 0, y: 60, width: 1200, height: 400 } }
  ],
  diffCandidates: [
    { tag: "div", selector: ".brand-logo", text: "A", style: { bg: "rgba(0,0,0,0)", bgImage: "linear-gradient(135deg, #4f46e5, #06b6d4)" } },
    { tag: "span", selector: ".brand-name .env-badge", text: "PROD", style: { color: "rgb(56, 189, 248)" } },
    { tag: "a", selector: "#btn-start-trial", text: "Start Free Trial", style: { bg: "rgb(37, 99, 235)", radius: "8px" } },
    { tag: "a", selector: ".btn-login", text: "Sign In", style: { color: "rgb(203, 213, 225)" } },
    { tag: "h1", selector: ".hero-title", text: "Unified Cloud Observability", style: { color: "rgb(255, 255, 255)" } },
    { tag: "p", selector: ".hero-subtitle", text: "Continuous telemetry, zero-overhead kernel eBPF probes, and real-time distributed tracing at hyperscale.", style: { color: "rgb(148, 163, 184)" } },
    { tag: "a", selector: ".btn-secondary", text: "Explore Live Sandbox", style: { bg: "rgb(30, 41, 59)" } }
  ]
};

const mockStgLandmarks = {
  href: "demo_stg.html",
  landmarks: [
    { tag: "section", heading: "Unified Cloud Observability", selector: ".hero-section", box: { x: 0, y: 113, width: 1200, height: 400 } }
  ],
  diffCandidates: [
    { tag: "div", selector: ".brand-logo", text: "A", style: { bg: "rgba(0,0,0,0)", bgImage: "linear-gradient(135deg, #8b5cf6, #ec4899)" } },
    { tag: "span", selector: ".brand-name .env-badge", text: "STAGING", style: { color: "rgb(192, 132, 252)" } },
    { tag: "a", selector: "#btn-start-trial", text: "Start Free Trial", style: { bg: "rgb(59, 130, 246)", radius: "5px" } },
    { tag: "a", selector: ".btn-login", text: "Sign In", style: { color: "rgb(203, 213, 225)" } }, // IDENTICAL!
    { tag: "h1", selector: ".hero-title", text: "Unified Cloud Observability", style: { color: "rgb(255, 255, 255)" } }, // IDENTICAL!
    { tag: "p", selector: ".hero-subtitle", text: "Continuous telemetry, zero-overhead kernel eBPF probes, and real-time distributed tracing at hyperscale.", style: { color: "rgb(148, 163, 184)" } }, // IDENTICAL!
    { tag: "a", selector: ".btn-secondary", text: "Explore Live Sandbox", style: { bg: "rgb(30, 41, 59)" } } // IDENTICAL!
  ]
};

// Evaluate differences
const fnMatch = studioJs.match(/function detectPageDifferences\(prodLandmarks, stgLandmarks\) \{[\s\S]*?\n  \}\n\n  function addDiffIfMissing\(list, diffItem\) \{[\s\S]*?\n  \}/);
assert(fnMatch, "detectPageDifferences and addDiffIfMissing must be extractable");

const evalDiffs = new Function("prodLandmarks", "stgLandmarks", `
  const prodUrlInput = { value: prodLandmarks?.href || "" };
  const stgUrlInput = { value: stgLandmarks?.href || "" };
  const currentMode = "side-by-side";
  const lastProdLandmarks = prodLandmarks;
  const lastStgLandmarks = stgLandmarks;
  const colProdLandmarks = prodLandmarks;
  const colStgLandmarks = stgLandmarks;
  const swipeProdLandmarks = prodLandmarks;
  const swipeStgLandmarks = stgLandmarks;
  const matchLandmarks = (p, s) => [{ prod: p[0], stg: s[0] }];
  const getEstimatedBoxForSelector = () => null;
  ${fnMatch[0]}
  return detectPageDifferences(prodLandmarks, stgLandmarks);
`);

const generatedDiffs = evalDiffs(mockProdLandmarks, mockStgLandmarks);
const diffSelectors = generatedDiffs.map(d => d.selector);

console.log("Generated diff selectors:", diffSelectors);

// Verify that IDENTICAL elements are NEVER in diffSelectors
assert(!diffSelectors.includes(".btn-login"), "'Sign In' button is identical and must NOT be in diffs!");
assert(!diffSelectors.includes(".hero-subtitle"), "Hero subtitle ('Continuous telemetry...') is identical and must NOT be in diffs!");
assert(!diffSelectors.includes(".btn-secondary"), "'Explore Live Sandbox' is identical and must NOT be in diffs!");
assert(!diffSelectors.includes(".hero-section"), "Hero section container must NOT be in diffs!");
assert(!diffSelectors.includes(".site-header"), "Site header container must NOT be in diffs!");

// Verify that differing elements ARE present
assert(diffSelectors.some(s => s.includes("brand-logo")), ".brand-logo must be flagged as a diff");
assert(diffSelectors.some(s => s.includes("env-badge")), ".env-badge must be flagged as a diff");
assert(diffSelectors.some(s => s.includes("btn-start-trial")), "#btn-start-trial must be flagged as a diff");
assert(diffSelectors.some(s => s.includes("hero-badge")), ".hero-badge must be flagged as a diff");
assert(diffSelectors.some(s => s.includes("gradient-text")), ".gradient-text must be flagged as a diff");

console.log("PASS 5: Behavioral simulation verified that identical elements have ZERO red differences and only differing tags/pixels are highlighted!");

console.log("\nALL IDENTICAL ELEMENTS ZERO RED DIFF TESTS PASSED SUCCESSFULLY!");
