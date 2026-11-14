import { describe, it, expect } from "vitest";
import { scan } from "./scanner";
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
