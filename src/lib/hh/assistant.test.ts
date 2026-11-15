import { describe, it, expect } from "vitest";
import { resolveTurn } from "./assistant";
import { CITIES, applyFilters, bedRange, defaultFilters, matchesSearch } from "./find";

const city = CITIES[0]!;
const beds = bedRange(city);
type Change = "rent" | "bedrooms" | "epc" | "availability" | "type" | "layer";
const ALL: Change[] = ["rent", "bedrooms", "epc", "availability", "type", "layer"];
const base = { clarify: false, changes: ALL, maxRent: 150, minBeds: 4, maxBeds: beds.max, epc: "any", availability: "available", type: "all", layer: "crime", areaId: "stay", sortBy: "noise", open: "best", houseId: "none", lead: "Done." } as const;

describe("ask-the-map grounding", () => {
  it("opens the best house that really satisfies the filters", () => {
    const { action, reply } = resolveTurn(city, base);
    const picked = city.houses.find((h) => h.id === action.houseId)!;
    const matches = applyFilters(city.houses, action.filters);
    expect(matches).toContain(picked);
    expect(Math.min(...matches.map((h) => h.xray.noise))).toBe(picked.xray.noise);
    expect(reply).toContain(picked.name);
    expect(reply).toContain(`${matches.length} found`);
  });

  it("clamps out-of-range filters, explains the largest size and ignores unknown ids", () => {
    const { action, reply } = resolveTurn(city, { ...base, maxRent: 20, minBeds: 15, maxBeds: 15, areaId: "atlantis", open: "named", houseId: "mansion" });
    expect(action.filters.maxRent).toBe(Math.min(...city.houses.map((h) => h.rent)));
    expect([action.filters.minBeds, action.filters.maxBeds]).toEqual([beds.max, beds.max]);
    expect(reply).toContain(`largest house listed has ${beds.max} bedrooms`);
    expect(action.houseId).toBeUndefined();
    expect(action.areaId).toBeUndefined();
  });

  it("maps a bedroom range and counts only the area the student is in", () => {
    const { action, reply } = resolveTurn(city, { ...base, maxRent: 999, minBeds: 4, maxBeds: 5, availability: "all", sortBy: "none", open: "none" }, { filters: defaultFilters(city), layer: "all", areaId: "claypath" });
    const n = applyFilters(city.houses, action.filters).filter((h) => h.area === "claypath").length;
    expect([action.filters.minBeds, action.filters.maxBeds]).toEqual([4, 5]);
    expect(reply).toContain(`Showing 4–5-bedroom houses in Claypath: ${n} found.`);
  });

  it("suggests the nearest bedroom size when nothing matches", () => {
    const cheapest = Math.min(...city.houses.map((h) => h.rent));
    const only = city.houses.filter((h) => h.rent <= cheapest);
    const missing = [beds.min, beds.max].find((b) => !only.some((h) => h.bedrooms === b))!;
    const { reply } = resolveTurn(city, { ...base, maxRent: cheapest, minBeds: missing, maxBeds: missing, availability: "all", sortBy: "none", open: "none" });
    expect(reply).toContain(": 0 found.");
    expect(reply).toMatch(/nearest size with results is \d+ bedrooms/);
  });

  it("asks one question and changes nothing when the request is vague", () => {
    const current = { filters: { ...defaultFilters(city), maxRent: 140 }, layer: "epc" as const, areaId: null };
    const { action, reply } = resolveTurn(city, { ...base, clarify: true, minBeds: 6, lead: "How many of you are there?" }, current);
    expect(reply).toBe("How many of you are there?");
    expect(action).toEqual({ filters: current.filters, layer: "epc" });
  });

  it("keeps the live slider range unless the message changes bedrooms", () => {
    const current = { filters: { ...defaultFilters(city), minBeds: 4, maxBeds: 6 }, layer: "all" as const, areaId: null };
    const { action, reply } = resolveTurn(city, { ...base, changes: ["availability"] as Change[], minBeds: 4, maxBeds: 5, maxRent: 150, sortBy: "none", open: "none" }, current);
    expect([action.filters.minBeds, action.filters.maxBeds]).toEqual([4, 6]);
    expect(action.filters.maxRent).toBe(current.filters.maxRent);
    expect(action.filters.availability).toBe("available");
    expect(reply).toContain("4–6-bedroom");
  });

  it("clears filters that would hide a house the student named", () => {
    const pricey = city.houses.find((h) => h.rent > 150)!;
    const { action, reply } = resolveTurn(city, { ...base, open: "named", houseId: pricey.id });
    expect(action.houseId).toBe(pricey.id);
    expect(applyFilters([pricey], action.filters)).toHaveLength(1);
    expect(reply).toContain(`£${pricey.rent} pppw`);
  });
});

describe("ask-the-map search", () => {
  const ask = { ...base, changes: [] as Change[], sortBy: "none" as const, open: "none" as const, search: "Whinney Hill" };
  it("'find Whinney Hill' fills the search box and counts only matching houses", () => {
    const { action, reply } = resolveTurn(city, ask);
    expect(action.query).toBe("Whinney Hill");
    expect(reply).toContain('Searching for "Whinney Hill".');
    expect(reply).toContain(`: ${city.houses.filter((h) => matchesSearch(city, h, "Whinney Hill")).length} found.`);
  });
  it("widens to the whole city when the current area has no match", () => {
    const { action } = resolveTurn(city, ask, { filters: defaultFilters(city), layer: "all", areaId: "claypath" });
    expect(action.areaId).toBeNull();
    expect(resolveTurn(city, ask, { filters: defaultFilters(city), layer: "all", areaId: "elvet" }).action.areaId).toBeUndefined();
  });
  it("leaves the search box empty when nothing was searched for", () => {
    expect(resolveTurn(city, { ...base, search: "" }).action.query).toBeUndefined();
  });
});
