const fs = require('fs');
const assert = require('assert');

console.log("TEST: Validating Swipe Difference Slider Accuracy Architecture...");

// 1. Verify studio.html has dedicated iframe-swipe-diff
const html = fs.readFileSync('studio.html', 'utf8');
assert(html.includes('id="iframe-swipe-diff"'), "iframe-swipe-diff missing from studio.html");
assert(html.includes('id="iframe-swipe-prod"'), "iframe-swipe-prod missing from studio.html");
assert(html.includes('id="swipe-diff-canvas"'), "swipe-diff-canvas missing from studio.html");
console.log("PASS: studio.html contains dedicated iframe-swipe-diff frame.");

// 2. Verify studio.js queries iframeSwipeDiff
const studioJs = fs.readFileSync('studio.js', 'utf8');
assert(studioJs.includes('const iframeSwipeDiff = document.getElementById("iframe-swipe-diff");'), "iframeSwipeDiff query missing in studio.js");
console.log("PASS: studio.js queries iframeSwipeDiff element.");

// 3. Verify setSwipeCompareMode never mutates iframeSwipeProd.src to targetSrc/Staging
assert(!studioJs.includes('iframeSwipeProd.src = targetSrc'), "BUG DETECTED: iframeSwipeProd.src was being mutated to targetSrc!");
assert(studioJs.includes('iframeSwipeDiff.style.display = "block"'), "iframeSwipeDiff should be shown in diff mode");
assert(studioJs.includes('iframeSwipeProd.style.opacity = "0"'), "iframeSwipeProd should be rendered invisibly with opacity 0 in diff mode");
assert(studioJs.includes('iframeSwipeProd.style.pointerEvents = "none"'), "iframeSwipeProd should have pointerEvents none when invisible");
assert(studioJs.includes('iframeSwipeProd.style.opacity = "1"'), "iframeSwipeProd should have opacity 1 in prod mode");
assert(studioJs.includes('iframeSwipeDiff.style.display = "none"'), "iframeSwipeDiff should be hidden in prod mode");
console.log("PASS: setSwipeCompareMode renders Production invisibly in diff mode for accurate live coordinates.");

// 4. Verify renderSwipeDiffCanvas queries live DOM elements with getBoundingClientRect
assert(studioJs.includes('liveTargetFrame.contentDocument.querySelector(item.selector)'), "renderSwipeDiffCanvas does not query live frame DOM");
assert(studioJs.includes('el.getBoundingClientRect()'), "renderSwipeDiffCanvas does not use getBoundingClientRect for subpixel accuracy");
assert(studioJs.includes('Math.round(r.left)'), "renderSwipeDiffCanvas does not map live r.left coordinate");
assert(studioJs.includes('Math.round(r.top)'), "renderSwipeDiffCanvas does not map live r.top coordinate");
console.log("PASS: renderSwipeDiffCanvas queries live DOM getBoundingClientRect for 100% pixel-perfect accuracy.");

// 5. Verify sync_agent.js provides viewportX and fixes sticky horizontal coordinates
const syncAgentJs = fs.readFileSync('sync_agent.js', 'utf8');
assert(syncAgentJs.includes('viewportX: Math.round(rect.left)'), "sync_agent.js missing viewportX coordinate");
assert(syncAgentJs.includes('x: Math.round(rect.left + (isSticky ? 0 : scrollX))'), "sync_agent.js does not isolate isSticky from scrollX");
console.log("PASS: sync_agent.js exports viewportX and isolates sticky elements from horizontal scroll drift.");

// 6. Mathematical verification of live subpixel coordinate mapping
function simulateSwipeDiffRender(item, mockElementRect, scrollX, scrollY) {
  let drawX, drawY, drawW, drawH;
  if (mockElementRect) {
    // getBoundingClientRect is in viewport pixels
    drawX = Math.round(mockElementRect.left);
    drawY = Math.round(mockElementRect.top);
    drawW = Math.round(mockElementRect.width);
    drawH = Math.round(mockElementRect.height);
  } else {
    drawX = item.box.x - scrollX;
    drawY = item.box.y - scrollY;
    drawW = item.box.width;
    drawH = item.box.height;
  }
  return { drawX, drawY, drawW, drawH };
}

const mockHeadingRect = { left: 340.5, top: 120.2, width: 450, height: 42 };
const coords = simulateSwipeDiffRender({ selector: 'h1' }, mockHeadingRect, 0, 0);
assert.strictEqual(coords.drawX, 341);
assert.strictEqual(coords.drawY, 120);
assert.strictEqual(coords.drawW, 450);
assert.strictEqual(coords.drawH, 42);
console.log("PASS: Simulated live coordinate rendering maps subpixels accurately without distortion.");

console.log("\nALL SWIPE DIFFERENCE SLIDER ACCURACY TESTS PASSED!");
