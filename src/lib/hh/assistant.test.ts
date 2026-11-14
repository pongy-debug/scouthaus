import { describe, it, expect } from "vitest";
import { resolveTurn } from "./assistant";
import { CITIES, applyFilters } from "./find";

const city = CITIES[0]!;
const base = { maxRent: 150, minBeds: 4, epc: "any", availability: "available", layer: "crime", areaId: "stay", sortBy: "noise", open: "best", houseId: "none", lead: "Done." } as const;

describe("ask-the-map grounding", () => {
  it("opens the best house that really satisfies the filters", () => {
    const { action, reply } = resolveTurn(city, base);
    const picked = city.houses.find((h) => h.id === action.houseId)!;
    const matches = applyFilters(city.houses, action.filters);
    expect(matches).toContain(picked);
    expect(Math.min(...matches.map((h) => h.xray.noise))).toBe(picked.xray.noise);
    expect(reply).toContain(picked.name);
  });

  it("clamps out-of-range filters and ignores unknown ids", () => {
    const { action } = resolveTurn(city, { ...base, maxRent: 20, minBeds: 10, areaId: "atlantis", open: "named", houseId: "mansion" });
    expect(action.filters.maxRent).toBe(Math.min(...city.houses.map((h) => h.rent)));
    expect(action.filters.minBeds).toBe(6);
    expect(action.houseId).toBeUndefined();
    expect(action.areaId).toBeUndefined();
  });

  it("clears filters that would hide a house the student named", () => {
    const pricey = city.houses.find((h) => h.rent > 150)!;
    const { action, reply } = resolveTurn(city, { ...base, open: "named", houseId: pricey.id });
    expect(action.houseId).toBe(pricey.id);
    expect(applyFilters([pricey], action.filters)).toHaveLength(1);
    expect(reply).toContain(`£${pricey.rent} pppw`);
  });
});
