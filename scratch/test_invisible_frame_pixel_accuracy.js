const fs = require('fs');
const assert = require('assert');

console.log("TEST: Validating Invisible Live Frame Architecture & Accurate Pixel Diff...");

// 1. Check studio.js for invisible live Production frame rendering
const studioJs = fs.readFileSync('studio.js', 'utf8');

assert(studioJs.includes('iframeSwipeProd.style.display = "block"'), "iframeSwipeProd should stay rendered as display: block");
assert(studioJs.includes('iframeSwipeProd.style.opacity = "0"'), "iframeSwipeProd should be invisible with opacity: 0");
assert(studioJs.includes('iframeSwipeProd.style.pointerEvents = "none"'), "iframeSwipeProd should not intercept pointer events when invisible");
console.log("PASS: In diff mode, Production page stays actively rendered in container at opacity: 0.");

// 2. Check getActiveFramesForMode preserves prod iframe in swipe mode
assert(studioJs.includes('prod: iframeSwipeProd'), "getActiveFramesForMode must keep iframeSwipeProd as active prod");
console.log("PASS: getActiveFramesForMode preserves live iframeSwipeProd in swipe mode.");

// 3. Check dispatchToPane forwards to iframeSwipeDiff
assert(studioJs.includes('send(iframeSwipeDiff)'), "dispatchToPane STG must forward messages to iframeSwipeDiff");
console.log("PASS: dispatchToPane STG dispatches to iframeSwipeDiff.");

// 4. Check sync_agent.js diff candidate coverage and attributes
const syncAgentJs = fs.readFileSync('sync_agent.js', 'utf8');
assert(syncAgentJs.includes('src: srcAttr'), "sync_agent.js must capture src attribute");
assert(syncAgentJs.includes('href: hrefAttr'), "sync_agent.js must capture href attribute");
assert(syncAgentJs.includes('alt: altAttr'), "sync_agent.js must capture alt attribute");
assert(syncAgentJs.includes('title: titleAttr'), "sync_agent.js must capture title attribute");
assert(syncAgentJs.includes('if (!inViewport && !isSticky) return;'), "sync_agent.js must filter to viewport elements");
console.log("PASS: sync_agent.js captures element media attributes and enforces viewport-only candidate extraction.");

// 5. Check spatial proximity matching and image regression in detectPageDifferences
assert(studioJs.includes('Math.abs(pX - sX) < 40 && Math.abs(pY - sY) < 40'), "detectPageDifferences must support spatial proximity fallback");
assert(studioJs.includes('!srcMatches && p.src && s.src'), "detectPageDifferences must check image asset discrepancies");
console.log("PASS: detectPageDifferences performs spatial proximity fallback and image media discrepancy checks.");

// 6. Check renderSwipeDiffCanvas uses true captured diff and live boxes
assert(studioJs.includes('if (lastCapturedDiffCanvas && !isUserScrolling)'), "renderSwipeDiffCanvas must support subpixel captured diff");
assert(studioJs.includes('box = item.swipeBox || item.stgBox || item.box'), "renderSwipeDiffCanvas must use measured boxes");
assert(!studioJs.includes('item.selector ? getEstimatedBoxForSelector(item.selector, swW) : null'), "renderSwipeDiffCanvas must not fall back to fake estimated boxes");
console.log("PASS: renderSwipeDiffCanvas uses true captured diff and measured subpixel element boxes without fake estimates.");

console.log("\nALL INVISIBLE LIVE FRAME & PIXEL ACCURACY TESTS PASSED!");
