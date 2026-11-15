import { describe, expect, it } from "vitest";
import { applyFilters, areaCircle, bedRange, CITIES, cityForHouse, defaultFilters, findCity, legendFor, photosOf, propertyTypes, riskLabel, riskOf, suggestCities, typeOf } from "./find";
import { resolveTurn } from "./assistant";

const city = findCity("newcastle")!;
describe("Newcastle listings", () => {
  it("resolves both city names and preserves Durham", () => {
    expect(findCity(" Newcastle upon Tyne ")).toBe(city);
    expect(suggestCities("Newcastle upon")).toEqual([city]);
    expect(CITIES.map((c) => c.id)).toEqual(["durham", "newcastle"]);
    expect(city.center).toEqual({ lat: 54.9783, lng: -1.6178 });
    expect(city.areas.filter((a) => a.active).map((a) => a.id)).toEqual(["jesmond", "heaton", "sandyford", "newcastle-city-centre", "chinatown"]);
    expect(city.areas.filter((a) => !a.active).map((a) => a.postcode)).toEqual(["NE8"]);
    // Chinatown & St James' is drawn around Stowell Street, not around the middle of its two listings.
    const chinatown = city.areas.find((a) => a.id === "chinatown")!;
    expect(chinatown.name).toBe("Chinatown & St James'");
    const circle = areaCircle(city, chinatown);
    expect([circle.lat, circle.lng]).toEqual([54.9718, -1.6208]);
  });
  it("has only the ten supplied adverts with ordered remote photos and accurate terms", () => {
    expect(city.houses.map((h) => [h.name, h.bedrooms, h.rent, h.availableFrom])).toEqual([
      ["Lavender Gardens", 5, 166, "2027-07-09"], ["Bayswater Road", 5, 166, "2027-07-01"],
      ["Tavistock Road", 6, 156, "2027-07-06"], ["Hartford Court", 5, 121, "2027-07-06"], ["1 Lillico House", 5, 161, "2027-07-01"],
      ["Ridley Place", 6, 131, "2027-08-12"], ["City Centre (street not published)", 6, 141, "2027-12-01"], ["Westgate Road", 6, 116, "2027-07-01"],
      ["St James' House", 1, 235, "2027-09-05"], ["St James' Point", 1, 183, "2027-09-05"],
    ]);
    expect(city.houses.filter((h) => h.area === "newcastle-city-centre").map((h) => h.postcode)).toEqual(["NE1 8JW", "NE1 6SG", "NE4 6AD"]);
    expect(city.houses.filter((h) => h.area === "chinatown").map((h) => [h.postcode, typeOf(h), h.landlord])).toEqual([["NE1 4NF", "studio", "Student Roost"], ["NE4 5SU", "studio", "Student Roost"]]);
    expect(city.houses.find((h) => h.id === "newcastle-westgate")!.locationNote).toBe("West of the centre");
    expect(city.houses.find((h) => h.id === "newcastle-city-centre")!.rentNote).toContain("£135 pppw from 1 Dec 2026");
    expect(city.houses.find((h) => h.id === "newcastle-st-james-house")!.rentNote).toContain("£245 pppw on 44 weeks");
    for (const h of city.houses) {
      expect(h.sourceUrl).toMatch(/^https:\/\/sturents.com\/.+\?contract=\d+$/);
      expect(photosOf(h)).toHaveLength(2);
      expect(photosOf(h).every((url) => url.startsWith("https://public.sturents.com/photos/"))).toBe(true);
      expect(h.photoCredit).toBe(`${h.landlord} via StuRents`);
      expect(h.approximateLocation).toBe(true);
      expect(cityForHouse(h).walkDestinations?.map((d) => d.name)).toEqual(["Newcastle University (King's Gate)", "Northumbria University (City Campus)"]);
      expect(h.telemetryStatus).toBe("unchecked"); // still no modelled X-ray: only hand-verified checks colour it
    }
    expect(photosOf(city.houses[0]!)[0]).toBe("https://public.sturents.com/photos/8326030.jpg");
  });
  it("filters bedrooms and rent without treating missing EPC data as a rating", () => {
    expect(bedRange(city)).toEqual({ min: 1, max: 6 }); // studios count as 1 bedroom
    expect(applyFilters(city.houses, { ...defaultFilters(city), maxRent: 130 }).map((h) => h.name)).toEqual(["Hartford Court", "Westgate Road"]);
    // Only a listing whose every known band is C or better passes; unchecked EPCs never do.
    expect(applyFilters(city.houses, { ...defaultFilters(city), epc: "C" }).map((h) => h.name)).toEqual(["Hartford Court"]);
    expect(applyFilters(city.houses, { ...defaultFilters(city), epc: "D" }).map((h) => h.name)).toEqual(["Hartford Court"]);
  });
  it("includes 1-bed studios in the bedroom range and separates them with the property type filter", () => {
    expect(propertyTypes(city)).toEqual(["house", "studio"]);
    expect(propertyTypes(findCity("durham")!)).toEqual(["house"]);
    expect(applyFilters(city.houses, { ...defaultFilters(city), maxBeds: 1 }).map((h) => h.name)).toEqual(["St James' House", "St James' Point"]);
    expect(applyFilters(city.houses, { ...defaultFilters(city), type: "studio" }).map((h) => h.name)).toEqual(["St James' House", "St James' Point"]);
    expect(applyFilters(city.houses, { ...defaultFilters(city), type: "house" })).toHaveLength(8);
    const studios = resolveTurn(city, { ...defaultFilters(city), type: "studio", changes: ["type"], layer: "all", areaId: "overview", sortBy: "none", open: "none", houseId: "none", clarify: false, lead: "Studios only." });
    expect(studios.action.filters.type).toBe("studio");
    expect(studios.reply).toContain("Showing all studios: 2 found.");
  });
  it("colours each layer only from what was verified", () => {
    const first5 = city.houses.slice(0, 5);
    const risks = (layer: Parameters<typeof riskOf>[1]) => Object.fromEntries(first5.map((h) => [h.id.replace("newcastle-", ""), riskOf(h, layer)]));
    // The five city-centre adverts: crime is high everywhere (they are in the centre); no EPC could be matched;
    // the three 6-bed houses need an HMO licence and the two studios do not.
    const later = city.houses.slice(5);
    expect(later.map((h) => riskOf(h, "crime"))).toEqual(["high", "high", "high", "high", "high"]);
    expect(later.map((h) => riskOf(h, "epc"))).toEqual(["unknown", "unknown", "unknown", "unknown", "unknown"]);
    expect(later.map((h) => riskOf(h, "hmo"))).toEqual(["med", "med", "med", "low", "low"]);
    // EPC: exact certificate for 1 Lillico House (E); every certificate at Hartford Court's postcode is B–C; the three
    // Jesmond streets span several bands and the adverts give no house number, so they stay unchecked.
    expect(risks("epc")).toEqual({ lavender: "unknown", bayswater: "unknown", tavistock: "unknown", hartford: "low", lillico: "high" });
    // Crime: police.uk reports within 1 mile, relative to the city centre in the same month.
    expect(risks("crime")).toEqual({ lavender: "low", bayswater: "low", tavistock: "low", hartford: "med", lillico: "high" });
    // HMO: the national 5+ bedroom rule needs no lookup.
    expect(risks("hmo")).toEqual({ lavender: "med", bayswater: "med", tavistock: "med", hartford: "med", lillico: "med" });
    expect(risks("all")).toEqual({ lavender: "low", bayswater: "low", tavistock: "low", hartford: "med", lillico: "high" });
    expect(riskLabel(city.houses[0]!, "all")).toBe("Lower risk · EPC not checked");
    expect(riskLabel(city.houses[0]!, "epc")).toBe("EPC not checked yet");
    expect(riskLabel(city.houses[4]!, "epc")).toBe("EPC E (national register)");
    expect(riskLabel(city.houses[3]!, "epc")).toBe("EPC B–C at this postcode");
  });
  it("shows the Not checked yet legend entry only on layers that still have unchecked listings", () => {
    expect(legendFor(city, "epc").unknown).toBe("Not checked yet");
    for (const layer of ["all", "hmo", "crime"] as const) expect(legendFor(city, layer).unknown).toBeUndefined();
    const durham = findCity("durham")!;
    for (const layer of ["all", "epc", "hmo", "crime"] as const) expect(legendFor(durham, layer).unknown).toBe("Not checked yet");
    expect(legendFor(durham, "crime").low).toBe("Quiet");
    expect(legendFor(city, "crime").low).toContain("city-centre");
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
