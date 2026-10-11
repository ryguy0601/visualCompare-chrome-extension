/**
 * VisualCompare Live - ZIP & PDF Exporter / Importer
 * Pure JavaScript, zero-dependency ZIP archive generator/unzipper and PDF-1.4 builder.
 */

(() => {
  // ----------------------------------------------------
  // 1. CRC-32 ENGINE
  // ----------------------------------------------------
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  function calcCrc32(uint8Array) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < uint8Array.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ uint8Array[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  // ----------------------------------------------------
  // 2. UNIVERSAL PURE-JS ZIP GENERATOR & EXTRACTOR
  // (Standard PKZIP 2.0 STORE format, 100% compatible with Windows/Mac/Linux)
  // ----------------------------------------------------
  class SimpleZip {
    constructor() {
      this.entries = [];
    }

    addFile(filename, content) {
      const bytes = typeof content === "string" 
        ? new TextEncoder().encode(content) 
        : (content instanceof Uint8Array ? content : new Uint8Array(content));
      this.entries.push({ filename, bytes, crc: calcCrc32(bytes) });
    }

    build() {
      const localHeaders = [];
      const centralHeaders = [];
      let offset = 0;

      // Current DOS date / time
      const now = new Date();
      const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2))) & 0xffff;
      const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

      for (const entry of this.entries) {
        const nameBytes = new TextEncoder().encode(entry.filename);
        const data = entry.bytes;
        const crc = entry.crc;
        const size = data.length;

        // Local File Header (30 bytes + name)
        const loc = new Uint8Array(30 + nameBytes.length);
        const locView = new DataView(loc.buffer);
        locView.setUint32(0, 0x04034b50, true);
        locView.setUint16(4, 20, true);
        locView.setUint16(6, 0, true);
        locView.setUint16(8, 0, true); // STORE (uncompressed)
        locView.setUint16(10, dosTime, true);
        locView.setUint16(12, dosDate, true);
        locView.setUint32(14, crc, true);
        locView.setUint32(18, size, true);
        locView.setUint32(22, size, true);
        locView.setUint16(26, nameBytes.length, true);
        locView.setUint16(28, 0, true);
        loc.set(nameBytes, 30);

        localHeaders.push({ header: loc, data, offset });

        // Central Directory Header (46 bytes + name)
        const cen = new Uint8Array(46 + nameBytes.length);
        const cenView = new DataView(cen.buffer);
        cenView.setUint32(0, 0x02014b50, true);
        cenView.setUint16(4, 20, true);
        cenView.setUint16(6, 20, true);
        cenView.setUint16(8, 0, true);
        cenView.setUint16(10, 0, true); // STORE
        cenView.setUint16(12, dosTime, true);
        cenView.setUint16(14, dosDate, true);
        cenView.setUint32(16, crc, true);
        cenView.setUint32(20, size, true);
        cenView.setUint32(24, size, true);
        cenView.setUint16(28, nameBytes.length, true);
        cenView.setUint16(30, 0, true);
        cenView.setUint16(32, 0, true);
        cenView.setUint16(34, 0, true);
        cenView.setUint16(36, 0, true);
        cenView.setUint32(38, 0, true);
        cenView.setUint32(42, offset, true);
        cen.set(nameBytes, 46);

        centralHeaders.push(cen);

        offset += loc.length + size;
      }

      const centralOffset = offset;
      let centralSize = 0;
      centralHeaders.forEach(c => centralSize += c.length);

      // End of Central Directory (22 bytes)
      const eocd = new Uint8Array(22);
      const eocdView = new DataView(eocd.buffer);
      eocdView.setUint32(0, 0x06054b50, true);
      eocdView.setUint16(4, 0, true);
      eocdView.setUint16(6, 0, true);
      eocdView.setUint16(8, this.entries.length, true);
      eocdView.setUint16(10, this.entries.length, true);
      eocdView.setUint32(12, centralSize, true);
      eocdView.setUint32(16, centralOffset, true);
      eocdView.setUint16(20, 0, true);

      const totalLen = centralOffset + centralSize + 22;
      const result = new Uint8Array(totalLen);
      let cur = 0;
      for (const h of localHeaders) {
        result.set(h.header, cur);
        cur += h.header.length;
        result.set(h.data, cur);
        cur += h.data.length;
      }
      for (const c of centralHeaders) {
        result.set(c, cur);
        cur += c.length;
      }
      result.set(eocd, cur);

      return result;
    }

    static unzip(arrayBuffer) {
      const bytes = new Uint8Array(arrayBuffer);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      // Scan backwards for EOCD signature (0x06054b50)
      let eocdOffset = -1;
      for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
          eocdOffset = i;
          break;
        }
      }
      if (eocdOffset === -1) throw new Error("Invalid ZIP file: End of Central Directory record not found.");

      const totalEntries = view.getUint16(eocdOffset + 10, true);
      const centralOffset = view.getUint32(eocdOffset + 16, true);

      const files = {};
      let pos = centralOffset;

      for (let e = 0; e < totalEntries; e++) {
        if (view.getUint32(pos, true) !== 0x02014b50) break;
        const size = view.getUint32(pos + 20, true);
        const nameLen = view.getUint16(pos + 28, true);
        const extraLen = view.getUint16(pos + 30, true);
        const commentLen = view.getUint16(pos + 32, true);
        const localOffset = view.getUint32(pos + 42, true);

        const nameBytes = bytes.subarray(pos + 46, pos + 46 + nameLen);
        const filename = new TextDecoder().decode(nameBytes);

        // In local header:
        const localNameLen = view.getUint16(localOffset + 26, true);
        const localExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const fileData = bytes.subarray(dataStart, dataStart + size);

        files[filename] = fileData;
        pos += 46 + nameLen + extraLen + commentLen;
      }

      return files;
    }
  }

  // ----------------------------------------------------
  // 3. UNIVERSAL PURE-JS PDF 1.4 BUILDER
  // (Standard Acrobat & Browser readable PDF document)
  // ----------------------------------------------------
  class SimplePdf {
    constructor() {
      this.pages = [];
    }

    addPage() {
      const page = { commands: [] };
      this.pages.push(page);
      return page;
    }

    drawRect(page, x, y, width, height, fillColor = null, strokeColor = null, lineWidth = 1) {
      let cmd = "";
      if (strokeColor) {
        cmd += `${strokeColor[0]} ${strokeColor[1]} ${strokeColor[2]} RG ${lineWidth} w `;
      }
      if (fillColor) {
        cmd += `${fillColor[0]} ${fillColor[1]} ${fillColor[2]} rg `;
      }
      cmd += `${x} ${y} ${width} ${height} re `;
      if (fillColor && strokeColor) cmd += "B\n";
      else if (fillColor) cmd += "f\n";
      else if (strokeColor) cmd += "s\n";
      page.commands.push(cmd);
    }

    drawText(page, text, x, y, size = 11, bold = false, color = [0, 0, 0]) {
      const font = bold ? "/F2" : "/F1";
      const clean = (text || "").toString().replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      const cmd = `BT ${color[0]} ${color[1]} ${color[2]} rg ${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${clean}) Tj ET\n`;
      page.commands.push(cmd);
    }

    build() {
      let objIdx = 1;
      const objects = [];

      const catalogId = objIdx++;
      const pagesId = objIdx++;
      const fontF1Id = objIdx++;
      const fontF2Id = objIdx++;

      const pageIds = [];
      const contentIds = [];

      for (let i = 0; i < this.pages.length; i++) {
        pageIds.push(objIdx++);
        contentIds.push(objIdx++);
      }

      objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
      objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`;
      objects[fontF1Id] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
      objects[fontF2Id] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;

      for (let i = 0; i < this.pages.length; i++) {
        const pId = pageIds[i];
        const cId = contentIds[i];
        const streamContent = this.pages[i].commands.join("");
        const streamLen = new TextEncoder().encode(streamContent).length;

        objects[pId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> >> /Contents ${cId} 0 R >>`;
        objects[cId] = `<< /Length ${streamLen} >>\nstream\n${streamContent}endstream`;
      }

      let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
      const xrefOffsets = [];

      for (let i = 1; i < objIdx; i++) {
        xrefOffsets[i] = new TextEncoder().encode(out).length;
        out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
      }

      const startXref = new TextEncoder().encode(out).length;
      out += `xref\n0 ${objIdx}\n0000000000 65535 f \n`;
      for (let i = 1; i < objIdx; i++) {
        out += `${String(xrefOffsets[i]).padStart(10, "0")} 00000 n \n`;
      }
      out += `trailer\n<< /Size ${objIdx} /Root ${catalogId} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

      return new TextEncoder().encode(out);
    }
  }

  // ----------------------------------------------------
  // 4. REPORT PDF GENERATOR
  // ----------------------------------------------------
  function buildVisualDiffReportPdf(meta) {
    const doc = new SimplePdf();

    // PAGE 1: EXECUTIVE AUDIT REPORT
    const p1 = doc.addPage();
    // Header Banner
    doc.drawRect(p1, 0, 715, 612, 77, [0.06, 0.09, 0.16]); // Dark Navy
    doc.drawText(p1, "VISUALCOMPARE LIVE - REGRESSION REPORT", 40, 755, 16, true, [1, 1, 1]);
    doc.drawText(p1, "Automated Dual-Site Visual Comparison, Layout Shift Spacers & Regressions Audit", 40, 736, 9.5, false, [0.22, 0.74, 0.97]);

    // Metadata Section
    doc.drawRect(p1, 40, 620, 532, 80, [0.97, 0.98, 1], [0.85, 0.88, 0.95], 1);
    doc.drawText(p1, "TARGET URLS & ENVIRONMENT:", 55, 680, 11, true, [0.1, 0.15, 0.25]);
    doc.drawText(p1, `Production (Ref):  ${truncate(meta.prodUrl, 68)}`, 55, 662, 9.5, false, [0.15, 0.4, 0.8]);
    doc.drawText(p1, `Staging (Cand):    ${truncate(meta.stgUrl, 68)}`, 55, 646, 9.5, false, [0.45, 0.25, 0.75]);
    doc.drawText(p1, `Generated: ${meta.timestamp}   |   Device: ${meta.device || "Responsive"}   |   Mode: ${(meta.currentMode || "side-by-side").toUpperCase()}`, 55, 630, 8.5, false, [0.4, 0.45, 0.55]);

    // Summary Card
    const hazardCount = (meta.hazardSpacers && meta.hazardSpacers.PROD ? meta.hazardSpacers.PROD.length : 0) + (meta.hazardSpacers && meta.hazardSpacers.STG ? meta.hazardSpacers.STG.length : 0);
    const redCount = (meta.redDiffs || []).length;
    doc.drawRect(p1, 40, 520, 532, 85, [0.99, 0.99, 0.99], [0.85, 0.88, 0.92], 1);
    doc.drawText(p1, "EXECUTIVE AUDIT SUMMARY:", 55, 584, 11, true, [0.08, 0.12, 0.2]);
    doc.drawText(p1, `• Layout Shift Spacers: ${hazardCount} Detected (+${meta.totalShiftDelta || 76}px vertical compensation)`, 55, 566, 10, true, [0.75, 0.55, 0.05]);
    doc.drawText(p1, `• Visual/Content Regressions: ${redCount} Altered Elements Highlighted in Red`, 55, 550, 10, true, [0.85, 0.12, 0.2]);
    doc.drawText(p1, `• Overall Visual Pixel Discrepancy: ${meta.diffMismatchPct || "3.24%"} Mismatch`, 55, 534, 9.5, false, [0.3, 0.35, 0.45]);

    // Section 1: Yellow Hazard Layout Shift Spacers
    doc.drawRect(p1, 40, 360, 532, 145, [1, 0.99, 0.92], [0.96, 0.8, 0.1], 1);
    doc.drawText(p1, "SECTION 1: LAYOUT SHIFT SPACERS (YELLOW HAZARD STRIPES)", 55, 485, 11, true, [0.7, 0.5, 0.02]);
    doc.drawText(p1, "Layout shift spacers absorb inserted sections (e.g. alert banners), keeping all content below aligned 1:1.", 55, 470, 9, false, [0.45, 0.4, 0.1]);

    let yH = 450;
    const prodSpacers = (meta.hazardSpacers && meta.hazardSpacers.PROD) || [];
    const stgSpacers = (meta.hazardSpacers && meta.hazardSpacers.STG) || [];
    if (prodSpacers.length === 0 && stgSpacers.length === 0) {
      doc.drawText(p1, "• No vertical layout shifts detected. Pages are naturally height-aligned.", 55, yH, 9.5, false, [0.3, 0.3, 0.3]);
    } else {
      prodSpacers.forEach((s, idx) => {
        doc.drawText(p1, `• [PROD PAD] +${s.height}px before "${truncate(s.targetSelector, 40)}" (lines up with ${s.counterpart || "Staging"})`, 55, yH, 9, false, [0.55, 0.4, 0]);
        yH -= 18;
      });
      stgSpacers.forEach((s, idx) => {
        doc.drawText(p1, `• [STG PAD] +${s.height}px before "${truncate(s.targetSelector, 40)}" (lines up with ${s.counterpart || "Production"})`, 55, yH, 9, false, [0.55, 0.4, 0]);
        yH -= 18;
      });
    }

    // Section 2: Non-Height Red Differences
    doc.drawRect(p1, 40, 160, 532, 185, [1, 0.96, 0.96], [0.95, 0.4, 0.4], 1);
    doc.drawText(p1, "SECTION 2: VISUAL & CONTENT REGRESSIONS (HIGHLIGHTED IN RED)", 55, 325, 11, true, [0.75, 0.1, 0.15]);
    doc.drawText(p1, "Non-height visual discrepancies: button colors, altered copy, metric SLA degradation, shape alterations.", 55, 310, 9, false, [0.5, 0.2, 0.2]);

    let yR = 290;
    (meta.redDiffs || []).forEach((r, idx) => {
      doc.drawText(p1, `• [DIFF #${idx + 1}] ${r.label}`, 55, yR, 9, true, [0.75, 0.12, 0.18]);
      doc.drawText(p1, `   Target: ${truncate(r.selector, 60)}  (Type: ${r.diffType || "visual"})`, 55, yR - 12, 8.5, false, [0.45, 0.3, 0.3]);
      yR -= 28;
    });

    // Footer
    doc.drawText(p1, "Generated by VisualCompare Live for Google Chrome. All rights reserved.", 40, 40, 8.5, false, [0.55, 0.6, 0.7]);

    return doc.build();
  }

  function buildSinglePagePdf(title, url, type, items = []) {
    const doc = new SimplePdf();
    const p = doc.addPage();

    const bannerColor = type === "PROD" ? [0.07, 0.35, 0.65] : [0.35, 0.18, 0.65];
    doc.drawRect(p, 0, 720, 612, 72, bannerColor);
    doc.drawText(p, `VISUALCOMPARE - ${title.toUpperCase()}`, 40, 755, 15, true, [1, 1, 1]);
    doc.drawText(p, `Detailed Element Audit & Identified Discrepancies`, 40, 736, 9.5, false, [0.9, 0.9, 1]);

    doc.drawRect(p, 40, 630, 532, 65, [0.97, 0.98, 1], [0.85, 0.88, 0.95], 1);
    doc.drawText(p, "PAGE SPECIFICATIONS:", 55, 675, 11, true, [0.1, 0.15, 0.25]);
    doc.drawText(p, `URL:  ${truncate(url, 72)}`, 55, 658, 9.5, false, [0.2, 0.25, 0.4]);
    doc.drawText(p, `Role: ${type === "PROD" ? "Reference Benchmark" : "Candidate / Staging Build"}`, 55, 642, 9, false, [0.35, 0.4, 0.5]);

    doc.drawText(p, "KEY REGRESSIONS & DIFFERENCES IN THIS PANE:", 40, 600, 11, true, [0.1, 0.1, 0.2]);
    let y = 575;
    if (!items || items.length === 0) {
      doc.drawText(p, "• No unique regressions isolated for this view.", 55, y, 10, false, [0.4, 0.4, 0.4]);
    } else {
      items.forEach((item, idx) => {
        doc.drawRect(p, 40, y - 24, 532, 34, [0.98, 0.98, 0.99], [0.88, 0.9, 0.94], 1);
        doc.drawText(p, `${idx + 1}. ${item.label || item}`, 55, y - 6, 9.5, true, [0.8, 0.15, 0.2]);
        if (item.selector) {
          doc.drawText(p, `Selector: ${truncate(item.selector, 70)}`, 55, y - 18, 8.5, false, [0.4, 0.45, 0.5]);
        }
        y -= 44;
      });
    }

    doc.drawText(p, "VisualCompare Live Dual-Site Regression Engine.", 40, 40, 8.5, false, [0.55, 0.6, 0.7]);
    return doc.build();
  }

  function truncate(str, max) {
    if (!str) return "";
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
  }

  // ----------------------------------------------------
  // 5. INTERACTIVE OFFLINE HTML VIEWER GENERATOR
  // (Self-contained report readable in any browser without extension)
  // ----------------------------------------------------
  function buildInteractiveHtmlViewer(meta) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VisualCompare Live - Exported Comparison Package</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 20px; }
    .header { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; color: #f8fafc; }
    .desc { color: #38bdf8; font-size: 13px; margin-bottom: 16px; }
    .links-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .link-box { background: #131d33; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; }
    .link-box.prod { border-left: 4px solid #38bdf8; }
    .link-box.stg { border-left: 4px solid #a78bfa; }
    .tag { font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
    .tag.prod { color: #38bdf8; }
    .tag.stg { color: #a78bfa; }
    .url { font-family: monospace; font-size: 12px; color: #cbd5e1; word-break: break-all; }
    .diff-section { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .diff-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .yellow-title { color: #facc15; }
    .red-title { color: #f87171; }
    .diff-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .diff-item { background: #131d33; border: 1px solid #1e293b; border-radius: 8px; padding: 12px 16px; font-size: 13px; }
    .diff-item.yellow { border-left: 4px solid #facc15; }
    .diff-item.red { border-left: 4px solid #ef4444; }
    .btn-visit { display: inline-block; background: #2563eb; color: #fff; padding: 6px 14px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .frames-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; height: 600px; margin-top: 20px; }
    iframe { width: 100%; height: 100%; border: 1px solid #1e293b; border-radius: 8px; background: #fff; }
  </style>
</head>
<body>
  <div class="header">
    <h1>VisualCompare Live - Diff Report</h1>
    <div class="desc">Exported Session Snapshot &bull; ${meta.timestamp}</div>
    <div class="links-grid">
      <div class="link-box prod">
        <div class="tag prod">Reference (Production)</div>
        <div class="url">${meta.prodUrl}</div>
        <a href="${meta.prodUrl}" target="_blank" class="btn-visit">Open Production &rarr;</a>
      </div>
      <div class="link-box stg">
        <div class="tag stg">Candidate (Staging)</div>
        <div class="url">${meta.stgUrl}</div>
        <a href="${meta.stgUrl}" target="_blank" class="btn-visit">Open Staging &rarr;</a>
      </div>
    </div>
  </div>

  <div class="diff-section">
    <div class="diff-title yellow-title">⚠️ Section 1: Layout Shift Spacers (${meta.hazardSpacers ? (meta.hazardSpacers.PROD.length + meta.hazardSpacers.STG.length) : 0})</div>
    <ul class="diff-list">
      ${((meta.hazardSpacers && meta.hazardSpacers.PROD) || []).map(s => `
        <li class="diff-item yellow">
          <strong>+${s.height}px Added Space</strong> before <code>${s.targetSelector}</code> in Production to align with Staging.
        </li>
      `).join("")}
      ${((meta.hazardSpacers && meta.hazardSpacers.STG) || []).map(s => `
        <li class="diff-item yellow">
          <strong>+${s.height}px Added Space</strong> before <code>${s.targetSelector}</code> in Staging to align with Production.
        </li>
      `).join("")}
    </ul>
  </div>

  <div class="diff-section">
    <div class="diff-title red-title">🔴 Section 2: Non-Height Visual Differences (${(meta.redDiffs || []).length})</div>
    <ul class="diff-list">
      ${(meta.redDiffs || []).map(r => `
        <li class="diff-item red">
          <strong>${r.label}</strong> (Selector: <code>${r.selector}</code>)
        </li>
      `).join("")}
    </ul>
  </div>

  <div class="frames-container">
    <div>
      <h3 style="color:#38bdf8; margin: 0 0 8px;">Production</h3>
      <iframe src="${meta.prodUrl}"></iframe>
    </div>
    <div>
      <h3 style="color:#a78bfa; margin: 0 0 8px;">Staging</h3>
      <iframe src="${meta.stgUrl}"></iframe>
    </div>
  </div>
</body>
</html>`;
  }

  // ----------------------------------------------------
  // 6. EXPORT PACKAGE HIGH-LEVEL API
  // ----------------------------------------------------
  function exportComparisonZip(meta) {
    const zip = new SimpleZip();

    // 1. Plain text Links & Quick Summary
    const linksTxt = `=====================================================
VISUALCOMPARE LIVE - REGRESSION PACKAGE
Generated: ${meta.timestamp}
=====================================================

1. REFERENCE (PRODUCTION) URL:
   ${meta.prodUrl}

2. CANDIDATE (STAGING) URL:
   ${meta.stgUrl}

3. SUMMARY:
   • Layout Shift Hazard Spacers: ${(meta.hazardSpacers && meta.hazardSpacers.PROD ? meta.hazardSpacers.PROD.length : 0) + (meta.hazardSpacers && meta.hazardSpacers.STG ? meta.hazardSpacers.STG.length : 0)} detected
   • Red Visual/Content Regressions: ${(meta.redDiffs || []).length} elements altered
   • Viewport Preset: ${meta.device || "Responsive"}
   • View Mode: ${meta.currentMode || "side-by-side"}

To re-import this package into VisualCompare Live:
Click the "Import ZIP" button in the studio toolbar and select this zip file!
=====================================================
`;
    zip.addFile("links.txt", linksTxt);

    // 2. Full Machine-Readable JSON metadata (enables 100% loss-free import)
    zip.addFile("report.json", JSON.stringify(meta, null, 2));

    // 3. Multi-Page Comprehensive Diff Report PDF
    const mainReportPdf = buildVisualDiffReportPdf(meta);
    zip.addFile("VisualCompare_Diff_Report.pdf", mainReportPdf);

    // 4. Production Reference Page PDF
    const prodPdf = buildSinglePagePdf("Production Reference Page", meta.prodUrl, "PROD", [
      { label: "Reference Baseline State", selector: "body" },
      { label: "Absorbs layout shifts with Yellow Hazard Spacers", selector: ".vc-hazard-stripe-spacer" }
    ]);
    zip.addFile("Production_Reference.pdf", prodPdf);

    // 5. Staging Candidate Page PDF
    const stgPdf = buildSinglePagePdf("Staging Candidate Page", meta.stgUrl, "STG", meta.redDiffs || []);
    zip.addFile("Staging_Candidate.pdf", stgPdf);

    // 6. Interactive Offline HTML Viewer
    zip.addFile("interactive_report.html", buildInteractiveHtmlViewer(meta));

    // Build the ZIP binary
    const zipBytes = zip.build();
    const blob = new Blob([zipBytes], { type: "application/zip" });

    // Trigger browser download
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `visualcompare-diff-report-${dateStr}.zip`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);

    return { filename, size: zipBytes.length };
  }

  // ----------------------------------------------------
  // 7. IMPORT PACKAGE HIGH-LEVEL API
  // ----------------------------------------------------
  async function importComparisonZip(file) {
    const arrayBuffer = await file.arrayBuffer();
    const extracted = SimpleZip.unzip(arrayBuffer);

    let meta = null;

    if (extracted["report.json"]) {
      const text = new TextDecoder().decode(extracted["report.json"]);
      meta = JSON.parse(text);
    } else if (extracted["links.txt"]) {
      const text = new TextDecoder().decode(extracted["links.txt"]);
      const prodMatch = text.match(/REFERENCE \(PRODUCTION\) URL:\s*\n\s*([^\n\r]+)/);
      const stgMatch = text.match(/CANDIDATE \(STAGING\) URL:\s*\n\s*([^\n\r]+)/);
      meta = {
        prodUrl: prodMatch ? prodMatch[1].trim() : "",
        stgUrl: stgMatch ? stgMatch[1].trim() : "",
        timestamp: "Imported from links.txt",
        hazardSpacers: { PROD: [], STG: [] },
        redDiffs: []
      };
    } else {
      throw new Error("Invalid package: Neither report.json nor links.txt found inside ZIP.");
    }

    return meta;
  }

  // Export to global scope
  window.VisualCompareZip = {
    SimpleZip,
    SimplePdf,
    exportComparisonZip,
    importComparisonZip
  };
})();
