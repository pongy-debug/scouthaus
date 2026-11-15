import { describe, expect, it } from "vitest";
import { verifyQuote } from "./quoteVerification";

const text = "Tenant: Alice Brown\n1. Rent is £168 per week.\n2. The tenant must not pay a cleaning fee.\n14.2 Alice Brown must pay £180 for ‘professional cleaning’.\nThe charge applies on departure.\n15. The landlord repairs the boiler.";

describe("contract quotation checks", () => {
  it("verifies a quotation in the claimed clause and maps the exact text range", () => {
    const check = verifyQuote(text, "Rent is £168 per week.", "Clause 1");
    expect(check.status).toBe("verified");
    expect(text.slice(check.matches[0]!.start, check.matches[0]!.end)).toBe("Rent is £168 per week.");
  });
  it("normalises PDF whitespace and quote marks without changing the source range", () => {
    const quote = '"Alice Brown must pay £180 for \'professional cleaning\'. The charge applies on departure."';
    const check = verifyQuote(text, quote, "14.2");
    expect(check.status).toBe("verified");
    expect(text.slice(check.matches[0]!.start, check.matches[0]!.end)).toContain("\nThe charge");
  });
  it("finds the quotation but reports a wrong clause number", () => {
    const check = verifyQuote(text, "Rent is £168 per week.", "2");
    expect(check.status).toBe("clause-review");
    expect(check.matches[0]!.clause).toBe("1");
  });
  it.each([
    "The landlord pays all bills.",
    "Rent is £198 per week.",
    "The tenant must pay a cleaning fee.",
    "Rent is £16",
    "   ",
  ])("does not verify a missing or materially changed quotation: %s", (quote) => {
    expect(verifyQuote(text, quote, "1")).toEqual({ status: "quote-review", matches: [] });
  });
  it("does not match partial words", () => {
    expect(verifyQuote("1. The tenant prepays rent.", "pays rent", "1").matches).toEqual([]);
  });
  it("reports every occurrence instead of silently choosing one", () => {
    const check = verifyQuote("1. No pets.\n2. No pets.", "No pets.", "1");
    expect(check.status).toBe("clause-review");
    expect(check.matches.map((m) => m.clause)).toEqual(["1", "2"]);
  });
  it("requires clause checking for an unnumbered source", () => {
    expect(verifyQuote("Rent is £168 per week.", "Rent is £168 per week.", "1").status).toBe("clause-review");
  });
  it("keeps dates and punctuation significant", () => {
    expect(verifyQuote("1. Pay by 1 July 2027.", "Pay by 1 July 2028.", "1").status).toBe("quote-review");
    expect(verifyQuote("1. Rent is £1,800.", "Rent is £1800.", "1").status).toBe("quote-review");
  });
});
