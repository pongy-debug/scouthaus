import { describe, expect, it } from "vitest";
import { applyFilters, bedRange, CITIES, cityForHouse, defaultFilters, findCity, photosOf, riskLabel, riskOf, suggestCities } from "./find";
import { resolveTurn } from "./assistant";

const city = findCity("newcastle")!;
describe("Newcastle listings", () => {
  it("resolves both city names and preserves Durham", () => {
    expect(findCity(" Newcastle upon Tyne ")).toBe(city);
    expect(suggestCities("Newcastle upon")).toEqual([city]);
    expect(CITIES.map((c) => c.id)).toEqual(["durham", "newcastle"]);
    expect(city.center).toEqual({ lat: 54.9783, lng: -1.6178 });
    expect(city.areas.filter((a) => a.active).map((a) => a.id)).toEqual(["jesmond", "heaton", "sandyford"]);
    expect(city.areas.filter((a) => !a.active).map((a) => a.postcode)).toEqual(["NE1", "NE8"]);
  });
  it("has only the five supplied adverts with ordered remote photos and accurate terms", () => {
    expect(city.houses.map((h) => [h.name, h.bedrooms, h.rent, h.availableFrom])).toEqual([
      ["Lavender Gardens", 5, 166, "2027-07-09"], ["Bayswater Road", 5, 166, "2027-07-01"],
      ["Tavistock Road", 6, 156, "2027-07-06"], ["Hartford Court", 5, 121, "2027-07-06"], ["1 Lillico House", 5, 161, "2027-07-01"],
    ]);
    for (const h of city.houses) {
      expect(h.sourceUrl).toMatch(/^https:\/\/sturents.com\/.+\?contract=\d+$/);
      expect(photosOf(h)).toHaveLength(2);
      expect(photosOf(h).every((url) => url.startsWith("https://public.sturents.com/photos/"))).toBe(true);
      expect(h.photoCredit).toBe(`${h.landlord} via StuRents`);
      expect(h.approximateLocation).toBe(true);
      expect(cityForHouse(h).walkDestinations?.map((d) => d.name)).toEqual(["Newcastle University (King's Gate)", "Northumbria University (City Campus)"]);
      expect(riskLabel(h, "hmo")).toContain("Not checked yet");
      expect(riskOf(h, "all")).toBe("unknown");
    }
    expect(photosOf(city.houses[0]!)[0]).toBe("https://public.sturents.com/photos/8326030.jpg");
  });
  it("filters bedrooms and rent without treating missing EPC data as a rating", () => {
    expect(bedRange(city)).toEqual({ min: 5, max: 6 });
    expect(applyFilters(city.houses, { ...defaultFilters(city), maxRent: 130 }).map((h) => h.name)).toEqual(["Hartford Court"]);
    expect(applyFilters(city.houses, { ...defaultFilters(city), epc: "C" })).toEqual([]);
  });
  it("grounds 5 bed houses in Jesmond in the correct city's data", () => {
    const result = resolveTurn(city, { ...defaultFilters(city), minBeds: 5, maxBeds: 5, changes: ["bedrooms"], layer: "all", areaId: "jesmond", sortBy: "none", open: "none", houseId: "none", clarify: false, lead: "Showing five bedroom houses in Jesmond." });
    expect(result.action.areaId).toBe("jesmond");
    expect(result.reply).toContain("2 found");
    expect(result.reply).toContain("Lavender Gardens");
    expect(result.reply).toContain("Bayswater Road");
    expect(result.reply).not.toContain("Tavistock");
  });
  it("never ranks unknown noise or heating as zero", () => {
    const result = resolveTurn(city, { ...defaultFilters(city), changes: [], layer: "all", areaId: "overview", sortBy: "noise", open: "best", houseId: "none", clarify: false, lead: "" });
    expect(result.reply).toContain("cannot rank by that yet");
    expect(result.reply).not.toContain("noise 0");
    expect(result.reply).not.toContain("heating £0");
  });
});
