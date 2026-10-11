// Automated test: Dimension change hazard spacer re-alignment & stability
const assert = require('assert');

// 1. Simulate getRawContentDimensions
function getRawContentDimensions(doc, win) {
  let spacerHeight = 0;
  doc.spacers.forEach(s => { spacerHeight += s.height; });
  const rawH = Math.max(0, doc.scrollHeight - spacerHeight);
  return {
    scrollWidth: doc.scrollWidth,
    scrollHeight: rawH,
    viewportWidth: win.innerWidth,
    viewportHeight: win.innerHeight
  };
}

// 2. Test stability: inserting spacer must NOT change rawContentDimensions
const mockDoc = {
  scrollWidth: 1200,
  scrollHeight: 2000,
  spacers: []
};
const mockWin = { innerWidth: 1200, innerHeight: 800 };

const dimBefore = getRawContentDimensions(mockDoc, mockWin);

// Insert a 120px yellow hazard spacer (increases doc scrollHeight by 120px)
mockDoc.spacers.push({ id: 'vc-spacer-sec-1', height: 120 });
mockDoc.scrollHeight += 120;

const dimAfter = getRawContentDimensions(mockDoc, mockWin);

assert.strictEqual(
  dimBefore.scrollHeight,
  dimAfter.scrollHeight,
  "Raw content height must remain identical when spacers are inserted (prevents infinite loop/flicker)!"
);
console.log("PASS: Spacer insertion does not trigger false dimension change loop.");

// 3. Test genuine dimension change detection
// When real content changes or window resizes:
mockDoc.scrollHeight += 250; // Real content expands by 250px!
const dimContentChange = getRawContentDimensions(mockDoc, mockWin);
const hDiff = Math.abs(dimContentChange.scrollHeight - dimAfter.scrollHeight);
assert.strictEqual(hDiff, 250, "Real content changes must be detected!");
console.log("PASS: Real content expansion detected accurately (+250px).");

// Window resize detection
mockWin.innerWidth = 800;
const dimResize = getRawContentDimensions(mockDoc, mockWin);
const vwDiff = Math.abs(dimResize.viewportWidth - dimAfter.viewportWidth);
assert.strictEqual(vwDiff, 400, "Window/viewport resize must be detected!");
console.log("PASS: Viewport resize detected accurately (1200 -> 800px).");

// 4. Test re-alignment calculation with new dimensions
function calculateShifts(prodLandmarks, stgLandmarks) {
  let totalDelta = 0;
  const spacersToApply = [];
  for (let i = 0; i < prodLandmarks.length; i++) {
    const p = prodLandmarks[i];
    const s = stgLandmarks[i];
    const diff = Math.abs(p.height - s.height);
    if (diff > 4) {
      totalDelta += diff;
      spacersToApply.push({
        target: p.height < s.height ? 'PROD' : 'STG',
        height: diff
      });
    }
  }
  return { totalDelta, spacersToApply };
}

// Initial state: Section 1 differs by 100px
const prodInitial = [{ name: 'Hero', height: 300 }, { name: 'Features', height: 400 }];
const stgInitial = [{ name: 'Hero', height: 400 }, { name: 'Features', height: 400 }];
const initialRun = calculateShifts(prodInitial, stgInitial);
assert.strictEqual(initialRun.totalDelta, 100);
assert.strictEqual(initialRun.spacersToApply[0].target, 'PROD');
console.log("PASS: Initial layout shift calculates +100px spacer in PROD.");

// Dimensions changed: Features section in STG is now +180px larger due to responsive wrap
const prodResized = [{ name: 'Hero', height: 350 }, { name: 'Features', height: 450 }];
const stgResized = [{ name: 'Hero', height: 400 }, { name: 'Features', height: 630 }];
const realignedRun = calculateShifts(prodResized, stgResized);
assert.strictEqual(realignedRun.totalDelta, (400 - 350) + (630 - 450)); // 50 + 180 = 230
console.log("PASS: Re-aligned run on dimension change successfully recalculated +230px total shift!");

console.log("ALL TESTS PASSED SUCCESSFULLY!");
