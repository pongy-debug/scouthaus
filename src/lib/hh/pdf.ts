// Local contract reading: PDF text layer via pdf.js, OCR (tesseract.js) for scanned pages and photos.
// Everything runs in the browser — the document itself is never uploaded. Import this module lazily (browser only).
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { checkImageDimensions, ContractReadError, contractFileError, MAX_PDF_PAGES, MAX_SCANNED_PAGES, ocrDimensions } from "./upload";

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

async function withOcr<T>(progress: ReadProgress, job: (ocr: Ocr) => Promise<T>, signal?: AbortSignal): Promise<T> {
  let worker: import("tesseract.js").Worker | undefined;
  const terminate = () => { const active = worker; worker = undefined; if (active) setTimeout(() => { void active.terminate().catch(() => {}); }, 0); };
  signal?.addEventListener("abort", terminate, { once: true });
  const ocr: Ocr = async (image) => {
    signal?.throwIfAborted();
    if (!worker) {
      progress("Loading OCR engine…");
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng");
      if (signal?.aborted) { terminate(); signal.throwIfAborted(); }
    }
    const active = worker;
    return new Promise<string>((resolve, reject) => {
      const cancel = () => reject(new DOMException("Reading cancelled", "AbortError"));
      signal?.addEventListener("abort", cancel, { once: true });
      void active.recognize(image).then((result) => resolve(result.data.text), reject)
        .finally(() => signal?.removeEventListener("abort", cancel));
    });
  };
  try { return await job(ocr); } finally { signal?.removeEventListener("abort", terminate); terminate(); }
}

/** Text of a PDF: the embedded text layer where a page has one, OCR of the rendered page where it doesn't. */
export async function readPdf(file: File, progress: ReadProgress = () => {}, signal?: AbortSignal): Promise<string> {
  const issue = contractFileError(file);
  if (issue) throw new ContractReadError(issue);
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const destroy = () => { setTimeout(() => { void task.destroy().catch(() => {}); }, 0); };
  signal?.addEventListener("abort", destroy, { once: true });
  try {
    signal?.throwIfAborted();
    const doc = await task.promise;
    if (doc.numPages > MAX_PDF_PAGES) throw new ContractReadError("This PDF exceeds the 50-page limit. Please upload a shorter document. No pages have been sent for analysis.");
    // Inspect every page before OCR so an oversized scanned document never produces a partial review.
    const extracted: string[] = [];
    let scanned = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      signal?.throwIfAborted();
      progress(`Checking page ${n} of ${doc.numPages}…`);
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        let text = "";
        for (const it of content.items) if ("str" in it) text += it.str + (it.hasEOL ? "\n" : "");
        extracted.push(text);
        if (text.replace(/\s/g, "").length < 20 && ++scanned > MAX_SCANNED_PAGES) throw new ContractReadError("This document exceeds the limit of 20 scanned pages. Please upload a shorter document or a text-based PDF. No pages have been sent for analysis.");
      } finally { page.cleanup(); }
    }
    return await withOcr(progress, async (ocr) => {
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        signal?.throwIfAborted();
        progress(`Reading page ${n} of ${doc.numPages}…`);
        const page = await doc.getPage(n);
        try {
          let text = extracted[n - 1]!;
          if (text.replace(/\s/g, "").length < 20) {
            // Scanned page: no usable text layer, so render it and OCR the image.
            progress(`OCR page ${n} of ${doc.numPages} (scanned)…`);
            const original = page.getViewport({ scale: 300 / 72 });
            const dimensions = ocrDimensions(original.width, original.height);
            const viewport = page.getViewport({ scale: (300 / 72) * dimensions.scale });
            const canvas = document.createElement("canvas");
            try {
              try {
                canvas.width = dimensions.width; canvas.height = dimensions.height;
                if (!canvas.getContext("2d")) throw new Error("Canvas unavailable");
                await page.render({ canvas, viewport }).promise;
              } catch {
                signal?.throwIfAborted();
                throw new ContractReadError("We couldn’t resize or render this document for text recognition. Please upload a smaller PDF.");
              }
              text = await ocr(canvas);
            } finally { canvas.width = 0; canvas.height = 0; }
          }
          pages.push(text);
        } finally { page.cleanup(); }
      }
      return reflow(pages.join("\n\n"));
    }, signal);
  } finally { signal?.removeEventListener("abort", destroy); destroy(); }
}

/** Text of a photographed or scanned contract page (PNG, JPG…). */
export async function readImage(file: File, progress: ReadProgress = () => {}, signal?: AbortSignal): Promise<string> {
  const issue = contractFileError(file);
  if (issue) throw new ContractReadError(issue);
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { cleanup(); image.src = ""; reject(new DOMException("Reading cancelled", "AbortError")); };
      const cleanup = () => { signal?.removeEventListener("abort", cancel); image.onload = null; image.onerror = null; };
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new ContractReadError("We couldn’t read this image. Please upload another image.")); };
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) { cleanup(); cancel(); return; }
      image.src = url;
    });
    signal?.throwIfAborted();
    checkImageDimensions(image.naturalWidth, image.naturalHeight);
    const dimensions = ocrDimensions(image.naturalWidth, image.naturalHeight);
    progress("Preparing image for text recognition…");
    try {
      canvas.width = dimensions.width; canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } catch { throw new ContractReadError("We couldn’t resize this document for text recognition. Please upload a smaller image."); }
    return await withOcr(progress, async (ocr) => { progress("OCR on image…"); return reflow(await ocr(canvas)); }, signal);
  } finally { URL.revokeObjectURL(url); image.src = ""; canvas.width = 0; canvas.height = 0; }
}
