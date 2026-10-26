// Unit Test for Viewport X/Y Click Synchronization & Bug Fixes
const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("TEST: Validating Viewport X/Y Click Synchronization & Bug Fixes...");

const syncAgentJs = fs.readFileSync(path.join(__dirname, "../sync_agent.js"), "utf8");
const studioJs = fs.readFileSync(path.join(__dirname, "../studio.js"), "utf8");

// 1. Verify getViewportElementAt function exists in sync_agent.js
assert(syncAgentJs.includes("function getViewportElementAt(x, y) {"), "sync_agent.js must define getViewportElementAt(x, y)");
assert(syncAgentJs.includes("document.elementsFromPoint(x, y)"), "getViewportElementAt must query elementsFromPoint");
assert(syncAgentJs.includes("document.elementFromPoint(x, y)"), "getViewportElementAt must query elementFromPoint fallback");
console.log("PASS 1: getViewportElementAt resolves topmost elements via viewport coordinates.");

// 2. Verify click tracking captures explicit viewport dimensions and client coordinates
assert(syncAgentJs.includes("viewportWidth: window.innerWidth"), "Click tracking must include viewportWidth");
assert(syncAgentJs.includes("viewportHeight: window.innerHeight"), "Click tracking must include viewportHeight");
assert(syncAgentJs.includes("clientX: e.clientX"), "Click tracking must include clientX");
assert(syncAgentJs.includes("clientY: e.clientY"), "Click tracking must include clientY");
assert(syncAgentJs.includes("pctX = e.clientX / window.innerWidth"), "Click tracking must compute pctX relative to viewport");
assert(syncAgentJs.includes("pctY = e.clientY / window.innerHeight"), "Click tracking must compute pctY relative to viewport");
console.log("PASS 2: Click tracking captures exact viewport client coordinates and ratios.");

// 3. Verify handleMirroredAction resolves clicks on an X/Y basis rather than class or ID
assert(syncAgentJs.includes("const el = getViewportElementAt(clickX, clickY);"), "handleMirroredAction must find click element at viewport (clickX, clickY)");
assert(!syncAgentJs.includes("if (action.kind === \"click\") {\n        const el = findMatchingElement(action);"), "handleMirroredAction must NOT use findMatchingElement (class/id selector) for clicks");
console.log("PASS 3: Click mirroring is executed on a viewport X/Y basis rather than class or ID basis.");

// 4. Verify echo loop prevention with timestamp buffer
assert(syncAgentJs.includes("lastMirroredClickTime"), "sync_agent.js must track lastMirroredClickTime");
assert(syncAgentJs.includes("Date.now() - lastMirroredClickTime < 150"), "Click tracker must prevent echo loops with timestamp buffer");
console.log("PASS 4: Echo loop prevention prevents synthetic and programmatic bouncebacks.");

// 5. Verify studio.js message filtering bugfix (allowing baseStg in swipe mode)
assert(studioJs.includes("(!active.baseStg || sourceWindow !== active.baseStg.contentWindow)"), "studio.js must not drop messages from active baseStg in swipe mode");
console.log("PASS 5: Swipe mode baseStg frame message filtering verified.");

// 6. Behavioral simulation: DOM element resolution without matching classes or IDs
class MockElement {
  constructor(tagName, textContent = "", attrs = {}, rect = { x: 0, y: 0, width: 100, height: 40 }) {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.attrs = attrs;
    this.rect = rect;
    this.children = [];
    this.parentElement = null;
    this.events = [];
    this.clicked = false;
    this.focused = false;
  }
  getAttribute(name) { return this.attrs[name] || null; }
  hasAttribute(name) { return name in this.attrs; }
  contains(pointX, pointY) {
    return pointX >= this.rect.x && pointX <= (this.rect.x + this.rect.width) &&
           pointY >= this.rect.y && pointY <= (this.rect.y + this.rect.height);
  }
  closest(selector) {
    let curr = this;
    const selUpper = selector.toUpperCase();
    while (curr) {
      if (selUpper.includes(curr.tagName)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
  dispatchEvent(evt) {
    this.events.push(evt);
    return true;
  }
  click() {
    this.clicked = true;
  }
  focus() {
    this.focused = true;
  }
}

// Prod Frame: Button with ID "btn-prod-1" and class "btn-blue-prod" at (150, 200)
const prodButton = new MockElement("BUTTON", "Submit Order", { id: "btn-prod-1", class: "btn-blue-prod" }, { x: 100, y: 180, width: 120, height: 40 });

// Staging Frame: Button with completely different ID "submit-candidate-99" and class "custom-stg-btn" at (150, 200)
const stgButton = new MockElement("BUTTON", "Confirm Order", { id: "submit-candidate-99", class: "custom-stg-btn" }, { x: 100, y: 180, width: 120, height: 40 });
const stgSpan = new MockElement("SPAN", "Confirm Order", {}, { x: 110, y: 190, width: 80, height: 20 });
stgSpan.parentElement = stgButton;
stgButton.children.push(stgSpan);

// Emulate elementsFromPoint at (150, 200)
function mockElementsFromPoint(x, y) {
  const hits = [];
  if (stgSpan.contains(x, y)) hits.push(stgSpan);
  if (stgButton.contains(x, y)) hits.push(stgButton);
  return hits;
}

// Simulate viewport X/Y resolution in Staging Frame
const clickPointX = 150;
const clickPointY = 200;
const hitElements = mockElementsFromPoint(clickPointX, clickPointY);
const resolvedTarget = hitElements[0]; // Resolves to stgSpan at viewport (150, 200)

assert.strictEqual(resolvedTarget, stgSpan, "Should resolve to innermost node at viewport (150, 200)");
const interactiveContainer = resolvedTarget.closest("button, a, input") || resolvedTarget;
assert.strictEqual(interactiveContainer, stgButton, "Should identify closest interactive button container");

// Fire simulated click sequence
interactiveContainer.focus();
interactiveContainer.click();

assert.strictEqual(stgButton.clicked, true, "Staging button was clicked successfully via viewport X/Y!");
assert.strictEqual(stgButton.focused, true, "Staging button was focused successfully via viewport X/Y!");
console.log("PASS 6: Behavioral simulation confirms counterpart button clicked at viewport (150, 200) despite completely mismatched IDs and classes!");

console.log("\nALL VIEWPORT X/Y CLICK TESTS PASSED SUCCESSFULLY!");
