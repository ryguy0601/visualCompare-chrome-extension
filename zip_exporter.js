/**
 * VisualCompare Live - ZIP & PDF Exporter / Importer
 * Pure JavaScript, zero-dependency ZIP archive generator/unzipper, PDF-1.4 builder,
 * and high-resolution full-page visual regression report generator.
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
      let bytes;
      if (typeof content === "string") {
        bytes = new TextEncoder().encode(content);
      } else if (content instanceof Uint8Array) {
        bytes = content;
      } else if (content && content.buffer instanceof ArrayBuffer) {
        bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
      } else {
        bytes = new Uint8Array(content || 0);
      }
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

    static unzip(input) {
      let arrayBuffer;
      let byteOffset = 0;
      let byteLength = 0;
      if (input instanceof ArrayBuffer) {
        arrayBuffer = input;
        byteLength = input.byteLength;
      } else if (input && input.buffer instanceof ArrayBuffer) {
        arrayBuffer = input.buffer;
        byteOffset = input.byteOffset;
        byteLength = input.byteLength;
      } else {
        throw new Error("Invalid input to unzip: Expected ArrayBuffer or TypedArray.");
      }
      const view = new DataView(arrayBuffer, byteOffset, byteLength);
      const uint8 = new Uint8Array(arrayBuffer, byteOffset, byteLength);
      const files = {};

      let eocdOffset = -1;
      for (let i = byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
          eocdOffset = i;
          break;
        }
      }

      if (eocdOffset === -1) {
        throw new Error("Invalid ZIP file: End of Central Directory signature not found.");
      }

      const totalEntries = view.getUint16(eocdOffset + 10, true);
      let curOffset = view.getUint32(eocdOffset + 16, true);

      for (let i = 0; i < totalEntries; i++) {
        if (view.getUint32(curOffset, true) !== 0x02014b50) {
          break;
        }

        const compSize = view.getUint32(curOffset + 20, true);
        const nameLen = view.getUint16(curOffset + 28, true);
        const extraLen = view.getUint16(curOffset + 30, true);
        const commentLen = view.getUint16(curOffset + 32, true);
        const localHeaderOffset = view.getUint32(curOffset + 42, true);

        const nameBytes = uint8.subarray(curOffset + 46, curOffset + 46 + nameLen);
        const filename = new TextDecoder().decode(nameBytes);

        const locNameLen = view.getUint16(localHeaderOffset + 26, true);
        const locExtraLen = view.getUint16(localHeaderOffset + 28, true);
        const dataStart = localHeaderOffset + 30 + locNameLen + locExtraLen;

        const fileData = uint8.subarray(dataStart, dataStart + compSize);
        files[filename] = fileData;

        curOffset += 46 + nameLen + extraLen + commentLen;
      }

      return files;
    }
  }

  // ----------------------------------------------------
  // 3. UNIVERSAL PURE-JS PDF 1.4 BUILDER WITH IMAGE SUPPORT
  // (Standard Acrobat & Browser readable PDF document)
  // ----------------------------------------------------
  class SimplePdf {
    constructor() {
      this.pages = [];
      this.images = [];
    }

    addPage(width = 612, height = 792) {
      const page = { width, height, commands: [], images: [] };
      this.pages.push(page);
      return page;
    }

    addImage(jpegBytes, width, height) {
      if (!jpegBytes || jpegBytes.length === 0) return null;
      const key = `Im${this.images.length + 1}`;
      const imgObj = { key, bytes: jpegBytes, width: Math.round(width), height: Math.round(height) };
      this.images.push(imgObj);
      return imgObj;
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

    drawImage(page, imgObj, x, y, width, height) {
      if (!imgObj || !imgObj.key) return;
      if (!page.images.some(im => im.key === imgObj.key)) {
        page.images.push(imgObj);
      }
      page.commands.push(`q ${width} 0 0 ${height} ${x} ${y} cm /${imgObj.key} Do Q\n`);
    }

    build() {
      let objIdx = 1;
      const catalogId = objIdx++;
      const pagesId = objIdx++;
      const fontF1Id = objIdx++;
      const fontF2Id = objIdx++;

      // Image XObjects IDs
      const imageMap = new Map();
      for (const img of this.images) {
        imageMap.set(img.key, objIdx++);
      }

      // Page and Content stream IDs
      const pageIds = [];
      const contentIds = [];
      for (let i = 0; i < this.pages.length; i++) {
        pageIds.push(objIdx++);
        contentIds.push(objIdx++);
      }

      const objects = [];
      objects[catalogId] = { text: `<< /Type /Catalog /Pages ${pagesId} 0 R >>` };
      objects[pagesId] = { text: `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>` };
      objects[fontF1Id] = { text: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>` };
      objects[fontF2Id] = { text: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>` };

      // Build Image XObject streams
      for (const img of this.images) {
        const id = imageMap.get(img.key);
        const header = `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`;
        const footer = `\nendstream`;
        objects[id] = { stream: { header, data: img.bytes, footer } };
      }

      // Build Pages & Content streams
      for (let i = 0; i < this.pages.length; i++) {
        const p = this.pages[i];
        const pId = pageIds[i];
        const cId = contentIds[i];

        const xobjDict = p.images && p.images.length > 0
          ? `/XObject << ${p.images.map(im => `/${im.key} ${imageMap.get(im.key)} 0 R`).join(" ")} >>`
          : "";

        objects[pId] = {
          text: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p.width || 612} ${p.height || 792}] /Resources << /Font << /F1 ${fontF1Id} 0 R /F2 ${fontF2Id} 0 R >> ${xobjDict} >> /Contents ${cId} 0 R >>`
        };

        const streamContent = p.commands.join("");
        const streamBytes = new TextEncoder().encode(streamContent);
        objects[cId] = {
          stream: {
            header: `<< /Length ${streamBytes.length} >>\nstream\n`,
            data: streamBytes,
            footer: `\nendstream`
          }
        };
      }

      // Binary assembly with exact byte offsets
      const enc = new TextEncoder();
      const chunks = [];
      const xrefOffsets = [];
      let currentOffset = 0;

      function pushChunk(chunk) {
        chunks.push(chunk);
        currentOffset += chunk.length;
      }

      const headerBytes = enc.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
      pushChunk(headerBytes);

      for (let i = 1; i < objIdx; i++) {
        xrefOffsets[i] = currentOffset;
        const obj = objects[i];
        if (obj.text) {
          pushChunk(enc.encode(`${i} 0 obj\n${obj.text}\nendobj\n`));
        } else if (obj.stream) {
          pushChunk(enc.encode(`${i} 0 obj\n${obj.stream.header}`));
          pushChunk(obj.stream.data);
          pushChunk(enc.encode(`${obj.stream.footer}\nendobj\n`));
        }
      }

      const startXref = currentOffset;
      let xrefText = `xref\n0 ${objIdx}\n0000000000 65535 f \n`;
      for (let i = 1; i < objIdx; i++) {
        xrefText += `${String(xrefOffsets[i]).padStart(10, "0")} 00000 n \n`;
      }
      xrefText += `trailer\n<< /Size ${objIdx} /Root ${catalogId} 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
      pushChunk(enc.encode(xrefText));

      const finalBuf = new Uint8Array(currentOffset);
      let pos = 0;
      for (const ch of chunks) {
        finalBuf.set(ch, pos);
        pos += ch.length;
      }
      return finalBuf;
    }
  }

  // ----------------------------------------------------
  // 4. CANVAS TO BINARY CONVERTERS
  // ----------------------------------------------------
  function canvasToJpegBytes(canvas, quality = 0.90) {
    if (!canvas) return null;
    if (typeof canvas.toDataURL === "function") {
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1];
        if (!base64) return null;
        const bin = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          u8[i] = bin.charCodeAt(i);
        }
        return u8;
      } catch (e) {
        console.warn("[VisualCompare Live] Canvas to JPEG conversion error:", e);
      }
    }
    return null;
  }

  function canvasToPngBytes(canvas) {
    if (!canvas) return null;
    if (typeof canvas.toDataURL === "function") {
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        if (!base64) return null;
        const bin = typeof atob === "function" ? atob(base64) : Buffer.from(base64, "base64").toString("binary");
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          u8[i] = bin.charCodeAt(i);
        }
        return u8;
      } catch (e) {
        console.warn("[VisualCompare Live] Canvas to PNG conversion error:", e);
      }
    }
    return null;
  }

  // ----------------------------------------------------
  // 5. GOFULLPAGE CONTINUOUS FULL-PAGE PDF BUILDERS
  // (Zero stats, zero headers, zero footers, single continuous 1-page PDF)
  // ----------------------------------------------------

  /**
   * Builds a continuous 1-page full-length PDF matching GoFullPage.
   * Shows the full website page as one big PDF with zero headers, footers, margins, or stat overlays.
   */
  function buildGoFullPagePdf(canvas) {
    const doc = new SimplePdf();
    if (!canvas || !canvas.width || !canvas.height) {
      doc.addPage(612, 792);
      return doc.build();
    }

    const W = canvas.width;
    const H = canvas.height;

    // Standard 72 pt/in vs 96 CSS px/in (72/96 = 0.75)
    const ptWidth = Math.max(1, Math.round(W * 0.75));
    const ptHeight = Math.max(1, Math.round(H * 0.75));

    const page = doc.addPage(ptWidth, ptHeight);
    const jpegBytes = canvasToJpegBytes(canvas, 0.92);

    if (jpegBytes) {
      const imgObj = doc.addImage(jpegBytes, W, H);
      doc.drawImage(page, imgObj, 0, 0, ptWidth, ptHeight);
    }

    return doc.build();
  }

  /**
   * Builds a visual PDF of an entire full-height webpage canvas matching GoFullPage.
   * Shows the full website page as one big continuous PDF without any stat scorecards, margins, headers, or footers.
   */
  function buildFullPageVisualPdf(title, url, type, canvas, meta = {}) {
    if (canvas && canvas.width && canvas.height) {
      return buildGoFullPagePdf(canvas);
    }
    return buildSinglePagePdf(title, url, type, (type === "STG" ? meta.redDiffs : []));
  }

  /**
   * Builds the comprehensive Visual Differences Full-Page PDF matching GoFullPage.
   * Shows the full website page with visual differences as one big continuous PDF without stat scorecards.
   */
  function buildFullPageDiffPdf(meta, canvasDiff, canvasProd, canvasStg) {
    const target = canvasDiff || meta.canvasDiff || canvasStg || meta.canvasStg || canvasProd || meta.canvasProd;
    if (target && target.width && target.height) {
      return buildGoFullPagePdf(target);
    }
    return buildVisualDiffReportPdf(meta);
  }

  /**
   * Builds the multi-page Master Audit Report (Executive Summary + Full-Page Diff Plates).
   */
  function buildComprehensiveReportPdf(meta, canvasDiff, canvasProd, canvasStg) {
    const doc = new SimplePdf();

    // PAGE 1: EXECUTIVE AUDIT REPORT
    const p1 = doc.addPage(612, 792);
    // Header Banner
    doc.drawRect(p1, 0, 715, 612, 77, [0.06, 0.09, 0.16]); // Dark Navy
    doc.drawText(p1, "VISUALCOMPARE LIVE - REGRESSION REPORT", 40, 755, 16, true, [1, 1, 1]);
    doc.drawText(p1, "Automated Dual-Site Visual Comparison, Layout Shift Spacers & Full-Page Audit", 40, 736, 9.5, false, [0.22, 0.74, 0.97]);

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
    doc.drawText(p1, `• Layout Shift Spacers: ${hazardCount} Detected (+${meta.totalShiftDelta || 0}px vertical compensation)`, 55, 566, 10, true, [0.75, 0.55, 0.05]);
    doc.drawText(p1, `• Visual/Content Regressions: ${redCount} Altered Elements Highlighted in Red`, 55, 550, 10, true, [0.85, 0.12, 0.2]);
    doc.drawText(p1, `• Overall Visual Pixel Discrepancy: ${meta.diffMismatchPct || "0.00%"} Mismatch`, 55, 534, 9.5, false, [0.3, 0.35, 0.45]);

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
      prodSpacers.slice(0, 4).forEach((s) => {
        doc.drawText(p1, `• [PROD PAD] +${s.height}px before "${truncate(s.targetSelector, 40)}" (lines up with ${s.counterpart || "Staging"})`, 55, yH, 9, false, [0.55, 0.4, 0]);
        yH -= 18;
      });
      stgSpacers.slice(0, 4).forEach((s) => {
        doc.drawText(p1, `• [STG PAD] +${s.height}px before "${truncate(s.targetSelector, 40)}" (lines up with ${s.counterpart || "Production"})`, 55, yH, 9, false, [0.55, 0.4, 0]);
        yH -= 18;
      });
    }

    // Section 2: Non-Height Red Differences
    doc.drawRect(p1, 40, 160, 532, 185, [1, 0.96, 0.96], [0.95, 0.4, 0.4], 1);
    doc.drawText(p1, "SECTION 2: VISUAL & CONTENT REGRESSIONS (HIGHLIGHTED IN RED)", 55, 325, 11, true, [0.75, 0.1, 0.15]);
    doc.drawText(p1, "Non-height visual discrepancies: button colors, altered copy, metric SLA degradation, shape alterations.", 55, 310, 9, false, [0.5, 0.2, 0.2]);

    let yR = 290;
    (meta.redDiffs || []).slice(0, 5).forEach((r, idx) => {
      doc.drawText(p1, `• [DIFF #${idx + 1}] ${r.label}`, 55, yR, 9, true, [0.75, 0.12, 0.18]);
      doc.drawText(p1, `   Target: ${truncate(r.selector, 60)}  (Type: ${r.diffType || "visual"})`, 55, yR - 12, 8.5, false, [0.45, 0.3, 0.3]);
      yR -= 28;
    });

    // Footer
    doc.drawText(p1, "Generated by VisualCompare Live for Google Chrome. All rights reserved.", 40, 40, 8.5, false, [0.55, 0.6, 0.7]);

    // PAGES 2+: If canvasDiff exists, append full-page visual slices
    if (canvasDiff && canvasDiff.width && canvasDiff.height && typeof document !== "undefined") {
      const W = canvasDiff.width;
      const H = canvasDiff.height;
      const marginSide = 36;
      const marginTop = 58;
      const marginBottom = 34;
      const printableW = 612 - (2 * marginSide);
      const printableH = 792 - marginTop - marginBottom;
      const scale = printableW / W;
      const slicePixelsH = Math.max(100, Math.floor(printableH / scale));
      const visualPages = Math.max(1, Math.ceil(H / slicePixelsH));

      for (let v = 0; v < visualPages; v++) {
        const sy = v * slicePixelsH;
        const sh = Math.min(slicePixelsH, H - sy);

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = W;
        sliceCanvas.height = sh;
        const sCtx = sliceCanvas.getContext("2d");
        sCtx.drawImage(canvasDiff, 0, sy, W, sh, 0, 0, W, sh);

        const jpegBytes = canvasToJpegBytes(sliceCanvas, 0.90);
        const p = doc.addPage(612, 792);

        // Header
        doc.drawRect(p, 0, 746, 612, 46, [0.72, 0.10, 0.22]);
        doc.drawText(p, "VISUALCOMPARE - FULL-PAGE PIXEL DIFF & LAYOUT ALIGNMENT", marginSide, 768, 11, true, [1, 1, 1]);
        doc.drawText(p, `Mismatch: ${meta.diffMismatchPct || "0.00%"}  |  Layout Shifts: ${hazardCount}  |  Plate ${v + 1} of ${visualPages}`, marginSide, 754, 8, false, [1, 0.9, 0.92]);

        const dispW = printableW;
        const dispH = sh * scale;
        const dispX = marginSide;
        const dispY = 792 - marginTop - dispH;

        if (jpegBytes) {
          const imgObj = doc.addImage(jpegBytes, W, sh);
          doc.drawImage(p, imgObj, dispX, dispY, dispW, dispH);
        }
        doc.drawRect(p, dispX, dispY, dispW, dispH, null, [0.85, 0.88, 0.92], 0.5);

        // Footer
        doc.drawRect(p, marginSide, marginBottom, printableW, 0.5, null, [0.85, 0.88, 0.92]);
        doc.drawText(p, `Visual Difference Plate ${v + 1}/${visualPages} • VisualCompare Live Report`, marginSide, marginBottom - 15, 7.5, false, [0.5, 0.55, 0.65]);
        doc.drawText(p, `Page ${v + 2} of ${visualPages + 1}`, 612 - marginSide - 60, marginBottom - 15, 8, true, [0.35, 0.4, 0.5]);
      }
    }

    return doc.build();
  }

  function buildVisualDiffReportPdf(meta) {
    return buildComprehensiveReportPdf(meta, meta.canvasDiff, meta.canvasProd, meta.canvasStg);
  }

  function buildSinglePagePdf(title, url, type, items = []) {
    const doc = new SimplePdf();
    const p = doc.addPage(612, 792);

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
  // 6. INTERACTIVE OFFLINE HTML VIEWER GENERATOR
  // (Self-contained offline report readable in any browser with interactive swipe & flicker)
  // ----------------------------------------------------
  function buildInteractiveHtmlViewer(meta) {
    const hasPngs = Boolean(meta.canvasProd && meta.canvasStg);
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
    .metric-row { display: flex; gap: 16px; margin-top: 12px; }
    .metric-pill { background: #1e293b; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .metric-pill.red { color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }
    .metric-pill.yellow { color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3); }
    .diff-section { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .diff-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .yellow-title { color: #facc15; }
    .red-title { color: #f87171; }
    .diff-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
    .diff-item { background: #131d33; border: 1px solid #1e293b; border-radius: 8px; padding: 12px 16px; font-size: 13px; }
    .diff-item.yellow { border-left: 4px solid #facc15; }
    .diff-item.red { border-left: 4px solid #ef4444; }
    .btn-visit { display: inline-block; background: #2563eb; color: #fff; padding: 6px 14px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; margin-top: 8px; }
    
    /* Offline Screenshot Viewer */
    .viewer-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .viewer-tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px; }
    .vtab { background: #1e293b; color: #94a3b8; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .vtab.active { background: #0284c7; color: #fff; }
    .img-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .img-col { background: #0a0f1d; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; text-align: center; }
    .img-col h4 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; }
    .img-col.prod h4 { color: #38bdf8; }
    .img-col.stg h4 { color: #a78bfa; }
    .img-col.diff h4 { color: #f87171; }
    .full-img { width: 100%; height: auto; border: 1px solid #334155; border-radius: 4px; display: block; }
    .download-links { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .btn-dl { background: #1e293b; color: #38bdf8; border: 1px solid #334155; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; }
    .btn-dl:hover { background: #2a3a55; border-color: #38bdf8; }
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
    <div class="metric-row">
      <div class="metric-pill red">🔴 Mismatch: ${meta.diffMismatchPct || "0.00%"}</div>
      <div class="metric-pill yellow">⚠️ Layout Shift Delta: ${meta.totalShiftDelta || "+0px"}</div>
      <div class="metric-pill">📱 Device: ${meta.device || "Responsive"}</div>
    </div>
  </div>

  <div class="viewer-card">
    <div class="viewer-tabs">
      <button class="vtab active" onclick="switchTab('side')">Side-by-Side Images</button>
      <button class="vtab" onclick="switchTab('diff')">Visual Diff Highlight</button>
    </div>

    <div id="tab-side" class="img-grid">
      <div class="img-col prod">
        <h4>Production Reference</h4>
        <img src="screenshots/prod_fullpage.png" class="full-img" alt="Production Screenshot" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22100%22><text y=%2250%22 fill=%22%2394a3b8%22>Production Image (check PDF)</text></svg>'">
      </div>
      <div class="img-col stg">
        <h4>Staging Candidate</h4>
        <img src="screenshots/stg_fullpage.png" class="full-img" alt="Staging Screenshot" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22100%22><text y=%2250%22 fill=%22%2394a3b8%22>Staging Image (check PDF)</text></svg>'">
      </div>
    </div>

    <div id="tab-diff" class="img-col diff" style="display: none;">
      <h4>Aligned Visual Difference Overlay</h4>
      <img src="screenshots/diff_fullpage.png" class="full-img" alt="Diff Screenshot" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22100%22><text y=%2250%22 fill=%22%2394a3b8%22>Diff Image (check PDF)</text></svg>'">
    </div>

    <div class="download-links">
      <span style="font-size:12px; color:#94a3b8; line-height:28px;">Included Full-Page PDFs:</span>
      <a href="Production_FullPage.pdf" class="btn-dl" target="_blank">📄 Production Full Page (PDF)</a>
      <a href="Staging_FullPage.pdf" class="btn-dl" target="_blank">📄 Staging Full Page (PDF)</a>
      <a href="VisualDiff_FullPage.pdf" class="btn-dl" target="_blank">📄 Visual Diff Full Page (PDF)</a>
      <a href="VisualCompare_Diff_Report.pdf" class="btn-dl" target="_blank">📑 Master Audit Report (PDF)</a>
    </div>
  </div>

  <div class="diff-section">
    <div class="diff-title yellow-title">⚠️ Section 1: Layout Shift Spacers (${(meta.hazardSpacers && meta.hazardSpacers.PROD ? meta.hazardSpacers.PROD.length : 0) + (meta.hazardSpacers && meta.hazardSpacers.STG ? meta.hazardSpacers.STG.length : 0)})</div>
    <ul class="diff-list">
      ${((meta.hazardSpacers && meta.hazardSpacers.PROD) || []).map(s => `
        <li class="diff-item yellow">
          <strong>[PROD] +${s.height}px Layout Shift Spacer</strong> before <code>${s.targetSelector}</code>
        </li>
      `).join("")}
      ${((meta.hazardSpacers && meta.hazardSpacers.STG) || []).map(s => `
        <li class="diff-item yellow">
          <strong>[STG] +${s.height}px Layout Shift Spacer</strong> before <code>${s.targetSelector}</code>
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

  <script>
    function switchTab(tab) {
      document.querySelectorAll('.vtab').forEach(b => b.classList.remove('active'));
      if (tab === 'side') {
        document.querySelectorAll('.vtab')[0].classList.add('active');
        document.getElementById('tab-side').style.display = 'grid';
        document.getElementById('tab-diff').style.display = 'none';
      } else {
        document.querySelectorAll('.vtab')[1].classList.add('active');
        document.getElementById('tab-side').style.display = 'none';
        document.getElementById('tab-diff').style.display = 'block';
      }
    }
  </script>
</body>
</html>`;
  }

  // ----------------------------------------------------
  // 7. HIGH-LEVEL EXPORT APIS
  // ----------------------------------------------------

  /**
   * Directly exports a single targeted full-page PDF.
   * @param {Object} meta
   * @param {'master'|'prod'|'stg'|'diff'} type
   */
  function exportSinglePdf(meta, type = "master") {
    let pdfBytes = null;
    let filename = "";
    const dateStr = new Date().toISOString().slice(0, 10);

    if (type === "prod") {
      pdfBytes = buildGoFullPagePdf(meta.canvasProd || meta.canvasDiff || meta.canvasStg);
      filename = `visualcompare-prod-fullpage-${dateStr}.pdf`;
    } else if (type === "stg") {
      pdfBytes = buildGoFullPagePdf(meta.canvasStg || meta.canvasDiff || meta.canvasProd);
      filename = `visualcompare-stg-fullpage-${dateStr}.pdf`;
    } else if (type === "diff") {
      pdfBytes = buildGoFullPagePdf(meta.canvasDiff || meta.canvasStg || meta.canvasProd);
      filename = `visualcompare-diff-fullpage-${dateStr}.pdf`;
    } else {
      // type === "master" or general PDF export
      // Per user request: "work like gofull page where it just shows the one websiete page as one big pdf, i dont need any of that stat stuff"
      const targetCanvas = meta.targetCanvas || (meta.currentMode === "diff" ? meta.canvasDiff : (meta.canvasStg || meta.canvasProd || meta.canvasDiff));
      if (targetCanvas && targetCanvas.width && targetCanvas.height) {
        pdfBytes = buildGoFullPagePdf(targetCanvas);
      } else {
        pdfBytes = buildGoFullPagePdf(meta.canvasDiff || meta.canvasStg || meta.canvasProd);
      }
      filename = `visualcompare-master-report-${dateStr}.pdf`;
    }

    if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }

    return { filename, size: pdfBytes.length, bytes: pdfBytes };
  }

  /**
   * Directly exports a single targeted full-page PNG screenshot matching GoFullPage.
   */
  function exportSinglePng(canvas, filename = "") {
    if (!canvas) throw new Error("No canvas provided for PNG export.");
    if (!filename) {
      const dateStr = new Date().toISOString().slice(0, 10);
      filename = `gofullpage-screenshot-${dateStr}.png`;
    }
    const pngBytes = canvasToPngBytes(canvas);
    if (!pngBytes) throw new Error("Failed to encode canvas as PNG.");

    if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([pngBytes], { type: "image/png" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }

    return { filename, size: pngBytes.length, bytes: pngBytes };
  }

  /**
   * Exports full comparison package as ZIP archive.
   * Includes full-page visual PDFs of each page, lossless PNG screenshots, JSON, and offline viewer.
   */
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
   • Pixel Mismatch: ${meta.diffMismatchPct || "0.00%"}

INCLUDED FULL-PAGE PDFS:
- Production_FullPage.pdf: Full top-to-bottom rendering of Production
- Staging_FullPage.pdf: Full top-to-bottom rendering of Staging
- VisualDiff_FullPage.pdf: Full-page visual difference with hazard stripes & red diffs
- VisualCompare_Diff_Report.pdf: Master Executive Audit Report with full plates

INCLUDED FULL-PAGE PNG SCREENSHOTS:
- screenshots/prod_fullpage.png
- screenshots/stg_fullpage.png
- screenshots/diff_fullpage.png

To re-import this package into VisualCompare Live:
Click the "Import ZIP" button in the studio toolbar and select this zip file!
=====================================================
`;
    zip.addFile("links.txt", linksTxt);

    // 2. Full Machine-Readable JSON metadata (enables 100% loss-free import)
    const jsonMeta = {
      ...meta,
      canvasProd: undefined,
      canvasStg: undefined,
      canvasDiff: undefined
    };
    zip.addFile("report.json", JSON.stringify(jsonMeta, null, 2));

    // 3. Multi-Page Comprehensive Diff Report PDF
    const mainReportPdf = buildComprehensiveReportPdf(meta, meta.canvasDiff, meta.canvasProd, meta.canvasStg);
    zip.addFile("VisualCompare_Diff_Report.pdf", mainReportPdf);

    // 4. Production Reference Page Full-Page PDF
    const prodFullPdf = buildFullPageVisualPdf("Production Reference (Full Page)", meta.prodUrl, "PROD", meta.canvasProd, meta);
    zip.addFile("Production_FullPage.pdf", prodFullPdf);

    // 5. Staging Candidate Page Full-Page PDF
    const stgFullPdf = buildFullPageVisualPdf("Staging Candidate (Full Page)", meta.stgUrl, "STG", meta.canvasStg, meta);
    zip.addFile("Staging_FullPage.pdf", stgFullPdf);

    // 6. Visual Differences Full-Page PDF
    const diffFullPdf = buildFullPageDiffPdf(meta, meta.canvasDiff, meta.canvasProd, meta.canvasStg);
    zip.addFile("VisualDiff_FullPage.pdf", diffFullPdf);

    // 7. Backward-compatible Element Audit PDFs
    const prodAuditPdf = buildSinglePagePdf("Production Reference Page", meta.prodUrl, "PROD", [
      { label: "Reference Baseline State", selector: "body" },
      { label: "Absorbs layout shifts with Yellow Hazard Spacers", selector: ".vc-hazard-stripe-spacer" }
    ]);
    zip.addFile("Production_Reference.pdf", prodAuditPdf);

    const stgAuditPdf = buildSinglePagePdf("Staging Candidate Page", meta.stgUrl, "STG", meta.redDiffs || []);
    zip.addFile("Staging_Candidate.pdf", stgAuditPdf);

    // 8. Full-Page PNG Screenshots (matching Python screenshots/ directory)
    if (meta.canvasProd) {
      const prodPng = canvasToPngBytes(meta.canvasProd);
      if (prodPng) zip.addFile("screenshots/prod_fullpage.png", prodPng);
    }
    if (meta.canvasStg) {
      const stgPng = canvasToPngBytes(meta.canvasStg);
      if (stgPng) zip.addFile("screenshots/stg_fullpage.png", stgPng);
    }
    if (meta.canvasDiff) {
      const diffPng = canvasToPngBytes(meta.canvasDiff);
      if (diffPng) zip.addFile("screenshots/diff_fullpage.png", diffPng);
    }

    // 9. Interactive Offline HTML Viewer
    zip.addFile("interactive_report.html", buildInteractiveHtmlViewer(meta));

    // Build the ZIP binary
    const zipBytes = zip.build();

    // Trigger browser download if running in browser DOM
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `visualcompare-diff-report-${dateStr}.zip`;

    if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([zipBytes], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }

    return { filename, size: zipBytes.length, bytes: zipBytes };
  }

  // ----------------------------------------------------
  // 8. IMPORT PACKAGE HIGH-LEVEL API
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
    importComparisonZip,
    exportSinglePdf,
    exportSinglePng,
    buildGoFullPagePdf,
    buildFullPageVisualPdf,
    buildFullPageDiffPdf,
    buildComprehensiveReportPdf,
    buildVisualDiffReportPdf,
    buildSinglePagePdf,
    canvasToJpegBytes,
    canvasToPngBytes
  };
})();
