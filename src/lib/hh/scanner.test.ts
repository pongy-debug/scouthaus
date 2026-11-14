import { describe, it, expect } from "vitest";
import { scan, splitClauses, summarizeContract, buildEmail } from "./scanner";
import { SAMPLES } from "./samples";
describe("contract scanner", () => {
  it("flags the predatory contract's clauses 14.2, 9.4, 18.1, 22.3", () => {
    const r = scan(SAMPLES.predatory.text);
    const ids = r.flags.map((f) => f.clause);
    for (const c of ["14.2", "9.4", "18.1", "22.3"]) expect(ids).toContain(c);
    expect(r.illegalFees).toBe(380);
  });
  it("finds no flags in the fair lease", () => {
    expect(scan(SAMPLES.fair.text).flags).toHaveLength(0);
  });
});

describe("uploaded contract text", () => {
  it("joins wrapped numbered clauses without losing identifiers", () => {
    const text =
      "3.2 Tenants must pay an administration\nfee of £150 upon signing.\n9.4 Agents may enter\nwithout prior notice.";
    expect(splitClauses(text).map((c) => c.num)).toEqual(["3.2", "9.4"]);
    expect(scan(text).flags.map((f) => f.clause)).toEqual(["3.2", "9.4"]);
  });
  it("keeps unnumbered paragraphs available for analysis", () => {
    expect(scan("Tenant is responsible for boiler repairs.").flags).toHaveLength(1);
    expect(splitClauses("   ")).toEqual([]);
  });
  it("summarises source passages and marks missing information", () => {
    const summary = summarizeContract(SAMPLES.fair.text);
    expect(summary.find((d) => d.label === "Rent")?.text).toContain("£152");
    expect(summary.find((d) => d.label === "Deposit")?.clause).toBe("4.1");
    expect(summary.find((d) => d.label === "Bills included")?.text).toBeNull();
  });
  it("includes missing details in an editable clarification email", () => {
    const email = buildEmail([], "14 Gilesgate", ["Bills included"]);
    expect(email).toContain("14 Gilesgate");
    expect(email).toContain("• Bills included");
    expect(email).not.toContain("conflict with English housing law");
  });
});
