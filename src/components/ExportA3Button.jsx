// ExportA3Button.jsx
import { Button, message } from "antd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function ExportA3Button({
  targetId,
  fileName = "report-a3.pdf",
  title = "Division Analytics",       // Division name here
  logoSrc,                            // small logo (optional)
  themeColor = "#0A66C2",
  blockSelector = "[data-pdf-block]"  // wrap each chart/table with data-pdf-block
}) {
  const mm = (n) => Number(n) || 0;

  // --- utilities ---
  const loadImageEl = (src) =>
    new Promise((resolve, reject) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  // --- compact header: tiny bar, small logo, title (left), date (right) ---
  const addCompactHeader = async (doc, pageWidth) => {
    const margin = 10;              // tighter than before
    const headerH = 16;             // compact height (mm)
    const yTop = 10;

    // subtle bar
    doc.setFillColor(249, 251, 255);
    doc.setDrawColor(232, 236, 244);
    doc.rect(mm(margin), mm(yTop), mm(pageWidth - margin * 2), mm(headerH), "FD");

    let cursorX = margin + 3;
    const y = yTop + 3;

    // small logo (optional)
    if (logoSrc) {
      try {
        const img = await loadImageEl(logoSrc);
        if (img) {
          const h = 10; // smaller logo
          const ratio = (img.width || 1) / (img.height || 1);
          const w = h * ratio;
          doc.addImage(img, "PNG", mm(cursorX), mm(y), mm(w), mm(h));
          cursorX += w + 3;
        }
      } catch { /* ignore logo errors */ }
    }

    // // Title (division name)
    // doc.setFont("helvetica", "bold");
    // doc.setTextColor(28, 42, 60);
    // doc.setFontSize(12);
    // doc.text(String(title || ""), mm(cursorX), mm(y + 6));

    // Date (right-aligned)
    const dateText = new Date().toLocaleString();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    const rightX = pageWidth - margin;
    doc.text(dateText, mm(rightX), mm(y + 6), { align: "right" });

    // thin divider under header
    doc.setDrawColor(235, 235, 235);
    doc.line(mm(margin), mm(yTop + headerH), mm(pageWidth - margin), mm(yTop + headerH));

    return yTop + headerH + 2; // next Y position
  };

  const addSectionTitle = (doc, pageWidth, yStart, label) => {
    const margin = 10;
    const chipH = 7;
    doc.setFillColor(
      parseInt(themeColor.slice(1, 3), 16),
      parseInt(themeColor.slice(3, 5), 16),
      parseInt(themeColor.slice(5, 7), 16)
    );
    doc.rect(mm(margin), mm(yStart + 1), mm(2), mm(chipH), "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(label, mm(margin + 5), mm(yStart + chipH));
    return yStart + chipH + 3;
  };

  // Keep-each-block-together export
  const addBlocksSnapshot = async (doc, pageWidth, pageHeight, yStart, containerEl) => {
    const margin = 10;
    const contentW = pageWidth - margin * 2;
    const pageInnerH = pageHeight - margin * 2;

    let blocks = Array.from(containerEl.querySelectorAll(blockSelector));
    if (!blocks.length) blocks = [containerEl]; // fallback: whole container

    const capture = (el) =>
      html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        ignoreElements: (node) => node.classList?.contains("pdf-hide"),
        onclone: (docClone) => {
          const c = containerEl.id ? docClone.getElementById(containerEl.id) : null;
          if (c) c.style.overflow = "visible";
        },
      });

    let y = yStart;

    for (const block of blocks) {
      const canvas = await capture(block);
      if (!canvas?.width || !canvas?.height) continue;

      const fit = Math.min(contentW / canvas.width, pageInnerH / canvas.height);
      const drawW = canvas.width * fit;
      const drawH = canvas.height * fit;

      // new page if needed
      if (drawH > pageHeight - y - margin) {
        doc.addPage();
        y = margin;
      }

      doc.addImage(canvas.toDataURL("image/png"), "PNG", mm(margin), mm(y), mm(drawW), mm(drawH));
      y += drawH + 5;
    }
    return y;
  };

  const doExport = async () => {
    try {
      const el = document.getElementById(targetId);
      if (!el) return message.error("Target element not found");

      window.scrollTo({ top: 0 });

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
      const pageWidth = 297;
      const pageHeight = 420;

      // compact header (only logo + division name + date)
      let y = await addCompactHeader(doc, pageWidth);

      // optional small section label
      y = addSectionTitle(doc, pageWidth, y + 2, "Charts & Tables");

      // export charts/tables
      await addBlocksSnapshot(doc, pageWidth, pageHeight, y + 2, el);

      doc.save(fileName);
    } catch (e) {
      console.error(e);
      message.error("Failed to generate PDF");
    }
  };

  return <Button onClick={doExport}>Export A3 PDF</Button>;
}
