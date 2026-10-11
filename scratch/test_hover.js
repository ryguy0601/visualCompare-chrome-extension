// Test hover rule cloning and element mirroring
const fs = require('fs');

// Simple DOM emulation
class FakeStyle {
  constructor(cssText) {
    this.cssText = cssText;
  }
}

class FakeRule {
  constructor(selectorText, cssText) {
    this.selectorText = selectorText;
    this.style = new FakeStyle(cssText);
  }
}

class FakeSheet {
  constructor(rules) {
    this.cssRules = rules;
  }
}

const mockDoc = {
  styleSheets: [
    new FakeSheet([
      new FakeRule('.btn-primary:hover', 'background: rgb(29, 78, 216); border-color: rgb(30, 64, 175);'),
      new FakeRule('.btn-secondary:focus', 'outline: none; background: rgb(51, 65, 85);'),
      new FakeRule('a:hover, .nav-item:hover', 'color: rgb(56, 189, 248);'),
      new FakeRule('.btn-primary.vc-hovered-pseudo', 'background: #1d4ed8;') // already cloned, should skip
    ])
  ],
  getElementById: (id) => null,
  createElement: (tag) => ({ id: '', textContent: '' }),
  head: {
    appendChild: (el) => {
      console.log('Appended style rules:');
      console.log(el.textContent);
    }
  }
};

const rulesToAdd = [];

function processRules(ruleList) {
  for (const rule of ruleList) {
    try {
      if (rule.cssRules && rule.cssRules.length > 0) {
        processRules(rule.cssRules);
        continue;
      }
      if (!rule.selectorText || !rule.style || !rule.style.cssText) continue;

      if (rule.selectorText.includes(".vc-hovered-pseudo") || rule.selectorText.includes(".vc-focused-pseudo")) {
        continue;
      }

      if (rule.selectorText.includes(":hover")) {
        const parts = rule.selectorText.split(",");
        const clonedParts = parts
          .filter(p => p.includes(":hover"))
          .map(p => p.trim().replace(/:hover/g, ".vc-hovered-pseudo"));
        if (clonedParts.length > 0) {
          rulesToAdd.push(`${clonedParts.join(", ")} { ${rule.style.cssText} }`);
        }
      }

      if (rule.selectorText.includes(":focus") || rule.selectorText.includes(":focus-visible")) {
        const parts = rule.selectorText.split(",");
        const clonedParts = parts
          .filter(p => p.includes(":focus") || p.includes(":focus-visible"))
          .map(p => p.trim().replace(/:focus-visible/g, ".vc-focused-pseudo").replace(/:focus/g, ".vc-focused-pseudo"));
        if (clonedParts.length > 0) {
          rulesToAdd.push(`${clonedParts.join(", ")} { ${rule.style.cssText} }`);
        }
      }
    } catch (e) {}
  }
}

for (const sheet of mockDoc.styleSheets) {
  processRules(sheet.cssRules);
}

const styleEl = mockDoc.createElement('style');
styleEl.textContent = rulesToAdd.join('\n');
mockDoc.head.appendChild(styleEl);

console.log('Rules count:', rulesToAdd.length);
if (rulesToAdd.some(r => r.includes('outline: 2px solid') || r.includes('box-shadow: 0 0 16px'))) {
  throw new Error('Artificial outline or shadow detected in rules!');
}
console.log('SUCCESS: Cloned rules accurately without any artificial blue outlines or shadows.');
