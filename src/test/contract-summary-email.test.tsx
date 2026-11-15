import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AiEmail, AiScan, AiSummary } from "@/lib/hh/gemini";

// The four mocks stand in for the only network calls the scanner makes: the server functions that call Gemini.
const { analyseContract, summariseContract, draftEmail, reviseEmail } = vi.hoisted(() => ({ analyseContract: vi.fn(), summariseContract: vi.fn(), draftEmail: vi.fn(), reviseEmail: vi.fn() }));
vi.mock("@/lib/hh/gemini", () => ({ analyseContract, summariseContract, draftEmail, reviseEmail }));
import { SAMPLES } from "@/lib/hh/samples";
import { restoreText, detectRedactions } from "@/lib/hh/redact";
import { EmailDrafter } from "@/components/hh/EmailDrafter";
import { ContractScanner } from "@/components/hh/ContractScanner";

// The three sample tenants' names, emails, phones and addresses.
const PERSONAL = ["Priya", "Sharma", "Tom", "Okafor", "Mei Lin", "Chen", "priya.sharma@example.com", "tom.okafor@example.com", "meilin.chen@example.com",
  "07700 900123", "+44 7700 900456", "0191 498 0123", "27 Elm Grove", "LS6 2AB", "5 Harbour View", "BS8 4QT", "88 Kingsway", "M20 5PG", "14 Gilesgate", "DH1 1HP", "000912345"];

const flag = (id: string, clause: string, label: string, text: string, explain: string, ask: string) => ({ id, clause, label, severity: "red" as const, text, statute: "Tenant Fees Act 2019, Schedule 1 — banned.", explain, fee: 0, ask });
const analysis: AiScan = { ok: true, address: "[PROPERTY_ADDRESS], Durham DH1", result: { clauses: 14, score: 82, scoreReason: "Prohibited fees.", illegalFees: 330, unenforceable: 2, flags: [
  flag("ai-0", "3.2", "ILLEGAL FEE", "Tenants must pay an administration fee of £150 upon signing this agreement.", "[TENANT_1] cannot be charged an admin fee. It is banned.", "remove the administration fee"),
  flag("ai-1", "14.2", "ILLEGAL FEE", "Tenant must pay £180 for mandatory professional carpet and oven cleaning upon vacating.", "A fixed cleaning fee is a prohibited payment.", "remove the cleaning charge"),
] } };
const summary: AiSummary = { ok: true, summary: {
  overview: "This is an assured shorthold tenancy between Wearside Student Lets Ltd and [TENANT_1], [TENANT_2] and [TENANT_3] for [PROPERTY_ADDRESS], Durham DH1. It runs for 12 months from 1 July.",
  keyTerms: [
    { term: "rent", value: "£168 per person per week, paid termly in advance", clause: "2.1" },
    { term: "deposit", value: "Held in the landlord's personal business account", clause: "22.3" },
    { term: "dates", value: "12 months from 1 July", clause: "1.1" },
    { term: "type", value: "Fixed term", clause: "1.1" },
    { term: "tenants", value: "Three tenants; [TENANT_1] is lead tenant", clause: "Schedule A, 1.2" },
    { term: "notice", value: "", clause: "" },
  ],
  tenantMust: [{ text: "Keep the inside clean and in good condition", clause: "5.1" }, { text: "No pets without written consent", clause: "12.1" }],
  landlordMust: [],
  fees: [{ text: "Administration fee on signing", amount: "£150", clause: "3.2" }, { text: "Late payment charge", amount: "£50", clause: "16.3" }],
} };
const drafted: AiEmail = { ok: true, subject: "Requested changes to the tenancy agreement for [PROPERTY_ADDRESS], Durham DH1",
  body: "Dear Landlord / Letting Agent,\n\nThank you for the draft agreement for [PROPERTY_ADDRESS], Durham DH1.\n\nClause 3.2 (\"administration fee of £150\") is a prohibited payment under the Tenant Fees Act 2019. Please remove it.\n\nPlease send a revised contract and confirm when you will reply.\n\nKind regards,\n[TENANT_1]\n[TENANT_2]\n[TENANT_3]" };

const scrolled: string[] = [];
beforeEach(() => {
  analyseContract.mockResolvedValue(JSON.parse(restoreText(JSON.stringify(analysis), detectRedactions(SAMPLES.predatory.text)))); summariseContract.mockResolvedValue(JSON.parse(restoreText(JSON.stringify(summary), detectRedactions(SAMPLES.predatory.text)))); draftEmail.mockResolvedValue(drafted);
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this.id); };
});
afterEach(() => { cleanup(); for (const m of [analyseContract, summariseContract, draftEmail, reviseEmail]) m.mockReset(); vi.restoreAllMocks(); });

async function review() {
  render(<ContractScanner />);
  fireEvent.change(screen.getByLabelText("Or paste your contract"), { target: { value: SAMPLES.predatory.text } });
  fireEvent.click(screen.getByRole("button", { name: "Check my contract" }));
  return screen.findByRole("region", { name: "Your contract review" });
}
async function openEmail() {
  cleanup();
  render(<EmailDrafter open onOpenChange={() => {}} flags={analysis.ok ? analysis.result.flags : []} risk="High risk" address="14 Gilesgate, Durham DH1 1HP" items={detectRedactions(SAMPLES.predatory.text)} />);
  const dialog = await screen.findByRole("dialog");
  const body = (await within(dialog).findByLabelText("Email")) as HTMLTextAreaElement;
  return { dialog, body };
}
const everythingSent = () => JSON.stringify([draftEmail, reviseEmail].flatMap((m) => m.mock.calls.map((c) => c[0])));

it("1 · shows the Contract summary above the red flags, every key term filled in or marked not stated", async () => {
  const region = await review();
  const panel = await within(region).findByRole("region", { name: "Contract summary" });
  // Above the red flags.
  const firstFlag = within(region).getByText("Clause 3.2", { selector: "span.ml-2" });
  expect(panel.compareDocumentPosition(firstFlag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // The summary preserves the original names.
  expect(within(panel).getByText(/between Wearside Student Lets Ltd and Priya Sharma, Tom Okafor and Mei Lin Chen for 14 Gilesgate, Durham DH1 1HP/)).toBeVisible();
  const rows = within(within(panel).getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent);
  expect(rows).toEqual([
    "Rent and how often it is paid£168 per person per week, paid termly in advanceClause 2.1",
    "Deposit and where it is protectedHeld in the landlord's personal business accountClause 22.3",
    "Tenancy start and end dates12 months from 1 JulyClause 1.1",
    "Tenancy type (fixed or periodic)Fixed termClause 1.1",
    "Notice needed to leaveNot stated in this contract—",
    "Bills included or notNot stated in this contract—",
    "Number of tenants and joint liabilityThree tenants; Priya Sharma is lead tenantClause Schedule AClause 1.2",
    "Guarantor required or notNot stated in this contract—",
    "Break clauseNot stated in this contract—",
  ]);
  for (const h of ["Key terms", "What you are agreeing to do", "What the landlord must do", "Fees and charges", "Watch out"]) expect(within(panel).getByRole("heading", { name: h })).toBeVisible();
  expect(within(panel).getByText("AI-generated summary for information only, not legal advice. Check it against the contract.")).toBeVisible();
  expect(within(panel).getByRole("button", { name: /Copy summary/ })).toBeVisible();
  expect(within(panel).getByRole("button", { name: /Download as PDF/ })).toBeVisible();
  expect(summariseContract.mock.calls[0]![0]).toEqual(analyseContract.mock.calls[0]![0]); // the same original text
});

it("2 · each summary item links to the right clause, and Watch out links to the full entry", async () => {
  const region = await review();
  const panel = await within(region).findByRole("region", { name: "Contract summary" });
  const current = () => within(region).getByRole("region", { name: "Contract text" }).querySelector('[aria-current="location"]')?.textContent;
  const cases: [string, string][] = [["Clause 2.1", "2.1 The rent is £168"], ["Clause 22.3", "22.3 Deposit will be held"], ["Clause 5.1", "5.1 The Tenant shall keep"], ["Clause 12.1", "12.1 The Tenant shall not keep any pets"], ["Clause 16.3", "16.3 A late payment charge of £50"], ["Clause Schedule A", "SCHEDULE A — THE PARTIES"], ["Clause 1.2", "1.2 Priya Sharma is the lead tenant"]];
  for (const [name, starts] of cases) {
    fireEvent.click(within(panel).getAllByRole("button", { name })[0]!);
    await waitFor(() => expect(current()).toContain(starts));
    expect(scrolled[scrolled.length - 1]).toMatch(/^contract-line-\d+$/);
  }
  // Watch out: one line per flag, pointing down to its full entry.
  expect(within(panel).getByText("Illegal Fee: Priya Sharma cannot be charged an admin fee.")).toBeVisible();
  fireEvent.click(within(panel).getByRole("button", { name: "Full entry for clause 14.2" }));
  expect(await within(region).findByText(/"Tenant must pay £180 for mandatory professional carpet/)).toBeVisible();
});

it("summary: loading state, a clear error with Try again, and Regenerate", async () => {
  let finish!: (v: AiSummary) => void;
  summariseContract.mockReturnValueOnce(new Promise<AiSummary>((ok) => { finish = ok; }));
  const region = await review();
  expect(within(region).getByText("Writing your contract summary…")).toBeVisible();
  finish({ ok: false, reason: "failed", message: "Gemini timed out" });
  expect(await within(region).findByText(/Gemini timed out/)).toBeVisible();
  fireEvent.click(within(region).getByRole("button", { name: "Try again" }));
  expect(await within(region).findByRole("heading", { name: "Key terms" })).toBeVisible();
  fireEvent.click(within(region).getByRole("button", { name: /Regenerate/ }));
  await waitFor(() => expect(summariseContract).toHaveBeenCalledTimes(3));
});

it("3 · the email comes from a Gemini request holding only redacted flags, statute, risk level and tone", async () => {
  await review();
  const { dialog, body } = await openEmail();
  expect(draftEmail).toHaveBeenCalledTimes(1);
  expect(draftEmail.mock.calls[0]![0]).toEqual({ data: {
    flags: [
      { clause: "3.2", label: "ILLEGAL FEE", severity: "red", quote: "Tenants must pay an administration fee of £150 upon signing this agreement.", statute: "Tenant Fees Act 2019, Schedule 1 — banned.", explain: "[TENANT_1] cannot be charged an admin fee. It is banned.", ask: "remove the administration fee" },
      { clause: "14.2", label: "ILLEGAL FEE", severity: "red", quote: "Tenant must pay £180 for mandatory professional carpet and oven cleaning upon vacating.", statute: "Tenant Fees Act 2019, Schedule 1 — banned.", explain: "A fixed cleaning fee is a prohibited payment.", ask: "remove the cleaning charge" },
    ],
    risk: "High risk", tone: "polite",
    parties: { tenants: ["[TENANT_1]", "[TENANT_2]", "[TENANT_3]"], recipients: [], property: "[PROPERTY_ADDRESS], Durham DH1" },
  } });
  // Shown with real names, swapped in locally.
  expect(within(dialog).getByLabelText("Subject")).toHaveValue("Requested changes to the tenancy agreement for 14 Gilesgate, Durham DH1 1HP");
  expect(body.value).toContain("Kind regards,\nPriya Sharma\nTom Okafor\nMei Lin Chen");
  expect(within(dialog).getByText("Drafted by AI. Read it before sending. This is not legal advice.")).toBeVisible();
  expect(within(dialog).getByRole("link", { name: /Open in my email app/ })).toHaveAttribute("href", `mailto:?subject=${encodeURIComponent("Requested changes to the tenancy agreement for 14 Gilesgate, Durham DH1 1HP")}&body=${encodeURIComponent(body.value)}`);
  // Changing the tone redrafts.
  fireEvent.click(within(dialog).getByRole("radio", { name: "Firm" }));
  await waitFor(() => expect(draftEmail).toHaveBeenCalledTimes(2));
  expect((draftEmail.mock.calls[1]![0] as { data: { tone: string } }).data.tone).toBe("firm");
});

it("4 + 5 · a manual edit survives an AI revision that adds one sentence, and Undo restores the previous draft", async () => {
  await review();
  const { dialog, body } = await openEmail();
  // Manual edit, including a new phone number the contract never held.
  const edited = body.value.replace("Thank you for the draft agreement", "Thanks so much for sending over the draft agreement (call Priya on 07700 900999)");
  fireEvent.change(body, { target: { value: edited } });

  // Gemini returns the draft it was sent with one sentence added — exactly what the prompt requires.
  reviseEmail.mockImplementation(async ({ data }: { data: { subject: string; body: string } }) => ({ ok: true, subject: data.subject,
    body: data.body.replace("Please send a revised contract", "The boiler is also broken and needs repairing before we move in.\n\nPlease send a revised contract") }));
  fireEvent.change(within(dialog).getByLabelText("Ask AI to change or add something"), { target: { value: "also mention the broken boiler, Tom Okafor noticed it" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Update email/ }));
  await within(dialog).findByRole("region", { name: "What changed" });

  // The request held the CURRENT draft (manual edit included) and the instruction, all redacted.
  const sent = (reviseEmail.mock.calls[0]![0] as { data: { subject: string; body: string; instruction: string } }).data;
  expect(sent.body).toContain("Thanks so much for sending over the draft agreement (call [TENANT_1] on [PHONE_4])");
  expect(sent.body).toContain("Kind regards,\n[TENANT_1]\n[TENANT_2]\n[TENANT_3]");
  expect(sent.instruction).toBe("also mention the broken boiler, [TENANT_2] noticed it");
  expect(JSON.stringify(sent)).not.toContain("07700 900999");

  // Result: the manual edit is intact, and the only difference is the added sentence.
  const added = "The boiler is also broken and needs repairing before we move in.\n\n";
  expect(body.value).toBe(edited.replace("Please send a revised contract", `${added}Please send a revised contract`));
  const changed = within(dialog).getByRole("region", { name: "What changed" });
  expect([...changed.querySelectorAll("mark")].slice(1).map((m) => m.textContent).join("")).toBe(added);
  expect(changed.querySelectorAll("p del")).toHaveLength(0);
  expect(within(within(dialog).getByRole("list", { name: "Version history" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual(
    ["1.Polite draftRestore", "2.Your editsRestore", "3.AI: also mention the broken boiler, Tom Okafor notic…current"]);

  // Undo → the draft as it was before the AI revision, manual edit and all.
  fireEvent.click(within(dialog).getByRole("button", { name: "Undo" }));
  expect(body.value).toBe(edited);
  expect(within(dialog).queryByRole("region", { name: "What changed" })).toBeNull();
});

it("a failed email request shows a clear error with Try again — never a template", async () => {
  draftEmail.mockResolvedValueOnce({ ok: false, reason: "failed", message: "Gemini timed out" });
  await review();
  cleanup();
  render(<EmailDrafter open onOpenChange={() => {}} flags={analysis.ok ? analysis.result.flags : []} risk="High risk" address="14 Gilesgate, Durham DH1 1HP" items={detectRedactions(SAMPLES.predatory.text)} />);
  const dialog = await screen.findByRole("dialog");
  const alert = await within(dialog).findByRole("alert");
  expect(alert).toHaveTextContent("The email could not be draftedGemini timed out.");
  expect(within(dialog).queryByLabelText("Email")).toBeNull(); // no fallback text
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(((await within(dialog).findByLabelText("Email")) as HTMLTextAreaElement).value).toContain("Dear Landlord / Letting Agent");

  // A failed revision keeps the current draft.
  reviseEmail.mockRejectedValueOnce(new Error("network"));
  const before = (within(dialog).getByLabelText("Email") as HTMLTextAreaElement).value;
  fireEvent.change(within(dialog).getByLabelText("Ask AI to change or add something"), { target: { value: "make it shorter" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Update email/ }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("The email could not be updated");
  expect(within(dialog).getByLabelText("Email")).toHaveValue(before);
});

it("6 · no request to Gemini contains the sample tenants' names, emails, phones or addresses", async () => {
  await review();
  const { dialog } = await openEmail();
  fireEvent.click(within(dialog).getByRole("radio", { name: "Brief" }));
  await waitFor(() => expect(draftEmail).toHaveBeenCalledTimes(2));
  reviseEmail.mockImplementation(async ({ data }: { data: { subject: string; body: string } }) => ({ ok: true, subject: data.subject, body: data.body }));
  fireEvent.change(await within(dialog).findByLabelText("Ask AI to change or add something"), { target: { value: "add that Priya Sharma, Tom and Mei Lin Chen all agree; reply to tom.okafor@example.com or 07700 900123, we live at 14 Gilesgate, Durham DH1 1HP" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Update email/ }));
  await waitFor(() => expect(reviseEmail).toHaveBeenCalledTimes(1));
  expect([analyseContract, summariseContract, draftEmail, reviseEmail].map((m) => m.mock.calls.length)).toEqual([1, 1, 2, 1]);
  const all = everythingSent();
  for (const p of PERSONAL) expect(all, p).not.toContain(p);
  expect((reviseEmail.mock.calls[0]![0] as { data: { instruction: string } }).data.instruction).toBe("add that [TENANT_1], [TENANT_2] and [TENANT_3] all agree; reply to [EMAIL_2] or [PHONE_1], we live at [PROPERTY_ADDRESS], Durham DH1");
});
