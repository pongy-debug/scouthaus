import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AiScan } from "@/lib/hh/gemini";

const { analyseContract, summariseContract } = vi.hoisted(() => ({ analyseContract: vi.fn(), summariseContract: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract, summariseContract, draftEmail: vi.fn(), reviseEmail: vi.fn() }));
import { ContractScanner } from "@/components/hh/ContractScanner";

afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows quote statuses, highlights private original text, and lets the user choose between multiple matches", async () => {
  const contract = "Tenant: Alice Brown\n1. Alice Brown must pay £180 for cleaning.\n2. The landlord repairs the boiler.\n3. Rent is £168 per week.\n4. No pets.\n5. No pets.";
  const makeFlag = (id: string, clause: string, text: string) => ({ id, clause, text, label: "CHECK TERM", severity: "amber" as const, statute: "Example citation", explain: "Please review this term.", fee: 0, ask: "confirm this term" });
  const answer: AiScan = { ok: true, address: "", result: { score: 40, clauses: 5, illegalFees: 0, unenforceable: 0, flags: [
    makeFlag("correct", "1", "[TENANT_1] must pay £180 for cleaning."),
    makeFlag("wrong-number", "9", "The landlord repairs the boiler."),
    makeFlag("missing", "3", "Rent is £198 per week."),
    makeFlag("repeated", "4", "No pets."),
  ] } };
  analyseContract.mockResolvedValue(answer);
  summariseContract.mockResolvedValue({ ok: false, reason: "no-key", message: "No key" });
  const { container } = render(<ContractScanner />);
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: contract } });
  fireEvent.click(screen.getByRole("button", { name: /Check my contract/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Analyse redacted contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });
  const card = (id: string) => container.querySelector(`#flag-${id}`) as HTMLElement;
  expect(within(card("correct")).getByText("Original text verified")).toBeVisible();
  expect(within(card("wrong-number")).getByText("Clause number needs checking")).toBeVisible();
  expect(within(card("missing")).getByText("Original text match needs checking")).toBeVisible();
  expect(analyseContract.mock.calls[0]![0].data.text).not.toContain("Alice Brown");

  fireEvent.click(within(card("correct")).getByRole("button", { name: "View original" }));
  const source = screen.getByRole("region", { name: "Contract text" });
  expect(source.querySelector("mark")).toHaveTextContent("Alice Brown must pay £180 for cleaning.");
  expect(source.querySelector("mark")).not.toHaveTextContent("[TENANT_1]");
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
