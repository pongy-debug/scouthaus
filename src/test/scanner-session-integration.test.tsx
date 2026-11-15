import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const readPdf = vi.hoisted(() => vi.fn());
vi.mock("@/lib/hh/pdf", () => ({ readPdf, readImage: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract: vi.fn(), summariseContract: vi.fn(), draftEmail: vi.fn(), reviseEmail: vi.fn() }));
import { ContractScanner } from "@/components/hh/ContractScanner";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("preserves cancellation when the lazily loaded scanner session is left during PDF reading", async () => {
  readPdf.mockImplementation((_file: File, _progress: unknown, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Reading cancelled", "AbortError")), { once: true });
  }));
  const view = render(<ContractScanner />);
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(["pdf"], "contract.pdf", { type: "application/pdf" })] } });
  await waitFor(() => expect(readPdf).toHaveBeenCalledOnce());
  const signal = readPdf.mock.calls[0]![2] as AbortSignal;
  expect(signal.aborted).toBe(false);
  view.unmount();
  expect(signal.aborted).toBe(true);
});
