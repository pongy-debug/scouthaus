// Local contract reading: PDF text layer via pdf.js, OCR (tesseract.js) for scanned pages and photos.
// Everything runs in the browser — the document itself is never uploaded. Import this module lazily (browser only).
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type ReadProgress = (message: string) => void;
type Ocr = (image: HTMLCanvasElement | File) => Promise<string>;

const NUMBERED = /^(?:clause\s*)?\d+(?:\.\d+)*[.):\s-]/i;

/** PDF and OCR text is wrapped mid-sentence; rejoin wrapped lines so each clause is one line for the scanner. */
export function reflow(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const numbered = lines.some((l) => NUMBERED.test(l));
  const out: string[] = [];
  let open = false; // the previous line is still being continued
  for (const l of lines) {
    if (!l) { open = false; continue; }
    const startsNew = NUMBERED.test(l) || !open;
    if (startsNew) out.push(l); else out[out.length - 1] += " " + l;
    // In numbered contracts a clause runs until the next number; otherwise until the sentence ends.
    open = numbered ? true : !/[.;:!?]$/.test(l);
  }
  return out.join("\n");
}

async function withOcr<T>(progress: ReadProgress, job: (ocr: Ocr) => Promise<T>): Promise<T> {
  let worker: import("tesseract.js").Worker | undefined;
  const ocr: Ocr = async (image) => {
    if (!worker) {
      progress("Loading OCR engine…");
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng");
    }
    return (await worker.recognize(image)).data.text;
  };
  try { return await job(ocr); } finally { await worker?.terminate(); }
}

/** Text of a PDF: the embedded text layer where a page has one, OCR of the rendered page where it doesn't. */
export async function readPdf(file: File, progress: ReadProgress = () => {}): Promise<string> {
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  try {
    return await withOcr(progress, async (ocr) => {
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        progress(`Reading page ${n} of ${doc.numPages}…`);
        const page = await doc.getPage(n);
        const content = await page.getTextContent();
        let text = "";
        for (const it of content.items) if ("str" in it) text += it.str + (it.hasEOL ? "\n" : "");
        if (text.replace(/\s/g, "").length < 20) {
          // Scanned page: no usable text layer, so render it and OCR the image.
          progress(`OCR page ${n} of ${doc.numPages} (scanned)…`);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          text = await ocr(canvas);
        }
        pages.push(text);
        page.cleanup();
      }
      return reflow(pages.join("\n\n"));
    });
  } finally { await task.destroy(); }
}

/** Text of a photographed or scanned contract page (PNG, JPG…). */
export async function readImage(file: File, progress: ReadProgress = () => {}): Promise<string> {
  return withOcr(progress, async (ocr) => { progress("OCR on image…"); return reflow(await ocr(file)); });
}
