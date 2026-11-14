// Shared national sources for any supported city. All credentialed calls stay server-side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CITIES } from "./find";

const Certificate = z.object({
  certificateNumber: z.string(), postcode: z.string(), addressLine1: z.string(),
  addressLine2: z.string().nullable().optional(), addressLine3: z.string().nullable().optional(), addressLine4: z.string().nullable().optional(),
  currentEnergyEfficiencyBand: z.enum(["A", "B", "C", "D", "E", "F", "G"]), registrationDate: z.string(),
});
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** A street-only advert must never inherit a neighbouring house's certificate. */
export function matchCertificate(address: string, postcode: string, rows: z.infer<typeof Certificate>[]) {
  if (!/^\d+\b/.test(address)) return null;
  return rows.filter((r) => normalize(r.postcode) === normalize(postcode)
    && normalize([r.addressLine1, r.addressLine2, r.addressLine3, r.addressLine4].filter(Boolean).join(" ")) === normalize(address))
    .sort((a, b) => b.registrationDate.localeCompare(a.registrationDate))[0] ?? null;
}

export interface PropertyInsights {
  postcode: { district: string; lat: number; lng: number } | null;
  crime: { count: number; month: string } | null;
  epc: { band: string; date: string; certificate: string } | null;
  epcStatus: "matched" | "not-configured" | "address-needed" | "not-found" | "unavailable";
}

async function json(url: string, headers?: Record<string, string>) {
  const response = await fetch(url, { ...(headers ? { headers } : {}), signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Data source returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export const getPropertyInsights = createServerFn({ method: "GET" })
  .inputValidator((value: unknown) => z.object({ houseId: z.string().max(100) }).parse(value))
  .handler(async ({ data }): Promise<PropertyInsights> => {
    const house = CITIES.flatMap((c) => c.houses).find((h) => h.id === data.houseId);
    if (!house) throw new Error("Unknown listing");
    const token = process.env["EPC_API_TOKEN"];
    const result: PropertyInsights = { postcode: null, crime: null, epc: null, epcStatus: token ? "address-needed" : "not-configured" };
    await Promise.allSettled([
      (async () => {
        const body = z.object({ result: z.object({ latitude: z.number(), longitude: z.number(), admin_district: z.string() }) }).parse(
          await json(`https://api.postcodes.io/postcodes/${encodeURIComponent(house.postcode)}`));
        result.postcode = { district: body.result.admin_district, lat: body.result.latitude, lng: body.result.longitude };
      })(),
      (async () => {
        const latest = z.object({ date: z.string() }).parse(await json("https://data.police.uk/api/crime-last-updated")).date.slice(0, 7);
        const rows = z.array(z.object({ month: z.string(), category: z.string() })).parse(await json(
          `https://data.police.uk/api/crimes-street/all-crime?lat=${house.lat}&lng=${house.lng}&date=${latest}`));
        result.crime = { count: rows.length, month: latest };
      })(),
      (async () => {
        if (!token || !/^\d+\b/.test(house.address)) return;
        result.epcStatus = "unavailable";
        const query = new URLSearchParams({ postcode: house.postcode, address: house.address });
        const body = z.object({ data: z.array(Certificate) }).parse(await json(
          `https://api.get-energy-performance-data.communities.gov.uk/api/domestic/search?${query}`, { Authorization: `Bearer ${token}`, Accept: "application/json" }));
        const certificate = matchCertificate(house.address, house.postcode, body.data);
        result.epcStatus = certificate ? "matched" : "not-found";
        if (certificate) result.epc = { band: certificate.currentEnergyEfficiencyBand, date: certificate.registrationDate, certificate: certificate.certificateNumber };
      })(),
    ]);
    return result;
  });
