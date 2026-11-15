import { expect, it } from "vitest";
import { applyFilters, defaultFilters, findCity, hasTelemetry, riskOf } from "./find";

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
  expect(riskOf(houses[0]!, "epc")).toBe("unknown");
  expect(riskOf(houses[0]!, "hmo")).toBe("unknown");
});
