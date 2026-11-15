import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AiScan } from "@/lib/hh/gemini";

const { analyseContract, summariseContract, readPdf } = vi.hoisted(() => ({ analyseContract: vi.fn(), summariseContract: vi.fn(), readPdf: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract, summariseContract, draftEmail: vi.fn(), reviseEmail: vi.fn() }));
vi.mock("@/lib/hh/pdf", () => ({ readPdf }));
import { ContractScanner } from "@/components/hh/ContractScanner";
import { ScannerSession } from "@/components/hh/ScannerSession";

afterEach(() => { cleanup(); vi.resetAllMocks(); });

const makeFlag = (id: string, clause: string, text: string) => ({ id, clause, text, label: "CHECK TERM", severity: "amber" as const, statute: "Example citation", explain: "Please review this term.", fee: 0, ask: "confirm this term" });
const answer = (...flags: ReturnType<typeof makeFlag>[]): AiScan => ({ ok: true, address: "", result: { score: 40, clauses: 5, illegalFees: 0, unenforceable: 0, flags } });
const noSummary = { ok: false, reason: "no-key", message: "No key" };
const paste = async (text: string) => {
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /Check my contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });
};

it("shows quote statuses, highlights the quoted text, and lets the user choose between multiple matches", async () => {
  const contract = "Tenant: Alice Brown\n1. Alice Brown must pay £180 for cleaning.\n2. The landlord repairs the boiler.\n3. Rent is £168 per week.\n4. No pets.\n5. No pets.";
  analyseContract.mockResolvedValue(answer(
    makeFlag("correct", "1", "Alice Brown must pay £180 for cleaning."),
    makeFlag("wrong-number", "9", "The landlord repairs the boiler."),
    makeFlag("missing", "3", "Rent is £198 per week."),
    makeFlag("repeated", "4", "No pets."),
  ));
  summariseContract.mockResolvedValue(noSummary);
  const { container } = render(<ContractScanner />);
  await paste(contract);
  const card = (id: string) => container.querySelector(`#flag-${id}`) as HTMLElement;
  expect(within(card("correct")).getByText("Original text verified")).toBeVisible();
  expect(within(card("wrong-number")).getByText("Clause number needs checking")).toBeVisible();
  expect(within(card("missing")).getByText("Original text match needs checking")).toBeVisible();

  fireEvent.click(within(card("correct")).getByRole("button", { name: "View original" }));
  const source = screen.getByRole("region", { name: "Contract text" });
  expect(source.querySelector("mark")).toHaveTextContent("Alice Brown must pay £180 for cleaning.");
  expect(source.querySelector('[aria-current="location"]')).toHaveAttribute("data-clause", "1");

  fireEvent.click(within(card("wrong-number")).getByRole("button", { expanded: false }));
  fireEvent.click(within(card("wrong-number")).getByRole("button", { name: "View original" }));
  expect(source.querySelector('[aria-current="location"]')).toHaveAttribute("data-clause", "2");
  expect(source.querySelector("mark")).toHaveTextContent("The landlord repairs the boiler.");

  fireEvent.click(within(card("repeated")).getByRole("button", { expanded: false }));
  expect(within(card("repeated")).getByText("Multiple matches found. Choose a location to review.")).toBeVisible();
  fireEvent.click(within(card("repeated")).getByRole("button", { name: "View original · Clause 5 · 2" }));
  expect(source.querySelector('[aria-current="location"]')).toHaveAttribute("data-clause", "5");

  fireEvent.click(within(card("missing")).getByRole("button", { expanded: false }));
  fireEvent.click(within(card("missing")).getByRole("button", { name: "View original" }));
  expect(source.querySelector("mark")).toBeNull();
  expect(source).toHaveTextContent("Rent is £168 per week.");
});

it("re-checks the contract with corrected text, and cancelling an edit changes nothing", async () => {
  const contract = "1. Rent is £168 per week.\n2. No pets.";
  analyseContract.mockResolvedValue(answer(makeFlag("pets", "2", "No pets.")));
  summariseContract.mockResolvedValue(noSummary);
  render(<ContractScanner />);
  await paste(contract);
  fireEvent.click(screen.getByRole("button", { name: /Contract text/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
  const editor = () => screen.getByRole("textbox", { name: "Edit contract text" });
  expect(editor()).toHaveValue(contract);
  fireEvent.change(editor(), { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Apply changes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel editing" }));
  expect(screen.getByRole("region", { name: "Contract text" })).toHaveTextContent("£168");
  expect(analyseContract).toHaveBeenCalledTimes(1);

  const corrected = contract.replace("£168", "£198");
  fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
  fireEvent.change(editor(), { target: { value: corrected } });
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  await waitFor(() => expect(analyseContract).toHaveBeenLastCalledWith({ data: { text: corrected } }));
  expect(summariseContract).toHaveBeenLastCalledWith({ data: { text: corrected } });
  await screen.findByRole("region", { name: "Your contract review" });
  expect(screen.getByRole("region", { name: "Contract text" })).toHaveTextContent("£198");
  expect(screen.getByRole("region", { name: "Contract text" })).not.toHaveTextContent("£168");
});

it("keeps an edited sample contract on this device", async () => {
  render(<ContractScanner />);
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(screen.getAllByText("Original text verified").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /Contract text/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit text" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Edit contract text" }), { target: { value: "1. Rent is £150 per week." } });
  fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
  expect(await screen.findByRole("region", { name: "Contract text" })).toHaveTextContent("Rent is £150 per week.");
  expect(analyseContract).not.toHaveBeenCalled();
  expect(summariseContract).not.toHaveBeenCalled();
});

it("reads a directly reviewed PDF on this device only when the user asks to see its text", async () => {
  analyseContract.mockResolvedValue(answer(makeFlag("pets", "2", "No pets.")));
  summariseContract.mockResolvedValue(noSummary);
  readPdf.mockResolvedValue("1. Rent is £168 per week.\n2. No pets.");
  const { container } = render(<ScannerSession initialInput={{ file: new File(["%PDF-1.4 test"], "contract.pdf", { type: "application/pdf" }) }} />);
  await screen.findByRole("region", { name: "Your contract review" });
  expect(readPdf).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "View original" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show contract text" }));
  expect(await screen.findByRole("region", { name: "Contract text" })).toHaveTextContent("No pets.");
  fireEvent.click(within(container.querySelector("#flag-pets") as HTMLElement).getByRole("button", { name: "View original" }));
  expect(screen.getByRole("region", { name: "Contract text" }).querySelector("mark")).toHaveTextContent("No pets.");
  expect(analyseContract).toHaveBeenCalledTimes(1);
});
