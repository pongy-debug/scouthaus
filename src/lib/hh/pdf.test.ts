import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDocument, destroy, getPage } = vi.hoisted(() => ({
  getDocument: vi.fn(),
  destroy: vi.fn(),
  getPage: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({ getDocument, GlobalWorkerOptions: {} }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "local-worker.mjs" }));
import { readPdfText } from "./pdf";

const file = { arrayBuffer: async () => new ArrayBuffer(1) } as File;
beforeEach(() => {
  vi.clearAllMocks();
  getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage }), destroy });
});
describe("local PDF extraction", () => {
  it("preserves line and page boundaries and destroys the loading task", async () => {
    const cleanup = vi.fn();
    getPage.mockResolvedValue({
      cleanup,
      getTextContent: async () => ({
        items: [
          { str: "3.2 Administration", transform: [1, 0, 0, 1, 0, 100], hasEOL: false },
          { str: "fee £150", transform: [1, 0, 0, 1, 0, 80], hasEOL: true },
        ],
      }),
    });
    const progress = vi.fn();
    expect(await readPdfText(file, progress)).toBe(
      "3.2 Administration \nfee £150\n\n3.2 Administration \nfee £150",
    );
    expect(progress).toHaveBeenLastCalledWith(100);
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("rejects unreadable pages instead of analysing an incomplete document", async () => {
    getPage.mockResolvedValue({ cleanup: vi.fn(), getTextContent: async () => ({ items: [] }) });
    await expect(readPdfText(file)).rejects.toThrow("scanned images");
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("cleans up after a damaged PDF fails to load", async () => {
    getDocument.mockReturnValue({ promise: Promise.reject(new Error("Invalid PDF")), destroy });
    await expect(readPdfText(file)).rejects.toThrow("Invalid PDF");
    expect(destroy).toHaveBeenCalledOnce();
  });
});
