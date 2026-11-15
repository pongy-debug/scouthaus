import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { analyseContract, summariseContract, readPdf } = vi.hoisted(() => ({ analyseContract: vi.fn(), summariseContract: vi.fn(), readPdf: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract, summariseContract, draftEmail: vi.fn(), reviseEmail: vi.fn() }));
vi.mock("@/lib/hh/pdf", () => ({ readPdf }));
import { ScannerSession } from "@/components/hh/ScannerSession";
import { ContractScanner } from "@/components/hh/ContractScanner";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("analyses original pasted text directly without a redaction step and falls back locally", async () => {
  analyseContract.mockResolvedValue({ ok: false, reason: "no-key", message: "No key" });
  summariseContract.mockResolvedValue({ ok: false, reason: "no-key", message: "No key" });
  render(<ContractScanner />);
  const text = "Tenant: Jane Smith. Email: jane@example.com. Rent is 150 per week.";
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Check my contract" }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(analyseContract).toHaveBeenCalledWith({ data: { text } });
  expect(summariseContract).toHaveBeenCalledWith({ data: { text } });
  expect(screen.queryByText(/Analyse redacted contract/)).not.toBeInTheDocument();
});
it("keeps built-in sample checks local", async () => {
  render(<ContractScanner />);
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(analyseContract).not.toHaveBeenCalled();
  expect(summariseContract).not.toHaveBeenCalled();
});

it("sends the PDF itself to Gemini without running local extraction", async () => {
  analyseContract.mockResolvedValue({ ok: true, address: "Test property", result: { score: 12, clauses: 1, flags: [], illegalFees: 0, unenforceable: 0 } });
  summariseContract.mockResolvedValue({ ok: false, reason: "failed", message: "Summary unavailable" });
  render(<ScannerSession initialInput={{ file: new File(["%PDF-1.4 test"], "contract.pdf", { type: "application/pdf" }) }} />);
  await screen.findByRole("region", { name: "Your contract review" });
  expect(analyseContract).toHaveBeenCalledWith({ data: { pdf: btoa("%PDF-1.4 test") } });
  expect(readPdf).not.toHaveBeenCalled();
  await waitFor(() => expect(summariseContract).toHaveBeenCalledWith({ data: { pdf: btoa("%PDF-1.4 test") } }));
});
it("uses the local reader and rules only after direct PDF analysis fails", async () => {
  analyseContract.mockResolvedValue({ ok: false, reason: "failed", message: "Quota" });
  readPdf.mockResolvedValue("Tenant must pay an administration fee of 150 pounds.");
  render(<ScannerSession initialInput={{ file: new File(["%PDF-1.4 test"], "contract.pdf", { type: "application/pdf" }) }} />);
  await screen.findByRole("region", { name: "Your contract review" });
  expect(readPdf).toHaveBeenCalledTimes(1);
  expect(analyseContract).toHaveBeenCalledTimes(1);
  expect(summariseContract).not.toHaveBeenCalled();
});
