import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/** Reads searchable PDFs locally. Image-only pages require OCR outside this MVP. */
export async function readPdfText(file: File, onProgress: (percent: number) => void = () => {}) {
  const task = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
  });
  let passwordRequired = false;
  task.onPassword = () => {
    passwordRequired = true;
    void task.destroy();
  };
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      let text = "";
      let lastY: number | undefined;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = item.transform[5] as number;
        if (lastY !== undefined && Math.abs(y - lastY) > 2 && !text.endsWith("\n")) text += "\n";
        text += item.str + (item.hasEOL ? "\n" : " ");
        lastY = y;
      }
      pages.push(text.trim());
      page.cleanup();
      onProgress((index / pdf.numPages) * 100);
    }
    if (pages.some((page) => !page)) {
      throw new Error(
        "Some pages have no readable text. This PDF may contain scanned images; paste the complete contract text instead.",
      );
    }
    return pages.join("\n\n");
  } catch (error) {
    if (passwordRequired)
      throw new Error("This PDF is password protected. Upload an unlocked copy or paste its text.");
    throw error;
  } finally {
    await task.destroy();
  }
}
