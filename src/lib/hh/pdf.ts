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
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const destroy = () => { setTimeout(() => { void task.destroy().catch(() => {}); }, 0); };
  signal?.addEventListener("abort", destroy, { once: true });
  try {
    signal?.throwIfAborted();
    const doc = await task.promise;
    return await withOcr(progress, async (ocr) => {
      const pages: string[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        signal?.throwIfAborted();
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
    }, signal);
  } finally { signal?.removeEventListener("abort", destroy); destroy(); }
}

/** Text of a photographed or scanned contract page (PNG, JPG…). */
export async function readImage(file: File, progress: ReadProgress = () => {}, signal?: AbortSignal): Promise<string> {
  return withOcr(progress, async (ocr) => { progress("OCR on image…"); return reflow(await ocr(file)); }, signal);
}
