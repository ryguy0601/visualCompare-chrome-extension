const assert = require("assert");

console.log("TEST 1: Simulating dynamic scroll pixel diff coordinate calculations...");

const viewportW = 480;
const viewportH = 800;

const mockDiffList = [
  {
    selector: ".brand-logo",
    label: "Brand Logo Accent Gradient",
    isSticky: true,
    box: { x: 24, y: 14, width: 36, height: 36 }
  },
  {
    selector: "#header-nav .nav-tab.active",
    label: "Overview Active Tab",
    isSticky: true,
    box: { x: 180, y: 14, width: 110, height: 36 }
  },
  {
    selector: ".metric-card:first-child .metric-value",
    label: "Metric Value Display",
    isSticky: false,
    box: { x: 48, y: 310, width: 140, height: 48 }
  },
  {
    selector: ".pricing-card:nth-child(2) .plan-price .amount",
    label: "Price Display",
    isSticky: false,
    box: { x: 200, y: 560, width: 120, height: 44 }
  },
  {
    selector: ".cta-submit",
    label: "CTA Button",
    isSticky: false,
    box: { x: 130, y: 920, width: 220, height: 48 }
  }
];

const mockShiftRegions = [
  { y: 72, h: 56, label: "+56px (inserted space)" }
];

function computeVisibleBoxes(diffList, shiftRegions, scrollY, scrollX = 0) {
  const visibleDiffs = [];
  diffList.forEach(item => {
    const isSticky = !!item.isSticky || 
                     (item.selector && (item.selector.includes("header") || 
                                       item.selector.includes(".brand-") || 
                                       item.selector.includes("#header-nav") || 
                                       item.selector.includes(".nav-tab") ||
                                       item.selector.includes("btn-login")));

    const drawX = isSticky ? item.box.x : (item.box.x - scrollX);
    const drawY = isSticky ? item.box.y : (item.box.y - scrollY);

    if (drawY + item.box.height < -10 || drawY > viewportH + 10) return;
    if (drawX + item.box.width < -10 || drawX > viewportW + 10) return;

    visibleDiffs.push({
      selector: item.selector,
      drawX,
      drawY,
      width: item.box.width,
      height: item.box.height,
      isSticky
    });
  });

  const visibleShifts = [];
  shiftRegions.forEach(reg => {
    const regY = reg.y - scrollY;
    if (regY + reg.h < -10 || regY > viewportH + 10) return;
    visibleShifts.push({
      y: regY,
      h: reg.h,
      label: reg.label
    });
  });

  return { visibleDiffs, visibleShifts };
}

// State 1: Scroll at top (scrollY = 0)
const atTop = computeVisibleBoxes(mockDiffList, mockShiftRegions, 0);
assert.strictEqual(atTop.visibleDiffs.length, 4, "At scrollY = 0, elements below 800px are not visible");
assert.strictEqual(atTop.visibleShifts.length, 1, "Alert banner shift region is visible at top");

const logoTop = atTop.visibleDiffs.find(d => d.selector === ".brand-logo");
assert.strictEqual(logoTop.drawY, 14, "Logo starts at y = 14");

const metricTop = atTop.visibleDiffs.find(d => d.selector.includes("metric-card"));
assert.strictEqual(metricTop.drawY, 310, "Metric starts at y = 310");
console.log("PASS: At scrollY = 0, initial viewport is mapped accurately.");

// State 2: Scroll down (scrollY = 350)
const scrolled = computeVisibleBoxes(mockDiffList, mockShiftRegions, 350);

// Sticky elements must remain pinned at y = 14!
const logoScrolled = scrolled.visibleDiffs.find(d => d.selector === ".brand-logo");
assert.strictEqual(logoScrolled.drawY, 14, "Sticky brand logo stays pinned at y = 14 on scroll!");

const tabScrolled = scrolled.visibleDiffs.find(d => d.selector.includes("nav-tab"));
assert.strictEqual(tabScrolled.drawY, 14, "Sticky nav tab stays pinned at y = 14 on scroll!");

// Metric card at 310 with height 48 is partially visible at scrollY = 350 (-40px top, 8px bottom showing)
const metricPartiallyScrolled = scrolled.visibleDiffs.find(d => d.selector.includes("metric-card"));
assert.strictEqual(metricPartiallyScrolled.drawY, -40, "Metric card at 310 partially visible with drawY = -40");

// Pricing at 560 should now be at 560 - 350 = 210!
const pricingScrolled = scrolled.visibleDiffs.find(d => d.selector.includes("pricing-card"));
assert.strictEqual(pricingScrolled.drawY, 210, "Pricing card moved dynamically to y = 210");

// CTA at 920 should now be visible at 920 - 350 = 570!
const ctaScrolled = scrolled.visibleDiffs.find(d => d.selector === ".cta-submit");
assert.strictEqual(ctaScrolled.drawY, 570, "CTA button entered viewport dynamically at y = 570");

// Alert banner at 72 - 350 = -278 with height 56 = -222 should be clipped
assert.strictEqual(scrolled.visibleShifts.length, 0, "Alert banner scrolled off screen is clipped");

// State 3: Scrolled further (scrollY = 380) - metric at 310 is fully off screen (drawY = -70, drawY + 48 = -22 < -10)
const fullyScrolled = computeVisibleBoxes(mockDiffList, mockShiftRegions, 380);
const metricFullyScrolled = fullyScrolled.visibleDiffs.find(d => d.selector.includes("metric-card"));
assert.strictEqual(metricFullyScrolled, undefined, "Metric card at 310 is fully clipped when scrolled past top");
console.log("PASS: At scrollY = 350, sticky elements stay pinned while content glides dynamically in lockstep.");

console.log("\nALL SCROLL DIFF TESTS PASSED! Dynamic scrolling is mathematically verified.");
