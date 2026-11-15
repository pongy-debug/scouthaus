import { expect, it } from "vitest";
import { applyFilters, defaultFilters, findCity, hasTelemetry, riskLabel, riskOf } from "./find";

it("shows one Ruth First House building and matches price to the chosen flat size", () => {
  const city = findCity("durham")!;
  const houses = city.houses.filter((h) => h.id === "claypath-ruth");
  expect(houses).toHaveLength(1);
  expect(houses[0]!.area).toBe("claypath");
  expect(houses[0]!.tourPath).toBe("/tour/first-ruth-house");
  const filters = { ...defaultFilters(city), minBeds: 2, maxBeds: 2, maxRent: 230 };
  expect(applyFilters(houses, filters)).toHaveLength(0);
  expect(applyFilters(houses, { ...filters, minBeds: 3, maxBeds: 3 })).toHaveLength(1);
  expect(applyFilters(houses, { ...filters, maxRent: 250 })).toHaveLength(1);
  expect(hasTelemetry(houses[0]!)).toBe(false);
  // Checked by hand on 2026-11-15: per-flat EPC certificates (mostly D), police.uk crime and the 5+ bedroom HMO rule.
  expect(riskOf(houses[0]!, "epc")).toBe("med");
  expect(riskLabel(houses[0]!, "epc")).toBe("EPC D in most flats (C–E by flat)");
  expect(riskOf(houses[0]!, "hmo")).toBe("low");
  expect(riskOf(houses[0]!, "crime")).toBe("high");
  expect(riskLabel(houses[0]!, "crime")).toBe("250 crime reports within 1 mile");
  expect(riskLabel(houses[0]!, "all")).toBe("Higher risk");
});
