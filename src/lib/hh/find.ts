import { PROPERTIES, epcFromScore, type Property } from "./data";
import { IMAGE_SOURCE } from "./config";

export type Availability = "available" | "under-offer" | "let";

export interface Area {
  id: string; name: string; postcode: string; lat: number; lng: number; active: boolean; note?: string;
}
export interface House {
  id: string; name: string; landlord: string; address: string; area: string; postcode: string;
  lat: number; lng: number; availability: Availability; rent: number; bedrooms: number;
  /** EPC, heating, damp, noise and rent-benchmark telemetry shown in the X-Ray drawer. */
  xray: Property;
  /** The listing's real advert page, saved at import. Leave unset when there is none — never a made-up or generic URL. */
  sourceUrl?: string;
  /** Photo URLs from that advert: main photo first, then up to 4 more. URLs only; images are never downloaded or re-hosted. */
  photos?: string[];
}
export interface City { id: string; name: string; center: { lat: number; lng: number }; areas: Area[]; houses: House[] }

const DURHAM_AREAS: Area[] = [
  { id: "claypath", name: "Claypath", postcode: "DH1", lat: 54.7792, lng: -1.5712, active: true },
  { id: "viaduct", name: "Viaduct", postcode: "DH1", lat: 54.7778, lng: -1.5832, active: true },
  { id: "gilesgate", name: "Gilesgate", postcode: "DH1", lat: 54.7806, lng: -1.5598, active: true },
  { id: "elvet", name: "Elvet", postcode: "DH1", lat: 54.7712, lng: -1.5690, active: true },
  { id: "crossgate", name: "Crossgate", postcode: "DH1", lat: 54.7738, lng: -1.5818, active: true },
  { id: "framwellgate-moor", name: "Framwellgate Moor", postcode: "DH1", lat: 54.7955, lng: -1.5850, active: false },
  { id: "belmont", name: "Belmont", postcode: "DH1", lat: 54.7858, lng: -1.5390, active: false },
  { id: "chester-le-street", name: "Chester-le-Street", postcode: "DH2/DH3", lat: 54.8580, lng: -1.5740, active: false, note: "≈9 km north" },
];

/** Surveyed profile when the listing has one; other demo listings get a modelled profile seeded from their id. */
function telemetry(hs: { id: string; postcode: string; address: string; rent: number }, areaName: string, propertyId?: string): Property {
  const base = propertyId ? PROPERTIES.find((p) => p.id === propertyId) : undefined;
  if (base) return base;
  const seed = [...hs.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const epcScore = 30 + (seed % 50);
  const damp = 20 + ((seed * 7) % 65);
  return {
    id: hs.id, postcode: hs.postcode, address: hs.address, area: areaName, tag: "Demo listing", epc: epcFromScore(epcScore), epcScore,
    bill: Math.round(300 - epcScore * 2.4), billFactors: epcScore > 60 ? ["Cavity wall insulation", "Double glazing"] : ["Solid brick walls", "Older boiler"],
    damp, dampNote: damp >= 60 ? "Older terrace with cold wall surfaces — ventilate daily and check bedrooms for mould." : "Moderate-to-low condensation risk with normal ventilation.",
    noise: 30 + ((seed * 3) % 60), rent: hs.rent, median: Math.round(hs.rent * (0.88 + (seed % 20) / 100)),
  };
}

const h = (id: string, name: string, landlord: string, address: string, area: string, postcode: string, lat: number, lng: number, availability: Availability, rent: number, bedrooms: number, propertyId?: string): House =>
  ({ id, name, landlord, address, area, postcode, lat, lng, availability, rent, bedrooms,
    xray: telemetry({ id, postcode, address, rent }, DURHAM_AREAS.find((a) => a.id === area)!.name, propertyId) });

// Fictional demo listings placed on real Durham street coordinates.
const DURHAM_HOUSES: House[] = [
  h("claypath-8", "Claypath Lofts", "Wear Valley Lettings", "8 Claypath", "claypath", "DH1 3LE", 54.7788, -1.5718, "available", 152, 4, "claypath"),
  h("claypath-ruth", "First Ruth House", "Ruth Property Co.", "31 Providence Row", "claypath", "DH1 1RS", 54.7800, -1.5702, "under-offer", 148, 5),
  h("claypath-mews", "Kepier Mews", "Bill Free Homes", "4 Kepier Terrace", "claypath", "DH1 1JW", 54.7808, -1.5728, "available", 139, 3),
  h("claypath-tower", "Tower Court", "Durham Student Rooms", "12 Tenter Terrace", "claypath", "DH1 4RD", 54.7781, -1.5700, "let", 160, 6),
  h("viaduct-42", "The Viaduct House", "Northern Key Estates", "42 The Viaduct", "viaduct", "DH1 4EN", 54.7776, -1.5838, "available", 142, 4, "viaduct"),
  h("viaduct-hawthorn", "Hawthorn Terrace", "Bill Free Homes", "14 Hawthorn Terrace", "viaduct", "DH1 4EL", 54.7769, -1.5848, "available", 138, 5),
  h("viaduct-mistletoe", "Mistletoe Street", "Castle Lettings", "22 Mistletoe Street", "viaduct", "DH1 4EP", 54.7783, -1.5826, "under-offer", 135, 4),
  h("viaduct-lawson", "Lawson Terrace", "Ruth Property Co.", "9 Lawson Terrace", "viaduct", "DH1 4EW", 54.7790, -1.5843, "let", 132, 3),
  h("gilesgate-14", "Gilesgate Terrace", "Peninsula Homes", "14 Gilesgate", "gilesgate", "DH1 1HP", 54.7801, -1.5640, "available", 168, 5, "gilesgate"),
  h("gilesgate-sherburn", "Sherburn Road House", "Wear Valley Lettings", "61 Sherburn Road", "gilesgate", "DH1 2JR", 54.7790, -1.5570, "available", 125, 4),
  h("gilesgate-vane", "Vane Tempest Hall", "Durham Student Rooms", "3 Vane Tempest", "gilesgate", "DH1 1QG", 54.7815, -1.5605, "let", 130, 6),
  h("gilesgate-moor", "Moor House", "Castle Lettings", "18 Bradford Crescent", "gilesgate", "DH1 1HL", 54.7822, -1.5580, "under-offer", 128, 4),
  h("elvet-bailey", "Saddler Street Rooms", "Peninsula Homes", "5 Saddler Street", "elvet", "DH1 3HP", 54.7745, -1.5745, "available", 185, 4, "bailey"),
  h("elvet-hallgarth", "Hallgarth House", "Northern Key Estates", "7 Hallgarth Street", "elvet", "DH1 3AY", 54.7700, -1.5700, "available", 172, 5),
  h("elvet-church", "Church Street Flats", "Bill Free Homes", "26 Church Street", "elvet", "DH1 3DQ", 54.7695, -1.5730, "under-offer", 165, 3),
  h("elvet-old", "Old Elvet Townhouse", "Ruth Property Co.", "40 Old Elvet", "elvet", "DH1 3HN", 54.7735, -1.5680, "let", 190, 6),
  h("crossgate-north", "North Road Flat", "Castle Lettings", "19 North Road", "crossgate", "DH1 4DG", 54.7765, -1.5800, "available", 155, 4, "northroad"),
  h("crossgate-allergate", "Allergate House", "Wear Valley Lettings", "11 Allergate", "crossgate", "DH1 4ET", 54.7742, -1.5832, "available", 147, 5),
  h("crossgate-peth", "Crossgate Peth", "Durham Student Rooms", "33 Crossgate Peth", "crossgate", "DH1 4PZ", 54.7728, -1.5850, "let", 140, 4),
  h("crossgate-margery", "Margery Lane", "Northern Key Estates", "6 Margery Lane", "crossgate", "DH1 4QG", 54.7733, -1.5815, "under-offer", 150, 3),
];

export const CITIES: City[] = [
  { id: "durham", name: "Durham", center: { lat: 54.7765, lng: -1.5745 }, areas: DURHAM_AREAS, houses: DURHAM_HOUSES },
];

export const LANDMARKS = [
  { name: "Durham Cathedral", lat: 54.7733, lng: -1.5763, kind: "cathedral" as const },
  { name: "Durham Castle", lat: 54.7752, lng: -1.5763, kind: "castle" as const },
  { name: "Durham Viaduct", lat: 54.7786, lng: -1.5823, kind: "viaduct" as const },
];
// River Wear around the Peninsula (approximate, south → north-east)
export const WEAR: [number, number][] = [
  [54.7660, -1.5780], [54.7690, -1.5795], [54.7720, -1.5790], [54.7750, -1.5785], [54.7775, -1.5772],
  [54.7778, -1.5745], [54.7760, -1.5722], [54.7730, -1.5712], [54.7712, -1.5725], [54.7700, -1.5745],
  [54.7705, -1.5765], [54.7740, -1.5770], [54.7770, -1.5765],
].slice(0, 10) as [number, number][];

export const findCity = (q: string) => CITIES.find((c) => c.id === q.trim().toLowerCase() || c.name.toLowerCase() === q.trim().toLowerCase());
export const suggestCities = (q: string) => !q.trim() ? CITIES : CITIES.filter((c) => c.name.toLowerCase().startsWith(q.trim().toLowerCase()));

/** Equirectangular projection: lat/lng → scene [x, z] in units, `perKm` units per km, around origin. */
export function project(lat: number, lng: number, origin: { lat: number; lng: number }, perKm: number): [number, number] {
  const kx = 111.32 * Math.cos((origin.lat * Math.PI) / 180);
  return [(lng - origin.lng) * kx * perKm, -(lat - origin.lat) * 110.57 * perKm];
}

export function areaStats(city: City, areaId: string) {
  const hs = city.houses.filter((x) => x.area === areaId);
  return { count: hs.filter((x) => x.availability === "available").length, total: hs.length, avgRent: hs.length ? Math.round(hs.reduce((s, x) => s + x.rent, 0) / hs.length) : 0 };
}

/** Circle that covers an area's listed houses (areas without listings get a nominal circle on their centre). */
export function areaCircle(city: City, a: Area): { lat: number; lng: number; r: number } {
  const hs = city.houses.filter((x) => x.area === a.id);
  if (!hs.length) return { lat: a.lat, lng: a.lng, r: 220 };
  const lats = hs.map((x) => x.lat), lngs = hs.map((x) => x.lng);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2, lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const r = Math.max(...hs.map((x) => { const [dx, dz] = project(x.lat, x.lng, { lat, lng }, 1000); return Math.hypot(dx, dz); }));
  return { lat, lng, r: Math.round(r + 45) };
}

// ── Risk layers ──────────────────────────────────────────────────────────────
export type RiskLayer = "all" | "epc" | "hmo" | "crime";
export type Risk = "low" | "med" | "high";
export const RISK_LAYERS: { id: RiskLayer; label: string; legend: Partial<Record<Risk, string>> }[] = [
  { id: "all", label: "All Risks", legend: { low: "Lower risk", med: "Some risk", high: "Higher risk" } },
  { id: "epc", label: "EPC & Heating Cost", legend: { low: "EPC A–C", med: "EPC D", high: "EPC E–G" } },
  { id: "hmo", label: "HMO Licensing", legend: { low: "Under 5 beds", med: "5+ beds: licence needed" } },
  { id: "crime", label: "Crime & Noise", legend: { low: "Quiet", med: "Moderate", high: "Loud at night" } },
];

/** Mandatory HMO licensing in England applies to 5+ occupants in 2+ households. */
export const needsHmoLicence = (hs: House) => hs.bedrooms >= 5;

export function riskOf(hs: House, layer: RiskLayer): Risk {
  const x = hs.xray;
  if (layer === "epc") return x.epcScore >= 69 ? "low" : x.epcScore >= 55 ? "med" : "high";
  if (layer === "hmo") return needsHmoLicence(hs) ? "med" : "low";
  if (layer === "crime") return x.noise >= 70 ? "high" : x.noise >= 40 ? "med" : "low";
  const avg = (100 - x.epcScore + x.damp + x.noise) / 3;
  return avg >= 60 ? "high" : avg >= 40 ? "med" : "low";
}

export function riskLabel(hs: House, layer: RiskLayer): string {
  const x = hs.xray;
  if (layer === "epc") return `EPC ${x.epc} · £${x.bill}/mo heating`;
  if (layer === "hmo") return needsHmoLicence(hs) ? "HMO licence needed" : "No mandatory HMO licence";
  if (layer === "crime") return `Noise ${x.noise}/100`;
  return { low: "Lower risk", med: "Some risk", high: "Higher risk" }[riskOf(hs, "all")];
}

/** Per person, in winter: rent (pppw × 52 ÷ 12) plus an equal share of the predicted heating bill. */
export function trueMonthlyCost(hs: House) {
  const rent = Math.round((hs.rent * 52) / 12), energy = Math.round(hs.xray.bill / hs.bedrooms);
  return { rent, energy, total: rent + energy };
}

// ── Filters ──────────────────────────────────────────────────────────────────
export interface Filters { maxRent: number; minBeds: number; maxBeds: number; epc: "any" | "C" | "D"; availability: "all" | Availability }
export const rentRange = (city: City) => ({ min: Math.min(...city.houses.map((x) => x.rent)), max: Math.max(...city.houses.map((x) => x.rent)) });
/** Smallest and largest bedroom count among the loaded listings. */
export const bedRange = (city: City) => ({ min: Math.min(...city.houses.map((x) => x.bedrooms)), max: Math.max(...city.houses.map((x) => x.bedrooms)) });
export const defaultFilters = (city: City): Filters => ({ maxRent: rentRange(city).max, minBeds: bedRange(city).min, maxBeds: bedRange(city).max, epc: "any", availability: "all" });
/** "Any" for the full range, otherwise "4–6" or "5". */
export function bedsLabel(f: Pick<Filters, "minBeds" | "maxBeds">, range: { min: number; max: number }) {
  if (f.minBeds <= range.min && f.maxBeds >= range.max) return "Any";
  return f.minBeds === f.maxBeds ? `${f.minBeds}` : `${f.minBeds}–${f.maxBeds}`;
}
export function applyFilters(hs: House[], f: Filters) {
  return hs.filter((x) => x.rent <= f.maxRent && x.bedrooms >= f.minBeds && x.bedrooms <= f.maxBeds && (f.epc === "any" || x.xray.epc <= f.epc)
    && (f.availability === "all" || x.availability === f.availability));
}

export const AVAIL_LABEL: Record<Availability, string> = { available: "Available", "under-offer": "Reserved", let: "Taken" };

// ── Advert links and photos ──────────────────────────────────────────────────
const http = (u: string | undefined) => { try { return u && /^https?:$/.test(new URL(u).protocol) ? u : null; } catch { return null; } };
/** The listing's real advert URL, or null — callers hide their link when it is null. */
export const advertUrl = (hs: House) => http(hs.sourceUrl);
/** Photo URLs to show for a listing under the configured IMAGE_SOURCE (main photo first, at most 5). */
export const photosOf = (hs: House): string[] => (IMAGE_SOURCE === "agent" ? (hs.photos ?? []).map(http).filter((u): u is string => !!u).slice(0, 5) : []);
