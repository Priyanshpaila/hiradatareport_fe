import { Button } from "antd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/** Export a DOM node to A3 portrait PDF (splits across pages if tall) */
export default function ExportA3Button({ targetId, fileName = "dashboard.pdf" }) {
  const doExport = async () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a3" });
    const pageWidth = 297, pageHeight = 420, margin = 10;
    const imgWidth = pageWidth - margin*2;
    const pagePxHeight = (pageHeight - margin*2) * canvas.width / imgWidth;

    let ySlice = 0;
    while (ySlice < canvas.height) {
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(pagePxHeight, canvas.height - ySlice);
      const ctx = pageCanvas.getContext("2d");
      ctx.drawImage(canvas, 0, ySlice, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
      const pageImg = pageCanvas.toDataURL("image/png");
      pdf.addImage(pageImg, "PNG", margin, margin, imgWidth, (pageCanvas.height * imgWidth) / canvas.width);
      ySlice += pagePxHeight;
      if (ySlice < canvas.height) pdf.addPage();
    }
    pdf.save(fileName);
  };

  return <Button onClick={doExport}>Export A3 PDF</Button>;
}
