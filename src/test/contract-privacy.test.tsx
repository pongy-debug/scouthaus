import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AiScan } from "@/lib/hh/gemini";
import { SAMPLES } from "@/lib/hh/samples";

// The mock stands in for the only network call the scanner makes: the request to the Gemini route.
const { analyseContract, summariseContract, draftEmail, reviseEmail } = vi.hoisted(() => ({ analyseContract: vi.fn(), summariseContract: vi.fn(), draftEmail: vi.fn(), reviseEmail: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract, summariseContract, draftEmail, reviseEmail }));
import { ContractScanner } from "@/components/hh/ContractScanner";

const PERSONAL = ["Priya", "Sharma", "Tom", "Okafor", "Mei Lin", "Chen", "priya.sharma@example.com", "tom.okafor@example.com", "meilin.chen@example.com",
  "07700 900123", "+44 7700 900456", "0191 498 0123", "27 Elm Grove", "LS6 2AB", "5 Harbour View", "BS8 4QT", "88 Kingsway", "M20 5PG", "14 Gilesgate", "DH1 1HP", "000912345"];
// What Gemini would answer: it only ever saw placeholders, so it can only quote placeholders.
const answer: AiScan = { ok: true, address: "[PROPERTY_ADDRESS], Durham DH1", result: { clauses: 14, score: 82, scoreReason: "[TENANT_1] and the other tenants face prohibited fees.", illegalFees: 180, unenforceable: 1,
  flags: [{ id: "ai-0", clause: "14.2", label: "ILLEGAL FEE", severity: "red", text: "Tenant must pay £180 for mandatory professional carpet and oven cleaning upon vacating.", statute: "Tenant Fees Act 2019 — banned.", explain: "[TENANT_1], [TENANT_2] and [TENANT_3] cannot be charged this.", fee: 180, ask: "remove the cleaning charge for [PROPERTY_ADDRESS]" }] } };
const sentText = (call = 0) => (analyseContract.mock.calls[call]![0] as { data: { text: string } }).data.text;

const noAi = { ok: false, reason: "no-key", message: "GEMINI_API_KEY is not set" };
beforeEach(() => { summariseContract.mockResolvedValue(noAi); });
afterEach(() => { cleanup(); for (const m of [analyseContract, summariseContract, draftEmail, reviseEmail]) m.mockReset(); vi.restoreAllMocks(); });

it("sample contract: shows the privacy check, sends only placeholders, restores real values locally and makes one request", async () => {
  analyseContract.mockResolvedValue(answer);
  render(<ContractScanner />);
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));

  // Privacy check comes first — nothing has been sent yet.
  expect(await screen.findByRole("heading", { name: "We removed 14 personal details before analysis" })).toBeVisible();
  expect(screen.getByText("Names 3 · Emails 3 · Phones 3 · Addresses 4 · Other 1")).toBeVisible();
  expect(screen.getByText("Automatic redaction can miss things. Please check the preview before sending.")).toBeVisible();
  expect(screen.getByText("Only the redacted version is sent to Google Gemini. Your personal details stay in your browser.")).toBeVisible();
  const list = screen.getByRole("list", { name: "Removed personal details" });
  expect(within(list).getByText("Priya Sharma").closest("li")).toHaveTextContent("Priya Sharma→[TENANT_1]");
  expect(analyseContract).not.toHaveBeenCalled();

  // Preview toggle: what is sent vs the original.
  expect(screen.getByLabelText("Redacted contract preview")).toHaveTextContent("Tenant 1: [TENANT_1], [ADDRESS_1]. Email: [EMAIL_1]. Tel: [PHONE_1].");
  fireEvent.click(screen.getByRole("button", { name: "Show original" }));
  expect(screen.getByLabelText("Original contract preview")).toHaveTextContent("Tenant 1: Priya Sharma, 27 Elm Grove, Leeds LS6 2AB.");

  fireEvent.click(screen.getByRole("button", { name: /Analyse redacted contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });

  // The request to the Gemini route: placeholders in, no personal details, contract terms untouched.
  expect(analyseContract).toHaveBeenCalledTimes(1);
  expect(Object.keys((analyseContract.mock.calls[0]![0] as { data: object }).data)).toEqual(["text"]);
  const out = sentText();
  for (const p of PERSONAL) expect(out).not.toContain(p);
  for (const ph of ["[TENANT_1]", "[TENANT_2]", "[TENANT_3]", "[EMAIL_1]", "[PHONE_3]", "[ADDRESS_2]", "[STUDENT_ID_1]", "[PROPERTY_ADDRESS], Durham DH1"]) expect(out).toContain(ph);
  const clauses = (t: string) => t.split("\n").filter((l) => /^\d+\.\d+ /.test(l) && !l.startsWith("1.2 "));
  expect(clauses(out)).toEqual(clauses(SAMPLES.predatory.text));
  for (const c of ["2.1 The rent is £168 per person per week", "3.2 Tenants must pay an administration fee of £150", "9.4 Landlord or agents may enter", "14.2 Tenant must pay £180", "18.1 Tenant is liable for all damp", "22.3 Deposit will be held", "12 months from 1 July"]) expect(out).toContain(c);

  // Results read naturally: real values were put back in the browser.
  expect(screen.getByText("Priya Sharma and the other tenants face prohibited fees.")).toBeVisible();
  expect(screen.getByText("Priya Sharma, Tom Okafor and Mei Lin Chen cannot be charged this.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /14 personal details were redacted before AI analysis/ }));
  expect(within(await screen.findByRole("dialog")).getByText("tom.okafor@example.com").closest("li")).toHaveTextContent("[EMAIL_2]");
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  // The email is written by Gemini from placeholders; the real names and address are put back in the browser.
  draftEmail.mockResolvedValue({ ok: true, subject: "Tenancy agreement for [PROPERTY_ADDRESS], Durham DH1", body: "Dear Landlord / Letting Agent,\n\nPlease remove the cleaning charge for [PROPERTY_ADDRESS].\n\nKind regards,\n[TENANT_1]\n[TENANT_2]\n[TENANT_3]" });
  fireEvent.click(screen.getByRole("button", { name: "Draft email to landlord/agent" }));
  const dialog = await screen.findByRole("dialog");
  const email = (await within(dialog).findByLabelText("Email") as HTMLTextAreaElement).value;
  expect(within(dialog).getByLabelText("Subject")).toHaveValue("Tenancy agreement for 14 Gilesgate, Durham DH1 1HP");
  expect(email).toContain("remove the cleaning charge for 14 Gilesgate");
  expect(email).toContain("Kind regards,\nPriya Sharma\nTom Okafor\nMei Lin Chen");
  expect(email).not.toMatch(/\[[A-Z_]+_?\d*\]/);
  const draftSent = JSON.stringify(draftEmail.mock.calls[0]![0]);
  for (const p of PERSONAL) expect(draftSent).not.toContain(p);
  expect(draftSent).toContain("[TENANT_3]");
  expect(analyseContract).toHaveBeenCalledTimes(1);
});

it("restoring an item and redacting a selection both change what is sent", async () => {
  analyseContract.mockResolvedValue(answer);
  render(<ContractScanner />);
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));
  await screen.findByRole("heading", { name: /We removed 14 personal details/ });

  fireEvent.click(screen.getByRole("button", { name: "Restore Tom Okafor" }));
  expect(screen.getByRole("heading", { name: "We removed 13 personal details before analysis" })).toBeVisible();

  // Select the landlord company in the preview and redact it by hand.
  const preview = screen.getByLabelText("Redacted contract preview");
  vi.spyOn(window, "getSelection").mockReturnValue({ anchorNode: preview.firstChild, toString: () => "Wearside Student Lets Ltd", removeAllRanges: () => {} } as unknown as Selection);
  fireEvent.mouseUp(preview);
  fireEvent.click(screen.getByRole("button", { name: "Redact this" }));
  expect(screen.getByRole("heading", { name: "We removed 14 personal details before analysis" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: /Analyse redacted contract/ }));
  await waitFor(() => expect(analyseContract).toHaveBeenCalledTimes(1));
  const out = sentText();
  expect(out).toContain("Tenant 2: Tom Okafor,");          // restored → sent as written
  expect(out).toContain("Landlord: [REDACTED_1]");          // manual redaction → placeholder
  expect(out).not.toContain("Wearside");
  expect(out).not.toContain("Priya");
});

it("says so plainly when no personal details are found, and clearing wipes the contract", async () => {
  render(<ContractScanner />);
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: "2.1 The rent is £152 per person per week payable monthly in advance.\n9.1 The Landlord may enter after 24 hours' written notice." } });
  fireEvent.click(screen.getByRole("button", { name: /Check my contract/ }));
  expect(await screen.findByRole("heading", { name: "We found no personal details to remove" })).toBeVisible();
  expect(screen.getByText("No names, contact details, addresses or ID numbers were detected.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Clear contract" }));
  expect(screen.queryByRole("heading", { name: /personal details/ })).toBeNull();
  expect(screen.getByLabelText("Or paste your contract")).toHaveValue("");
  expect(analyseContract).not.toHaveBeenCalled();
});

it("falls back to the on-device check when Gemini is unavailable, still having sent only redacted text", async () => {
  analyseContract.mockResolvedValue({ ok: false, reason: "no-key", message: "GEMINI_API_KEY is not set" } satisfies AiScan);
  render(<ContractScanner />);
  fireEvent.click(screen.getByRole("button", { name: "Try sample contract" }));
  fireEvent.click(await screen.findByRole("button", { name: /Analyse redacted contract/ }));
  await screen.findByRole("region", { name: "Your contract review" });
  expect(screen.getByText(/Basic on-device check/)).toBeVisible();
  for (const c of ["14.2", "9.4", "18.1", "22.3"]) expect(screen.getByText(`Clause ${c}`)).toBeVisible();
  for (const p of PERSONAL) expect(sentText()).not.toContain(p);
});
