// Test nav link matching and fake mouse cursor
const assert = require('assert');

// Emulate minimal DOM for the navbar
class MockElement {
  constructor(tagName, textContent = '', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.textContent = textContent;
    this.attributes = attributes;
    this.classList = {
      _classes: new Set(),
      contains(c) { return this._classes.has(c); },
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      get length() { return this._classes.size; }
    };
    this.parentElement = null;
    this.children = [];
    this.style = {};
  }
  getAttribute(name) { return this.attributes[name] || null; }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
}

// Build navbar structure:
// <header class="site-header">
//   <div class="container header-inner">
//     <nav class="nav-links">
//       <a href="#features">Features</a>
//       <a href="#pricing">Pricing</a>
//       <a href="#customers">Customers</a>
//       <a href="#docs">Docs</a>
//     </nav>
//   </div>
// </header>
const header = new MockElement('header');
const container = new MockElement('div');
container.classList.add('container');
const nav = new MockElement('nav');
nav.classList.add('nav-links');

const aFeatures = new MockElement('a', 'Features', { href: '#features' });
const aPricing = new MockElement('a', 'Pricing', { href: '#pricing' });
const aCustomers = new MockElement('a', 'Customers', { href: '#customers' });
const aDocs = new MockElement('a', 'Docs', { href: '#docs' });

nav.appendChild(aFeatures);
nav.appendChild(aPricing);
nav.appendChild(aCustomers);
nav.appendChild(aDocs);
container.appendChild(nav);
header.appendChild(container);

// Mock CSS.escape
global.CSS = {
  escape: (str) => str.replace(/([#.:>+~])/g, '\\$1')
};

// Test getElementSelector
function getElementSelector(el) {
  if (!el || el.nodeType !== 1) return "";
  if (el.tagName === "A" && el.getAttribute("href")) {
    const href = el.getAttribute("href");
    if (!href.startsWith("javascript:")) {
      return `a[href="${CSS.escape(href)}"]`;
    }
  }

  let sel = el.tagName.toLowerCase();
  if (el.parentElement) {
    const sameTagSiblings = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName);
    if (sameTagSiblings.length > 1) {
      const idx = sameTagSiblings.indexOf(el) + 1;
      sel += `:nth-of-type(${idx})`;
    }
  }
  return sel;
}

const pricingSelector = getElementSelector(aPricing);
console.log('Selector for Pricing:', pricingSelector);
assert.strictEqual(pricingSelector, 'a[href="\\#pricing"]');

// Test matching logic
function findMatchingElement(action, allLinks) {
  // 1. Link matching by href
  if (action.href) {
    const link = allLinks.find(l => l.getAttribute('href') === action.href);
    if (link) return link;
  }
  // 2. Text matching
  if (action.text) {
    const clean = action.text.trim().toLowerCase();
    const link = allLinks.find(l => l.textContent.trim().toLowerCase() === clean);
    if (link) return link;
  }
  return null;
}

const allLinks = [aFeatures, aPricing, aCustomers, aDocs];

const action = {
  kind: 'hover',
  selector: pricingSelector,
  tagName: 'A',
  text: 'Pricing',
  href: '#pricing',
  pctX: 0.45,
  pctY: 0.05
};

const matched = findMatchingElement(action, allLinks);
console.log('Matched element text:', matched.textContent);
assert.strictEqual(matched.textContent, 'Pricing', 'Must match Pricing, NOT Features!');
console.log('PASS: Hovering over Pricing accurately matches Pricing on counterpart pane!');

// Test fake mouse SVG coordinates
const winW = 1000;
const winH = 800;
const fakeMouseX = Math.round(action.pctX * winW) - 4;
const fakeMouseY = Math.round(action.pctY * winH) - 2;
console.log(`Fake mouse positioned at: (${fakeMouseX}px, ${fakeMouseY}px)`);
assert.strictEqual(fakeMouseX, 446);
assert.strictEqual(fakeMouseY, 38);
console.log('PASS: Fake mouse coordinates computed accurately.');
console.log('ALL TESTS PASSED!');
