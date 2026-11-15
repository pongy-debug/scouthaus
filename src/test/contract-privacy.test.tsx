import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { analyseContract, summariseContract, readPdf } = vi.hoisted(() => ({ analyseContract: vi.fn(), summariseContract: vi.fn(), readPdf: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract, summariseContract, draftEmail: vi.fn(), reviseEmail: vi.fn() }));
vi.mock("@/lib/hh/pdf", () => ({ readPdf }));
import { ScannerSession } from "@/components/hh/ScannerSession";
import { ContractScanner } from "@/components/hh/ContractScanner";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("redacts pasted text and waits for the privacy check before sending it, then falls back locally", async () => {
  analyseContract.mockResolvedValue({ ok: false, reason: "no-key", message: "No key" });
  summariseContract.mockResolvedValue({ ok: false, reason: "no-key", message: "No key" });
  render(<ContractScanner />);
  const text = ["Tenant: Jane Smith", "Email: jane@example.com", "1. Rent is 150 per week."].join("\n");
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Check my contract" }));
  fireEvent.click(await screen.findByRole("button", { name: /Analyse redacted contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });
  const sent = analyseContract.mock.calls[0]![0].data.text as string;
  expect(sent).toContain("Rent is 150 per week.");
  for (const personal of ["Jane Smith", "jane@example.com"]) expect(sent).not.toContain(personal);
  expect(summariseContract).toHaveBeenCalledWith({ data: { text: sent } });
  expect(screen.getByRole("button", { name: /2 personal details were redacted before AI analysis/ })).toBeVisible();
});
it("sends nothing while the privacy check is open", async () => {
  render(<ContractScanner />);
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: ["Tenant: Jane Smith", "1. Rent is 150 per week."].join("\n") } });
  fireEvent.click(screen.getByRole("button", { name: "Check my contract" }));
  expect(await screen.findByLabelText("Redacted contract preview")).not.toHaveTextContent("Jane Smith");
  expect(analyseContract).not.toHaveBeenCalled();
  expect(summariseContract).not.toHaveBeenCalled();
});
it("keeps built-in sample checks local", async () => {
  render(<ContractScanner />);
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(analyseContract).not.toHaveBeenCalled();
  expect(summariseContract).not.toHaveBeenCalled();
});

it("reads PDF text locally and waits for review before any AI request", async () => {
  readPdf.mockResolvedValue("Tenant: Jane Smith\n1. Rent is £150 per week.");
  analyseContract.mockResolvedValue({ ok: true, address: "Test property", result: { score: 12, clauses: 1, flags: [], illegalFees: 0, unenforceable: 0 } });
  summariseContract.mockResolvedValue({ ok: false, reason: "failed", message: "Summary unavailable" });
  render(<ScannerSession initialInput={{ file: new File(["%PDF-1.4 test"], "contract.pdf", { type: "application/pdf" }) }} />);
  expect(await screen.findByRole("button", { name: "Edit text" })).toBeVisible();
  expect(readPdf).toHaveBeenCalledOnce();
  expect(analyseContract).not.toHaveBeenCalled();
  expect(summariseContract).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Analyse redacted contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(analyseContract.mock.calls[0]![0].data).toEqual({ text: "Tenant: [TENANT_1]\n1. Rent is £150 per week." });
  expect(screen.queryByRole("button", { name: "Edit text" })).toBeNull();
});
it("uses local rules when AI fails after the reviewed PDF text is submitted", async () => {
  analyseContract.mockResolvedValue({ ok: false, reason: "failed", message: "Quota" });
  summariseContract.mockResolvedValue({ ok: false, reason: "failed", message: "Quota" });
  readPdf.mockResolvedValue("1. Tenant must pay an administration fee of 150 pounds.");
  render(<ScannerSession initialInput={{ file: new File(["%PDF-1.4 test"], "contract.pdf", { type: "application/pdf" }) }} />);
  fireEvent.click(await screen.findByRole("button", { name: /Analyse redacted contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(readPdf).toHaveBeenCalledOnce();
  expect(analyseContract).toHaveBeenCalledOnce();
  expect(screen.getByText("Basic on-device check · AI review unavailable")).toBeVisible();
});
