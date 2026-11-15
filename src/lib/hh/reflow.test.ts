import { describe, expect, it } from "vitest";
import { reflow } from "./reflow";
import { applyRedactions, detectRedactions } from "./redact";

describe("PDF/OCR reflow", () => {
  it("preserves personal-detail fields while joining wrapped clauses", () => {
    const text = "Tenant: Alice Brown\nLandlord: Henry Smith\nAddress: 27 Elm Grove, Leeds LS6 2AB\n1. Rent is £168\nper person per week.\n2. Deposit is £840.";
    const flowed = reflow(text);
    expect(flowed).toContain("Tenant: Alice Brown\nLandlord: Henry Smith\nAddress:");
    expect(flowed).toContain("1. Rent is £168 per person per week.\n2. Deposit is £840.");
    const sent = applyRedactions(flowed, detectRedactions(flowed)).redacted;
    for (const value of ["Alice Brown", "Henry Smith", "27 Elm Grove", "LS6 2AB"]) expect(sent).not.toContain(value);
    expect(sent).toContain("Rent is £168 per person per week");
  });

  it("keeps next-line names separate from adjacent fields", () => {
    const flowed = reflow("Tenant:\nAlice Brown\nLandlord:\nHenry Smith\n1. Rent is £150.");
    const items = detectRedactions(flowed);
    expect(items.filter((i) => i.kind === "name").map((i) => i.value)).toEqual(["Alice Brown", "Henry Smith"]);
  });

  it("preserves blank breaks and joins ordinary unnumbered prose", () => {
    expect(reflow("The tenant must keep\nthe property clean.\n\nThe landlord must repair\nthe roof."))
      .toBe("The tenant must keep the property clean.\nThe landlord must repair the roof.");
  });
});
