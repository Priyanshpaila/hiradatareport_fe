// ExportA3Button.jsx
import { Button, message } from "antd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function ExportA3Button({
  targetId,
  fileName = "report-a3.pdf",
  title = "Division Analytics",
  logoSrc,
  themeColor = "#0A66C2",
  blockSelector = "[data-pdf-block]",
}) {
  const mm = (n) => Number(n) || 0;

  /* -------- size/quality knobs (tune these) -------- */
  const OPT_SCALE = 1.25; // ↓ from 2.0 (smaller output)
  const OPT_IMG_FORMAT = "JPEG"; // use JPEG instead of PNG
  const OPT_JPEG_QUALITY = 0.72; // 0.6–0.8 is usually fine
  const OPT_IMG_COMPRESSION = "MEDIUM"; // jsPDF addImage compression hint
  const OPT_MAX_MP = 6; // max megapixels per captured block (downsample if larger)

  const loadImageEl = (src) =>
    new Promise((resolve, reject) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const addCompactHeader = async (doc, pageWidth) => {
    const margin = 10,
      headerH = 16,
      yTop = 10;
    doc.setFillColor(249, 251, 255);
    doc.setDrawColor(232, 236, 244);
    doc.rect(
      mm(margin),
      mm(yTop),
      mm(pageWidth - margin * 2),
      mm(headerH),
      "FD"
    );

    let x = margin + 3;
    const y = yTop + 3;

    if (logoSrc) {
      try {
        const img = await loadImageEl(logoSrc);
        if (img) {
          const h = 10,
            w = h * ((img.width || 1) / (img.height || 1));
          doc.addImage(img, "PNG", mm(x), mm(y), mm(w), mm(h));
          x += w + 3;
        }
      } catch {}
    }

    const dateText = new Date().toLocaleString();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(dateText, mm(pageWidth - margin), mm(y + 6), { align: "right" });

    doc.setDrawColor(235, 235, 235);
    doc.line(
      mm(margin),
      mm(yTop + headerH),
      mm(pageWidth - margin),
      mm(yTop + headerH)
    );
    return yTop + headerH + 2;
  };

  const addSectionTitle = (doc, pageWidth, yStart, label) => {
    const margin = 10,
      chipH = 7;
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

  // Downsample a canvas to cap megapixels (for size and memory)
  const downsampleCanvas = (canvas) => {
    const mp = (canvas.width * canvas.height) / 1_000_000;
    if (mp <= OPT_MAX_MP) return canvas;
    const scale = Math.sqrt(OPT_MAX_MP / mp);
    const w = Math.max(1, Math.floor(canvas.width * scale));
    const h = Math.max(1, Math.floor(canvas.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, w, h);
    return c;
  };

  // Keep-each-block-together export with compression
  const addBlocksSnapshot = async (
    doc,
    pageWidth,
    pageHeight,
    yStart,
    containerEl
  ) => {
    const margin = 10;
    const contentW = pageWidth - margin * 2;
    const pageInnerH = pageHeight - margin * 2;

    let blocks = Array.from(containerEl.querySelectorAll(blockSelector));
    if (!blocks.length) blocks = [containerEl];

    const capture = (el) =>
      html2canvas(el, {
        scale: OPT_SCALE, // ↓ key for smaller files
        useCORS: true,
        backgroundColor: "#ffffff",
        ignoreElements: (node) => node.classList?.contains("pdf-hide"),
        onclone: (docClone) => {
          const c = containerEl.id
            ? docClone.getElementById(containerEl.id)
            : null;
          if (c) c.style.overflow = "visible";
        },
      });

    let y = yStart;

    for (const block of blocks) {
      let canvas = await capture(block);
      if (!canvas?.width || !canvas?.height) continue;

      // Downsample very large canvases
      canvas = downsampleCanvas(canvas);

      const fitToWidth = contentW / canvas.width;
      const fitToPage = Math.min(fitToWidth, pageInnerH / canvas.height);

      const remainingH = Math.max(0, pageHeight - y - margin);
      const fitToRemaining = Math.min(
        fitToWidth,
        (remainingH || 0.0001) / canvas.height
      );

      if (remainingH < 20) {
        doc.addPage();
        y = margin;
      }

      const fit = Math.min(fitToRemaining, fitToPage);
      const drawW = canvas.width * fit;
      const drawH = canvas.height * fit;

      // JPEG + quality + compression hint
      const dataUrl =
        OPT_IMG_FORMAT === "JPEG"
          ? canvas.toDataURL("image/jpeg", OPT_JPEG_QUALITY)
          : canvas.toDataURL("image/png");

      doc.addImage(
        dataUrl,
        OPT_IMG_FORMAT,
        mm(margin),
        mm(y),
        mm(drawW),
        mm(drawH),
        undefined,
        OPT_IMG_COMPRESSION // 'FAST' | 'MEDIUM' | 'SLOW'
      );

      y += drawH + 5;
    }
    return y;
  };

  const doExport = async () => {
    try {
      const el = document.getElementById(targetId);
      if (!el) return message.error("Target element not found");

      window.scrollTo({ top: 0 });

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a3",
      });
      const pageWidth = 420;
      const pageHeight = 297;

      let y = await addCompactHeader(doc, pageWidth);
      y = addSectionTitle(doc, pageWidth, y + 2, "Charts & Tables");
      await addBlocksSnapshot(doc, pageWidth, pageHeight, y + 2, el);

      doc.save(fileName);
    } catch (e) {
      console.error(e);
      message.error("Failed to generate PDF");
    }
  };

  return <Button onClick={doExport}>Export A3 PDF</Button>;
}
