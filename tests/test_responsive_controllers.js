const fs = require('fs');
const assert = require('assert');

console.log("TEST: Validating Controllers Area responsive structure & styles...");

// 1. Verify studio.html markup
const html = fs.readFileSync('studio.html', 'utf8');

const requiredIds = [
  'studio-prod-url',
  'btn-reload-prod',
  'btn-swap-urls',
  'studio-stg-url',
  'btn-reload-stg',
  'btn-navigate-all',
  'viewport-select',
  'zoom-select',
  'btn-toggle-red-diffs',
  'btn-run-diff',
  'btn-export-zip',
  'btn-import-zip',
  'mode-btn-side',
  'mode-btn-swipe',
  'mode-btn-flicker',
  'mode-btn-overlay',
  'side-controls',
  'btn-toggle-col-diff',
  'swipe-controls',
  'btn-swipe-target-prod',
  'btn-swipe-target-diff',
  'metric-diff-badge',
  'metric-shift-badge',
  'metric-red-badge',
  'chip-sync-hazard',
  'chip-sync-red-diff',
  'chip-sync-clicks',
  'chip-sync-scroll',
  'chip-sync-hover',
  'chip-sync-inputs'
];

requiredIds.forEach(id => {
  assert(html.includes(`id="${id}"`), `Missing ID in studio.html: ${id}`);
});
console.log(`PASS: All ${requiredIds.length} critical controller element IDs exist in studio.html.`);

// 2. Verify responsive labels in HTML
assert(html.includes('btn-label-full') && html.includes('btn-label-short'), "Missing btn-label spans in studio.html");
assert(html.includes('mode-label-full') && html.includes('mode-label-short'), "Missing mode-label spans in studio.html");
assert(html.includes('chip-label-full') && html.includes('chip-label-short'), "Missing chip-label spans in studio.html");
console.log("PASS: HTML contains full and short label spans for buttons, mode tabs, and sync chips.");

// 3. Verify studio.js assigns both spans on dynamic updates
const js = require("./helpers").readStudioJs();
assert(js.includes('btn-label-full') && js.includes('btn-label-short'), "studio.js does not output responsive label spans");
console.log("PASS: studio.js dynamic updates preserve responsive label spans.");

// 4. Verify studio.css responsive breakpoints
const css = fs.readFileSync('studio.css', 'utf8');
assert(css.includes('@media (max-width: 1200px)'), "Missing 1200px breakpoint in studio.css");
assert(css.includes('@media (max-width: 768px)'), "Missing 768px breakpoint in studio.css");
assert(css.includes('@media (max-width: 640px)'), "Missing 640px breakpoint in studio.css");
assert(css.includes('@media (max-width: 440px)'), "Missing 440px breakpoint in studio.css");

// 5. Verify Mobile 2x2 URL Commander Grid rules
assert(css.includes('grid-template-columns: 1fr auto;'), "Missing 2x2 grid column definition in studio.css");
assert(css.includes('.btn-swap') && css.includes('.btn-nav'), "Missing button grid placement in studio.css");
assert(css.includes('.sync-toggles-bar') && css.includes('mask-image'), "Missing touch ribbon edge fade mask in studio.css");
console.log("PASS: All responsive CSS media queries, 2x2 URL grid, and touch ribbon styles verified.");

console.log("\nALL CONTROLLER RESPONSIVENESS TESTS PASSED!");
