import { Button, message } from "antd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Export a *designed* A3 portrait report PDF.
 * Sections:
 * - Cover header with logo + title
 * - Metadata key/values (optional)
 * - Snapshot of target DOM (scaled, paginated)
 *
 * Props:
 *  - targetId: string (DOM id to snapshot)
 *  - fileName?: string
 *  - title?: string
 *  - logoSrc?: string (PNG recommended)
 *  - meta?: Record<string,string|number>
 *  - themeColor?: string (hex), default "#0A66C2"
 */
export default function ExportA3Button({
  targetId,
  fileName = "report-a3.pdf",
  title = "Analytics Report",
  logoSrc,
  meta = {},
  themeColor = "#0A66C2",
}) {
  const mm = (n) => Number(n) || 0; // ensure numbers

  const loadImageEl = (src) =>
    new Promise((resolve, reject) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const addHeader = async (doc, pageWidth, yStart) => {
    const margin = 12;
    const headerH = 28;

    // band
    doc.setFillColor(248, 250, 255); // very light
    doc.setDrawColor(230, 236, 244);
    doc.rect(mm(margin), mm(yStart), mm(pageWidth - margin * 2), mm(headerH), "FD");

    // logo
    let x = margin + 4;
    const y = yStart + 4;
    if (logoSrc) {
      try {
        const img = await loadImageEl(logoSrc);
        if (img) {
          const h = 18; // mm
          const ratio = img.width / img.height || 1;
          const w = h * ratio;
          doc.addImage(img, "PNG", mm(x), mm(y), mm(w), mm(h));
          x += w + 4;
        }
      } catch {
        // ignore logo errors silently
      }
    }

    // title
    doc.setTextColor(20, 40, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, mm(x), mm(y + 8));

    return yStart + headerH;
  };

  const addMeta = (doc, pageWidth, yStart, metaObj) => {
    const margin = 12;
    const yTop = yStart + 4;
    const colGap = 10;
    const colW = (pageWidth - margin * 2 - colGap) / 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);

    const entries = Object.entries(metaObj || {});
    if (!entries.length) return yStart;

    // two columns layout
    let leftY = yTop;
    let rightY = yTop;
    const lineH = 6;

    entries.forEach(([k, v], idx) => {
      const text = `${k}: ${String(v ?? "—")}`;
      if (idx % 2 === 0) {
        doc.text(text, mm(margin), mm(leftY));
        leftY += lineH;
      } else {
        doc.text(text, mm(margin + colW + colGap), mm(rightY));
        rightY += lineH;
      }
    });

    const yEnd = Math.max(leftY, rightY) + 4;

    // underline rule
    doc.setDrawColor(235, 235, 235);
    doc.line(mm(margin), mm(yEnd), mm(pageWidth - margin), mm(yEnd));

    return yEnd + 2;
  };

  const addSectionTitle = (doc, pageWidth, yStart, label) => {
    const margin = 12;
    const chipH = 8;

    // chip
    doc.setFillColor(
      parseInt(themeColor.slice(1, 3), 16),
      parseInt(themeColor.slice(3, 5), 16),
      parseInt(themeColor.slice(5, 7), 16)
    );
    doc.rect(mm(margin), mm(yStart + 1.5), mm(2), mm(chipH), "F");

    // title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(label, mm(margin + 5), mm(yStart + chipH));

    return yStart + chipH + 4;
  };

  const addDomSnapshot = async (doc, pageWidth, pageHeight, yStart, el) => {
    const margin = 12;
    const contentW = pageWidth - margin * 2;
    const availableHFirstPage = pageHeight - yStart - margin;

    // render at 2x for crispness
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
    if (!canvas || !canvas.width || !canvas.height) return yStart;

    const ratio = contentW / canvas.width;
    const totalPageH = canvas.height * ratio; // how tall on page if fitted to width

    // If it fits on the first page -> just draw it
    if (totalPageH <= availableHFirstPage) {
      doc.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        mm(margin),
        mm(yStart),
        mm(contentW),
        mm(totalPageH)
      );
      return yStart + totalPageH + 2;
    }

    // Otherwise, slice it across pages
    let yPx = 0;
    const pxPerPageFirst = Math.floor(availableHFirstPage / ratio);
    const pxPerPageNext = Math.floor((pageHeight - margin * 2) / ratio);

    // first slice (fill remaining space on current page)
    if (pxPerPageFirst > 0) {
      const slice1 = document.createElement("canvas");
      slice1.width = canvas.width;
      slice1.height = Math.min(pxPerPageFirst, canvas.height);
      const ctx1 = slice1.getContext("2d");
      ctx1.drawImage(canvas, 0, 0, canvas.width, slice1.height, 0, 0, canvas.width, slice1.height);

      const hOnPage = slice1.height * ratio;
      doc.addImage(slice1.toDataURL("image/png"), "PNG", mm(margin), mm(yStart), mm(contentW), mm(hOnPage));
      yPx += slice1.height;
    }

    // remaining full pages
    while (yPx < canvas.height) {
      doc.addPage();
      let thisSlicePx = Math.min(pxPerPageNext, canvas.height - yPx);

      const pageSlice = document.createElement("canvas");
      pageSlice.width = canvas.width;
      pageSlice.height = thisSlicePx;
      const ctx = pageSlice.getContext("2d");
      ctx.drawImage(canvas, 0, yPx, canvas.width, thisSlicePx, 0, 0, canvas.width, thisSlicePx);

      const hOnPage = thisSlicePx * ratio;
      doc.addImage(
        pageSlice.toDataURL("image/png"),
        "PNG",
        mm(margin),
        mm(margin),
        mm(contentW),
        mm(hOnPage)
      );

      yPx += thisSlicePx;

      // if there’s still more, add another page automatically in next loop
    }

    // return a cursor near bottom; next writer will likely start on a new page
    return pageHeight - margin;
  };

  const doExport = async () => {
    try {
      const el = document.getElementById(targetId);
      if (!el) {
        message.error("Target element not found");
        return;
      }

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
      const pageWidth = 297;
      const pageHeight = 420;

      // Header
      let y = await addHeader(doc, pageWidth, 12);

      // Meta
      const metaWithDate = {
        ...meta,
        Generated: new Date().toLocaleString(),
      };
      y = addMeta(doc, pageWidth, y, metaWithDate);

      // Section title
      y = addSectionTitle(doc, pageWidth, y + 6, "Charts & Tables Snapshot");

      // Snapshot (handles pagination internally)
      y = await addDomSnapshot(doc, pageWidth, pageHeight, y + 4, el);

      doc.save(fileName);
    } catch (err) {
      console.error(err);
      message.error("Failed to generate PDF");
    }
  };

  return (
    <Button icon={/* optional: your icon */ null} onClick={doExport}>
      Export A3 PDF
    </Button>
  );
}
