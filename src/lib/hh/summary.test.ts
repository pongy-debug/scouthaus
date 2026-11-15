import { describe, expect, it, vi } from "vitest";
import { textPdf } from "./pdfWrite";
import { blocksToText, contractLines, diffText, findClauseLine, mergeRevision, summaryBlocks, tokenize, type ContractSummary } from "./summary";
import { SAMPLES } from "./samples";

const summary: ContractSummary = { overview: "A 12-month tenancy.", keyTerms: [{ term: "rent", value: "£168 per person per week", clause: "2.1" }], tenantMust: [{ text: "Keep it clean", clause: "5.1" }], landlordMust: [], fees: [{ text: "Admin fee", amount: "£150", clause: "3.2" }] };

describe("contract summary helpers", () => {
  it("finds clauses by number, parent number and heading, and reports missing ones", () => {
    const lines = contractLines(SAMPLES.predatory.text);
    const at = (ref: string) => lines[findClauseLine(lines, ref)]?.text.slice(0, 12);
    expect(at("14.2")).toBe("14.2 Tenant ");
    expect(at("Clause 9.4.")).toBe("9.4 Landlord");
    expect(at("22.3(a)")).toBe("22.3 Deposit");
    expect(at("16")).toBe("16.3 A late ");
    expect(at("Schedule A")).toBe("SCHEDULE A —");
    expect(findClauseLine(lines, "99.9")).toBe(-1);
  });

  it("exports every key term, marking missing ones as not stated", () => {
    const text = blocksToText(summaryBlocks(summary, [], "8 Claypath"));
    expect(text).toContain("• Rent and how often it is paid: £168 per person per week (Clause 2.1)");
    expect(text.match(/Not stated in this contract/g)).toHaveLength(9); // 8 key terms + landlord obligations
    expect(text).toContain("• Admin fee — £150 (Clause 3.2)");
    expect(text).toContain("AI-generated summary for information only, not legal advice.");
  });

  it("writes a PDF that a PDF reader can open and read back", async () => {
    const long = Array.from({ length: 120 }, (_, i) => ({ text: `Obligation ${i + 1}: keep the property clean (and tidy) — “as found”`, clause: "5.1" }));
    const bytes = textPdf(summaryBlocks({ ...summary, tenantMust: long }, [], "8 Claypath"));
    expect(new TextDecoder("latin1").decode(bytes.slice(0, 8))).toBe("%PDF-1.4");
    vi.stubGlobal("DOMMatrix", class {});
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: bytes }).promise;
    expect(doc.numPages).toBeGreaterThan(1);
    const page = await (await doc.getPage(1)).getTextContent();
    const text = page.items.map((i) => ("str" in i ? i.str : "")).join(" ");
    expect(text).toContain("Contract summary - 8 Claypath");
    expect(text).toContain("£168 per person per week (Clause 2.1)");
    expect(text).toContain('Obligation 1: keep the property clean (and tidy) - "as found"');
  });
});

describe("AI revision merge", () => {
  it("keeps untouched text byte for byte and restores only what the AI added", () => {
    const sent = [...tokenize("Hi  "), { sent: "[TENANT_1]", original: "Priya" }, ...tokenize(",\nthanks alot.")].map((t) => (typeof t === "string" ? { sent: t, original: t } : t));
    const out = mergeRevision(sent, "Hi  [TENANT_1],\nthanks alot. [TENANT_2] agrees.", (s) => s.replace("[TENANT_2]", "Tom Okafor"));
    expect(out).toBe("Hi  Priya,\nthanks alot. Tom Okafor agrees.");
    expect(diffText("Hi  Priya,\nthanks alot.", out).filter((c) => c.type !== "same")).toEqual([{ type: "add", text: " Tom Okafor agrees." }]);
  });
});
