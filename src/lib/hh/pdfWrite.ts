// A very small PDF writer for "Download as PDF": A4 pages of wrapped Helvetica text, built in the browser with no
// dependency and no upload. Text is written in WinAnsi (Latin-1); characters outside it are simplified.
import type { Block } from "./summary";

// Helvetica advance widths (1/1000 em) for ASCII 32–126.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const STYLE = { h1: { size: 16, bold: true, gap: 10 }, h2: { size: 12, bold: true, gap: 12 }, p: { size: 10, bold: false, gap: 4 }, li: { size: 10, bold: false, gap: 3 }, small: { size: 8, bold: false, gap: 14 } } as const;
const PAGE = { w: 595, h: 842, margin: 56 };

const latin1 = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/•/g, "-").replace(/…/g, "...").replace(/\xa0/g, " ").replace(/[^\x20-\x7e\xa1-\xff]/g, "?");
const width = (s: string, size: number, bold: boolean) => { let w = 0; for (const c of s) w += W[c.charCodeAt(0) - 32] ?? 556; return (w * size * (bold ? 1.08 : 1)) / 1000; };
function wrap(text: string, size: number, bold: boolean, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next, size, bold) > max) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function textPdf(blocks: Block[]): Uint8Array {
  const pages: string[] = [];
  let ops = "", y = PAGE.h - PAGE.margin;
  const newPage = () => { pages.push(ops); ops = ""; y = PAGE.h - PAGE.margin; };
  for (const b of blocks) {
    const st = STYLE[b.kind], lead = st.size * 1.4, indent = b.kind === "li" ? 12 : 0;
    const lines = wrap(latin1(b.text), st.size, st.bold, PAGE.w - 2 * PAGE.margin - indent);
    y -= st.gap;
    lines.forEach((l, i) => {
      if (y - lead < PAGE.margin) newPage();
      y -= lead;
      const str = l.replace(/[\\()]/g, "\\$&");
      if (b.kind === "li" && i === 0) ops += `BT /F1 ${st.size} Tf ${PAGE.margin} ${y.toFixed(1)} Td (-) Tj ET\n`;
      ops += `BT /${st.bold ? "F2" : "F1"} ${st.size} Tf ${PAGE.margin + indent} ${y.toFixed(1)} Td (${str}) Tj ET\n`;
    });
  }
  pages.push(ops);

  // Objects: 1 catalog, 2 page tree, 3–4 fonts, then a page + content stream per page.
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
  pages.forEach((content, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
  });
  let pdf = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(pdf, (c) => c.charCodeAt(0)); // every character is Latin-1, so one byte each
}
