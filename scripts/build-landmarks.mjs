// Builds src/lib/hh/landmarks.ts. Run once whenever a landmark is added or changed:  node scripts/build-landmarks.mjs
//
// For each landmark in SEEDS it
//   1. checks the postcode with Postcodes.io,
//   2. reads the building footprint(s) and their 3D parts from OpenStreetMap (Overpass API),
//   3. takes the lead image of the Wikipedia article (REST summary endpoint) and looks up its author and licence on
//      Wikimedia Commons; a photo is saved only when the licence is free (CC BY, CC BY-SA, CC0 or public domain).
// Nothing here runs in the app: the page only reads the saved file, so Wikipedia and OSM are never called per view.
import { writeFile } from "node:fs/promises";

const UA = "landmark-data-build/1.0";
const SEEDS = [
  { id: "durham-cathedral", name: "Durham Cathedral", type: "Cathedral", city: "durham", postcode: "DH1 3EH",
    osm: ["relation/3584722"], parts: true, defaultHeight: 20, wiki: "Durham_Cathedral" },
  { id: "bill-bryson-library", name: "Bill Bryson Library", type: "University library", city: "durham", postcode: "DH1 3LY",
    osm: ["way/142676681"], defaultHeight: 16, wiki: "Durham_University_Library", commonsFallback: "Bill_Bryson_Library.jpg" },
  // The train shed, the Neville Street frontage and portico, and the platform canopies joined to them.
  { id: "newcastle-central-station", name: "Newcastle Central Station", type: "Railway station", city: "newcastle", postcode: "NE1 5DL",
    osm: ["way/28872801", "way/163744861", "way/163744852", "way/163744857", "way/163744858", "way/163744864", "way/163748381", "way/163744859", "way/163744993"],
    defaultHeight: 17, roofHeight: 9, wiki: "Newcastle_railway_station" },
];

const get = async (url, init) => {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { "user-agent": UA, ...(init?.headers ?? {}) } });
    if (res.ok) return res.json();
    if (attempt >= 3 || ![429, 502, 503, 504].includes(res.status)) throw new Error(`${res.status} for ${url.slice(0, 90)}`);
    await new Promise((ok) => setTimeout(ok, 4000 * (attempt + 1)));
  }
};
const overpass = (q) => get("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: `[out:json][timeout:90];${q}` }) });
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const ringOf = (geometry) => geometry.map((p) => [r6(p.lon), r6(p.lat)]);
const area = (ring) => { let a = 0; for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; return a / 2; };
const metres2 = (ring) => Math.abs(area(ring)) * 111320 * 111320 * Math.cos((ring[0][1] * Math.PI) / 180);
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const centre = (ring) => [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length];
/** Join a multipolygon's member ways end to end into closed rings. */
function stitch(ways) {
  const rings = [], pool = ways.map((w) => [...w]);
  while (pool.length) {
    let ring = pool.shift();
    for (let moved = true; moved && String(ring[0]) !== String(ring[ring.length - 1]); ) {
      moved = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], end = String(ring[ring.length - 1]);
        if (String(w[0]) === end) ring = ring.concat(w.slice(1)); else if (String(w[w.length - 1]) === end) ring = ring.concat([...w].reverse().slice(1)); else continue;
        pool.splice(i, 1); moved = true; break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}
/** OSM element → polygons as [outer, ...holes]. */
function polygons(el) {
  if (el.type === "way") return [[ringOf(el.geometry)]];
  const of = (role) => stitch(el.members.filter((m) => m.type === "way" && m.role === role && m.geometry).map((m) => ringOf(m.geometry)));
  const inners = of("inner");
  return of("outer").map((outer) => [outer, ...inners.filter((h) => inside(h[0], outer))]);
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; };

async function footprints(seed) {
  const sel = seed.osm.map((ref) => { const [t, id] = ref.split("/"); return `${t}(${id});`; }).join("");
  const main = (await overpass(`(${sel});out geom;`)).elements;
  const missing = seed.osm.filter((ref) => !main.some((e) => `${e.type}/${e.id}` === ref));
  if (missing.length) throw new Error(`${seed.name}: not in OpenStreetMap: ${missing.join(", ")}`);
  const out = [], ids = [...seed.osm], outers = [];
  for (const el of main) {
    const t = el.tags ?? {}, roof = t.building === "roof";
    const h = num(t.height) ?? (num(t["building:levels"]) ? num(t["building:levels"]) * 3.4 : undefined) ?? (roof ? seed.roofHeight ?? 8 : seed.defaultHeight);
    for (const rings of polygons(el)) {
      outers.push(rings[0]);
      // An outline that has 3D parts is only a low plinth: the parts carry the real shape.
      out.push({ h: seed.parts ? 5 : h, ...(roof ? { base: Math.max(0, h - 1.5) } : {}), rings });
    }
  }
  if (seed.parts) {
    const lons = outers.flat().map((p) => p[0]), lats = outers.flat().map((p) => p[1]);
    const parts = (await overpass(`way["building:part"](${Math.min(...lats)},${Math.min(...lons)},${Math.max(...lats)},${Math.max(...lons)});out geom;`)).elements;
    for (const el of parts) {
      const ring = ringOf(el.geometry);
      if (ring.length < 4 || !outers.some((o) => inside(centre(ring), o))) continue;
      ids.push(`way/${el.id}`); // every part is hidden from the base map, but only parts big enough to see are drawn
      const h = num(el.tags.height) ?? seed.defaultHeight, base = num(el.tags.min_height) ?? 0;
      if (metres2(ring) >= 6) out.push({ h, ...(base ? { base } : {}), rings: [ring] });
    }
  }
  const big = outers.reduce((a, b) => (metres2(b) > metres2(a) ? b : a));
  const [lng, lat] = centre(big);
  return { footprints: out, osmIds: ids, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}

const FREE = /^(cc[- ]by(-sa)?[- ]\d|cc[- ]?0|cc-zero|pd\b|public domain)/i;
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\((?:category|talk)\)/gi, "").replace(/\s+/g, " ").trim();
async function commons(file) {
  const q = new URLSearchParams({ action: "query", format: "json", titles: `File:${file}`, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "400" });
  const page = Object.values((await get(`https://commons.wikimedia.org/w/api.php?${q}`)).query.pages)[0];
  const info = page?.imageinfo?.[0];
  if (!info) throw new Error(`no Commons file "${file}"`);
  const m = info.extmetadata, licence = m.LicenseShortName?.value ?? "", author = text(m.Artist?.value ?? "");
  if (!FREE.test(licence) && !FREE.test(m.License?.value ?? "")) throw new Error(`licence "${licence}" is not free`);
  if (!author) throw new Error("no author recorded");
  return { url: info.thumburl.split("?")[0], author, licence, page: info.descriptionurl, file };
}
async function photo(seed) {
  try {
    const sum = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${seed.wiki}`);
    const src = sum.originalimage?.source ?? sum.thumbnail?.source;
    if (!src) throw new Error("article has no lead image");
    const path = new URL(src).pathname.split("/");
    const file = decodeURIComponent(path.includes("thumb") ? path[path.indexOf("thumb") + 3] : path[path.length - 1]);
    const useFallback = seed.commonsFallback && process.argv.includes(`--fallback=${seed.id}`);
    return await commons(useFallback ? seed.commonsFallback : file);
  } catch (e) {
    console.warn(`  ! ${seed.name}: NO PHOTO — ${e.message}`);
    return undefined;
  }
}

const landmarks = [];
for (const seed of SEEDS) {
  console.log(seed.name);
  const pc = await get(`https://api.postcodes.io/postcodes/${encodeURIComponent(seed.postcode)}`);
  const fp = await footprints(seed);
  const away = Math.round(Math.hypot((pc.result.latitude - fp.lat) * 111320, (pc.result.longitude - fp.lng) * 111320 * Math.cos((fp.lat * Math.PI) / 180)));
  console.log(`  postcode ${pc.result.postcode} is valid (${pc.result.admin_district}); its centre is ${away} m from the building`);
  if (away > 400) throw new Error(`${seed.name}: postcode ${seed.postcode} is ${away} m from the OSM building — check it`);
  console.log(`  OSM: ${fp.osmIds.length} footprint ids, ${fp.footprints.length} drawn, centre ${fp.lat}, ${fp.lng}`);
  const p = await photo(seed);
  if (p) console.log(`  photo: ${p.file} — ${p.author}, ${p.licence}\n         ${p.url}`);
  const { file: _file, ...saved } = p ?? {};
  landmarks.push({ id: seed.id, name: seed.name, type: seed.type, city: seed.city, postcode: pc.result.postcode, lat: fp.lat, lng: fp.lng, osmIds: fp.osmIds, ...(p ? { photo: saved } : {}), footprints: fp.footprints });
}

const row = (l) => `  ${JSON.stringify({ ...l, footprints: "@@" }).replace('"@@"', `[\n${l.footprints.map((f) => `    ${JSON.stringify(f)},`).join("\n")}\n  ]`)},`;
await writeFile(new URL("../src/lib/hh/landmarks.ts", import.meta.url), `// Landmarks on the Find House map: their own data set, separate from house listings (never in the list, filters or counts).
// Written by scripts/build-landmarks.mjs from Postcodes.io, OpenStreetMap and Wikimedia Commons — to add a landmark,
// add it to SEEDS in that script and run it again; no component needs to change.
// Footprints © OpenStreetMap contributors (ODbL). Photos are hot-linked from Wikimedia Commons with their credit.

export interface LandmarkPhoto {
  /** About 400 px wide, served by Wikimedia. */
  url: string;
  author: string;
  licence: string;
  /** The file's page on Wikimedia Commons, linked from the credit. */
  page: string;
}
/** One piece of the building: [outer ring, ...holes] as [lng, lat], extruded from \`base\` (default 0) to \`h\` metres. */
export interface Footprint { h: number; base?: number; rings: number[][][] }
export interface Landmark {
  id: string;
  name: string;
  /** One-line label shown on the card, e.g. "Cathedral". */
  type: string;
  /** City id from find.ts. */
  city: string;
  postcode: string;
  lat: number;
  lng: number;
  /** Every OSM footprint that belongs to the building ("way/123", "relation/456"), so it reacts as one. */
  osmIds: string[];
  /** Left out when no freely licensed photo was found. */
  photo?: LandmarkPhoto;
  footprints: Footprint[];
}

export const LANDMARKS: Landmark[] = [
${landmarks.map(row).join("\n")}
];

export const landmarksFor = (cityId: string) => LANDMARKS.filter((l) => l.city === cityId);
`);
console.log(`\nWrote src/lib/hh/landmarks.ts (${landmarks.length} landmarks, ${landmarks.filter((l) => !l.photo).length} without a photo)`);
