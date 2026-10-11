# VisualCompare Live — Chrome Extension

A real-time dual-site visual regression and interaction testing extension for Google Chrome. Load any two URLs (Production vs. Staging, Localhost vs. Remote) side-by-side with mirrored user interactions, synchronized scrolling, split swipe curtain, flicker toggle, and pixel-diff overlays.

---

## ✨ Features

- **Mirrored Click & Interaction Engine:** Click any button, dropdown, navigation link, tab, or modal on one site, and the action is mirrored in real time on the second site.
- **Synchronized Scrolling & Typing:** Scroll positions and form inputs are mirrored synchronously between both frames with loop-prevention.
- **Ghost Pointer Cursor:** A real-time glowing cursor indicator reflects your mouse movement onto the counterpart site.
- **4 Live Comparison Modes:**
  1. **Side-by-Side (Sync):** 50/50 dual pane layout for simultaneous browsing and manual testing.
  2. **Swipe Split Curtain:** Drag a vertical divider handle across overlapping live frames to reveal micro-differences.
  3. **Flicker Toggle:** Rapidly switch between Production and Staging (automatically or via <kbd>Space</kbd>) to spot subtle layout shifts.
  4. **Diff Ghost Overlay:** Layer Staging directly on top of Production with an interactive Opacity Slider (0%–100%) and Difference blend mode.
- **DOM-Aware Layout Shift & Yellow Hazard Stripe Spacers:** Ports the alignment engine from VisualCompare Python (`diff_engine.py`, `matcher.py`, `dom_extractor.js`). When vertical space is added to one site (e.g. promotional alert banner, dynamic ticker, larger padding), the engine detects the landmark discrepancy and automatically inserts a **Yellow Hazard Stripe Spacer** (`#facc15` diagonal warning stripes) into the shorter counterpart to absorb the layout shift, keeping all content below aligned 1:1!
- **Universal Frame Support:** Uses Chrome's `declarativeNetRequest` API to bypass `X-Frame-Options` and CSP `frame-ancestors` restrictions, allowing virtually any website to load inside the studio.
- **Device Viewport Emulation:** Easily test Desktop (1920×1080), Laptop (1366×768), Tablet (768×1024), and Mobile (440×956).

---

## 🚀 How to Install in Chrome

1. Open **Google Chrome** (or Edge / Brave / Chromium).
2. Navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select this project directory:
   ```text
   C:\Users\ryguy\OneDrive\Documents\code\visualCompare-chrome-extension
   ```
6. The **VisualCompare Live** extension icon will now appear in your browser toolbar! Pin it for quick access.

---

## 📖 How to Use

1. Click the **VisualCompare** extension icon in your browser toolbar.
2. Enter your **Reference / Production URL** and **Candidate / Staging URL**:
   - Click **"⚡ Demo Test"** to instantly load the built-in ApexCloud benchmark (`demo_prod.html` vs `demo_stg.html`), which tests an added alert banner and button regressions.
   - Or click **"Use Current Tab"** to test live external websites.
3. Choose your device viewport and toggle desired sync features (Hazard Spacers, Clicks, Scroll, Ghost Cursor, Typing).
4. Click **"🚀 Launch Live Studio"**.
5. Inside the Live Studio tab:
   - Notice the **Yellow Hazard Stripe Spacer** automatically appear before the hero section on Production to absorb the added alert banner in Staging, keeping both pages in lockstep!
   - Toggle **⚠️ Yellow Hazard Spacers** in the toolbar to see the comparison with or without layout shift compensation.
   - Switch between **Side-by-Side**, **Swipe Split Curtain**, **Flicker Toggle**, and **Diff Ghost Overlay**.
   - Click **"📸 Run Diff"** to calculate pixel mismatch percentage with yellow hazard stripe visualization.
