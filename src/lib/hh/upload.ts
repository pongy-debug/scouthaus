export const CONTRACT_FILE_ACCEPT = ".pdf,.txt,.jpg,.jpeg,.png,.webp,.bmp,.gif,application/pdf,text/plain,image/jpeg,image/png,image/webp,image/bmp,image/gif";
export const CONTRACT_FILE_HINT = "PDF, TXT, JPG/JPEG, PNG, WEBP, BMP or GIF · Max 10 MB per file";
export const MAX_CONTRACT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const MAX_SCANNED_PAGES = 20;
export class ContractReadError extends Error {}

export function checkImageDimensions(width: number, height: number) {
  if (!Number.isFinite(width * height) || width <= 0 || height <= 0) throw new ContractReadError("We couldn’t read this image. Please upload another image.");
  if (width * height > 20_000_000 || Math.max(width, height) > 10_000) throw new ContractReadError("This image exceeds 20 megapixels or 10,000 pixels on either side. Please upload a smaller image.");
}

/** Bound OCR memory without changing the original document. */
export function ocrDimensions(width: number, height: number) {
  if (!Number.isFinite(width * height) || width <= 0 || height <= 0) throw new ContractReadError("We couldn’t resize this document for text recognition. Please upload a smaller image or PDF.");
  const scale = Math.min(1, 3500 / Math.max(width, height), Math.sqrt(9_000_000 / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}

export function contractFileError(file: File): string | null {
  if (file.size > MAX_CONTRACT_FILE_BYTES) return "This file is too large. Choose a file of 10 MB or less.";
  if (!/\.(pdf|txt|jpe?g|png|webp|bmp|gif)$/i.test(file.name)) return "Choose a PDF, TXT, JPG/JPEG, PNG, WEBP, BMP or GIF file.";
  return null;
}
