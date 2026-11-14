import { afterEach, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }));
import { getPropertyInsights, matchCertificate } from "./propertyInsights";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const certificate = { certificateNumber: "1234", postcode: "NE2 1BN", addressLine1: "1 Lillico House", addressLine2: "Sandyford Road", currentEnergyEfficiencyBand: "C" as const, registrationDate: "2026-01-01" };
it("only matches an exact full address and postcode", () => {
  expect(matchCertificate("1 Lillico House, Sandyford Road", "NE2 1BN", [certificate])).toEqual(certificate);
  expect(matchCertificate("Sandyford Road", "NE2 1BN", [certificate])).toBeNull();
  expect(matchCertificate("2 Lillico House, Sandyford Road", "NE2 1BN", [certificate])).toBeNull();
  expect(matchCertificate("1 Lillico House, Sandyford Road", "NE2 3DE", [certificate])).toBeNull();
});
it("uses national endpoints, keeps the EPC token server-side, and returns only matched data", async () => {
  vi.stubEnv("EPC_API_TOKEN", "test-only");
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => {
    if (url.includes("postcodes.io")) return { result: { latitude: 54.982211, longitude: -1.600881, admin_district: "Newcastle upon Tyne" } };
    if (url.includes("crime-last-updated")) return { date: "2026-09-01" };
    if (url.includes("crimes-street")) return [{ month: "2026-09", category: "burglary" }];
    return { data: [certificate] };
  } }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await getPropertyInsights({ data: { houseId: "newcastle-lillico" } });
  expect(result.epc?.band).toBe("C");
  expect(result.crime).toEqual({ count: 1, month: "2026-09" });
  expect(result.postcode?.district).toBe("Newcastle upon Tyne");
  expect(JSON.stringify(result)).not.toContain("test-only");
  expect(fetchMock.mock.calls.some(([url]) => /durham|hmo/i.test(url))).toBe(false);
});
it("degrades to unknown data when services are offline", async () => {
  vi.stubEnv("EPC_API_TOKEN", "");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect(await getPropertyInsights({ data: { houseId: "newcastle-lavender" } })).toEqual({ postcode: null, crime: null, epc: null, epcStatus: "not-configured" });
});
