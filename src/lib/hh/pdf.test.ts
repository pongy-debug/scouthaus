import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { getDocument, recognize, terminate } = vi.hoisted(() => ({ getDocument: vi.fn(), recognize: vi.fn(), terminate: vi.fn() }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument, GlobalWorkerOptions: {} }));
vi.mock("tesseract.js", () => ({ createWorker: vi.fn(async () => ({ recognize, terminate })) }));
import { readImage, readPdf } from "./pdf";

beforeEach(() => {
  recognize.mockResolvedValue({ data: { text: "Recognised contract clause." } });
  terminate.mockResolvedValue(undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function imageWith(width: number, height: number) {
  vi.stubGlobal("Image", class {
    naturalWidth = width; naturalHeight = height;
    onload: (() => void) | null = null;
    set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); }
  });
  return new File(["image"], "contract.png");
}

it("rejects an oversized image before drawing or starting OCR", async () => {
  await expect(readImage(imageWith(6000, 4000))).rejects.toThrow("20 megapixels");
  expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  expect(recognize).not.toHaveBeenCalled();
});
it("resizes an accepted image before OCR and releases its canvas", async () => {
  const drawImage = vi.fn();
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue({ fillRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
  recognize.mockImplementation(async (canvas: HTMLCanvasElement) => {
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(9_000_000);
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(3500);
    return { data: { text: "Recognised contract clause." } };
  });
  await expect(readImage(imageWith(5000, 4000))).resolves.toContain("Recognised contract");
  expect(drawImage).toHaveBeenCalledOnce();
  expect(recognize.mock.calls[0]![0].width).toBe(0);
});
it("reports image resize failure without starting OCR", async () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  await expect(readImage(imageWith(1000, 1500))).rejects.toThrow("resize");
  expect(recognize).not.toHaveBeenCalled();
});

function documentWith(pages: number, scanned: number) {
  const page = {
    getTextContent: vi.fn(), cleanup: vi.fn(),
    getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 2000 * scale, height: 3000 * scale })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
  };
  const doc = { numPages: pages, getPage: vi.fn(async (n: number) => {
    page.getTextContent.mockResolvedValue({ items: [{ str: n <= scanned ? "" : "1. Rent is £150 per week and payable each Monday.", hasEOL: true }] });
    return page;
  }) };
  const destroy = vi.fn(async () => {});
  getDocument.mockReturnValue({ promise: Promise.resolve(doc), destroy });
  const file = new File(["pdf"], "contract.pdf");
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(1) });
  return { file, doc, page, destroy };
}

it("rejects 51 pages before reading or rendering any page", async () => {
  const { file, doc, page } = documentWith(51, 0);
  await expect(readPdf(file)).rejects.toThrow("50-page limit");
  expect(doc.getPage).not.toHaveBeenCalled();
  expect(page.render).not.toHaveBeenCalled();
  expect(recognize).not.toHaveBeenCalled();
});
it("accepts a 50-page text PDF without OCR", async () => {
  const { file } = documentWith(50, 0);
  await expect(readPdf(file)).resolves.toContain("Rent is £150");
  expect(recognize).not.toHaveBeenCalled();
});
it("rejects 21 scanned pages before any OCR or partial result", async () => {
  const { file, page } = documentWith(22, 21);
  await expect(readPdf(file)).rejects.toThrow("20 scanned pages");
  expect(page.render).not.toHaveBeenCalled();
  expect(recognize).not.toHaveBeenCalled();
});
it("accepts 20 scanned pages, bounds rendering size and releases canvases", async () => {
  const { file, page } = documentWith(20, 20);
  page.render.mockImplementation((...args: unknown[]) => {
    const { canvas } = args[0] as { canvas: HTMLCanvasElement };
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(9_000_000);
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(3500);
    return { promise: Promise.resolve() };
  });
  await expect(readPdf(file)).resolves.toContain("Recognised contract clause");
  expect(recognize).toHaveBeenCalledTimes(20);
  for (const [canvas] of recognize.mock.calls) {
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  }
});
it("reports canvas failure instead of returning partial text", async () => {
  const { file } = documentWith(2, 1);
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  await expect(readPdf(file)).rejects.toThrow("resize or render");
  expect(recognize).not.toHaveBeenCalled();
});
