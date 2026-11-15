import { describe, expect, it } from "vitest";
import { checkImageDimensions, contractFileError, MAX_CONTRACT_FILE_BYTES, ocrDimensions } from "./upload";

describe("contract uploads", () => {
  it.each(["pdf", "txt", "jpg", "jpeg", "png", "webp", "bmp", "gif"])("accepts advertised %s files", (extension) => {
    expect(contractFileError(new File(["contract"], `contract.${extension}`))).toBeNull();
  });
  it("accepts the size boundary and rejects files above it", () => {
    const file = new File([new Uint8Array(MAX_CONTRACT_FILE_BYTES)], "contract.PDF");
    expect(contractFileError(file)).toBeNull();
    expect(contractFileError(new File([file, "x"], "contract.pdf"))).toContain("too large");
  });
  it("rejects unadvertised formats", () => {
    expect(contractFileError(new File(["contract"], "contract.docx"))).toContain("Choose a PDF");
  });
  it("accepts image dimension boundaries and rejects either exceeded limit", () => {
    expect(() => checkImageDimensions(5000, 4000)).not.toThrow();
    expect(() => checkImageDimensions(10000, 1000)).not.toThrow();
    expect(() => checkImageDimensions(5001, 4000)).toThrow("20 megapixels");
    expect(() => checkImageDimensions(10001, 100)).toThrow("10,000 pixels");
  });
  it.each([[5000, 4000], [10000, 1000], [2480, 3508], [1000, 1000]])("bounds OCR size for %s × %s", (width, height) => {
    const size = ocrDimensions(width, height);
    expect(size.width * size.height).toBeLessThanOrEqual(9_000_000);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(3500);
    expect(size.scale).toBeLessThanOrEqual(1);
    expect(size.width / size.height).toBeCloseTo(width / height, 2);
  });
  it("rejects invalid rendering dimensions", () => {
    expect(() => ocrDimensions(Infinity, 100)).toThrow("resize");
  });
});
