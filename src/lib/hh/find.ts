import { epcFromScore, type Epc, type Property } from "./data";
import { IMAGE_SOURCE } from "./config";

export type Availability = "available" | "under-offer" | "let";

export interface Area {
  id: string; name: string; postcode: string; lat: number; lng: number; active: boolean; note?: string;
}
export interface House {
  id: string; name: string; landlord: string; address: string; area: string; postcode: string;
  lat: number; lng: number; availability: Availability; rent: number; bedrooms: number;
  /** Availability in the advert's own words, e.g. "Available 01/07/2027". */
  availabilityNote?: string;
  /** True when the advert gives no house number: the pin is on the right street but not on the exact building. */
  approximate?: boolean;
  /** Shown instead of "N bed" when the advert is inconsistent about the bedroom count. */
  bedroomsNote?: string;
  /** Photo credit text; defaults to the agent name. */
  photoCredit?: string;
  /** EPC, heating, damp, noise and rent-benchmark telemetry shown in the X-Ray drawer. */
  xray: Property;
  /** The listing's real advert page, saved at import. Leave unset when there is none — never a made-up or generic URL. */
  sourceUrl?: string;
  /** Photo URLs from that advert: main photo first, then up to 4 more. URLs only; images are never downloaded or re-hosted. */
  photos?: string[];
  cityId?: string;
  availableFrom?: string;
  approximateLocation?: boolean;
  /** Real adverts must never inherit the seeded Durham demo measurements. */
  telemetryStatus?: "unchecked";
}
export interface Destination { name: string; lat: number; lng: number }
export interface City { id: string; name: string; aliases?: string[]; center: { lat: number; lng: number }; overviewZoom?: number; areas: Area[]; houses: House[]; walkDestinations?: Destination[] }

const DURHAM_AREAS: Area[] = [
  { id: "claypath", name: "Claypath", postcode: "DH1", lat: 54.7792, lng: -1.5712, active: true },
  { id: "viaduct", name: "Viaduct", postcode: "DH1", lat: 54.7778, lng: -1.5832, active: true },
  { id: "gilesgate", name: "Gilesgate", postcode: "DH1", lat: 54.7806, lng: -1.5598, active: true },
  { id: "gilesgate-moor", name: "Gilesgate Moor", postcode: "DH1", lat: 54.7805, lng: -1.5490, active: true },
  { id: "elvet", name: "Elvet", postcode: "DH1", lat: 54.7712, lng: -1.5690, active: true },
  { id: "crossgate", name: "Crossgate", postcode: "DH1", lat: 54.7738, lng: -1.5818, active: true },
  { id: "nevilles-cross", name: "Neville's Cross", postcode: "DH1", lat: 54.7730, lng: -1.5955, active: true },
  { id: "langley-moor", name: "Langley Moor", postcode: "DH7", lat: 54.7560, lng: -1.6130, active: true, note: "≈3 km south-west" },
  { id: "framwellgate-moor", name: "Framwellgate Moor", postcode: "DH1", lat: 54.7955, lng: -1.5850, active: false },
  { id: "belmont", name: "Belmont", postcode: "DH1", lat: 54.7858, lng: -1.5390, active: false },
  { id: "chester-le-street", name: "Chester-le-Street", postcode: "DH2/DH3", lat: 54.8580, lng: -1.5740, active: false, note: "≈9 km north" },
];

const EPC_MID: Record<Epc, number> = { A: 95, B: 85, C: 74, D: 61, E: 46, F: 30, G: 15 };
/**
 * X-Ray figures are NOT from the advert: heating bill, damp, noise and the rent benchmark are modelled from a seed of
 * the listing id. Only the EPC band is real, and only where the advert states one (`epc`).
 */
function telemetry(hs: { id: string; postcode: string; address: string; rent: number }, areaName: string, epc?: Epc): Property {
  const seed = [...hs.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  const epcScore = epc ? EPC_MID[epc] : 30 + (seed % 50);
  const damp = 20 + ((seed * 7) % 65);
  return {
    id: hs.id, postcode: hs.postcode, address: hs.address, area: areaName, tag: epc ? "EPC from advert · other figures modelled" : "Modelled estimate", epc: epc ?? epcFromScore(epcScore), epcScore,
    bill: Math.round(300 - epcScore * 2.4), billFactors: epcScore > 60 ? ["Cavity wall insulation", "Double glazing"] : ["Solid brick walls", "Older boiler"],
    damp, dampNote: damp >= 60 ? "Older terrace with cold wall surfaces — ventilate daily and check bedrooms for mould." : "Moderate-to-low condensation risk with normal ventilation.",
    noise: 30 + ((seed * 3) % 60), rent: hs.rent, median: Math.round(hs.rent * (0.88 + (seed % 20) / 100)),
  };
}

const listing = (l: Omit<House, "xray">, epc?: Epc): House =>
  ({ ...l, xray: telemetry(l, DURHAM_AREAS.find((a) => a.id === l.area)!.name, epc) });

/** Urbis Property advert: https://www.urbis-property.com/property/<slug>/ — `photo` is the path under their wp-content/uploads. */
const urbis = (slug: string, address: string, area: string, postcode: string, lat: number, lng: number, availability: Availability, availabilityNote: string, rent: number, bedrooms: number, photo: string): House =>
  listing({ id: `urbis-${address.toLowerCase().replace(/ /g, "-")}`, name: address, landlord: "Urbis Property", address, area, postcode, lat, lng, availability, availabilityNote, rent, bedrooms,
    sourceUrl: `https://www.urbis-property.com/property/${slug}/`, photos: [`https://www.urbis-property.com/wp-content/uploads/${photo}`] });

/** Loc8me advert: https://loc8me.co.uk/lettings/<slug>/ — every imported advert was marked available; `epc` only where the advert states it. */
const loc8me = (slug: string, name: string, address: string, area: string, postcode: string, lat: number, lng: number, availabilityNote: string, rent: number, bedrooms: number, photo: string, epc?: Epc): House =>
  listing({ id: `loc8me-${slug}`, name, landlord: "Loc8me", address, area, postcode, lat, lng, availability: "available", availabilityNote, rent, bedrooms,
    sourceUrl: `https://loc8me.co.uk/lettings/${slug}/`, photos: [`https://loc8me.co.uk/wp-content/uploads/${photo}`] }, epc);

/**
 * StuRents advert, entered by hand from details the owner supplied (nothing is fetched from StuRents): `path` is the part
 * after https://sturents.com/student-accommodation/durham/house/, `photos` are file names under public.sturents.com/photos.
 * No house number is published, so the pin sits on the street at the postcode (postcode centroid + OpenStreetMap street
 * geometry) and is flagged approximate.
 */
const sturents = (path: string, street: string, postcode: string, landlord: string, lat: number, lng: number, availabilityNote: string, rent: number, bedrooms: number, photos: string[], bedroomsNote?: string): House =>
  listing({ id: `sturents-${path.split("/")[1]!.split("?")[0]}`, name: street, landlord, address: street, area: "elvet", postcode, lat, lng, availability: "available", availabilityNote, rent, bedrooms, ...(bedroomsNote ? { bedroomsNote } : {}),
    approximate: true, sourceUrl: `https://sturents.com/student-accommodation/durham/house/${path}`,
    photos: photos.map((f) => `https://public.sturents.com/photos/${f}`), photoCredit: `${landlord} via StuRents` });

// Real listings imported on 2026-11-14 from each advert page linked from https://www.urbis-property.com/ and
// https://loc8me.co.uk/student-accommodation/durham/. Address, rent (pppw), bedrooms, availability, map position and
// main photo are as advertised that day; Loc8me adverts mostly give the street without a house number. Listings that
// share one advertised map point are spaced ~8 m apart so each pin can be clicked.
const DURHAM_HOUSES: House[] = [
  loc8me("renny-street", "Renny Street", "Renny Street", "claypath", "DH1 1JN", 54.77946, -1.56579, "Available 01/07/2027", 195, 5, "2025/10/9075366.jpg"),
  loc8me("mayorswell-close", "Mayorswell Close", "Mayorswell Close", "claypath", "DH1 1JU", 54.78021, -1.56736, "Available 01/07/2027", 198, 6, "2025/10/8593585.jpg", "D"),
  loc8me("ravensworth-terrace-l", "Ravensworth Terrace (L)", "7b Ravensworth Terrace", "claypath", "DH1 1QP", 54.77783, -1.5692, "Available 01/07/2027", 203, 4, "2025/11/7926536.jpg"),
  loc8me("wanless-terrace-l", "Wanless Terrace (L)", "Wanless Terrace", "claypath", "DH1 1RU", 54.7798, -1.57195, "Available 01/07/2027", 203, 4, "2025/10/7912994.jpg"),
  loc8me("ferens-close-2", "Ferens Close", "Ferens Close", "claypath", "DH1 1JX", 54.78105, -1.5679, "Available 01/07/2027", 183, 6, "2025/09/7926595.jpg"),
  urbis("1-finney-terrace-durham", "1 Finney Terrace", "claypath", "DH1 1RT", 54.77912, -1.57185, "under-offer", "Under Reservation for 2027-28", 184, 3, "2015/06/1-fin-244x163.jpg"),
  urbis("40-claypath-durham", "40 Claypath", "claypath", "DH1 1QE", 54.77836, -1.57266, "available", "Available July 2027", 184, 8, "2015/06/house5pic1-244x163.jpg"),
  urbis("39-claypath-durham", "39 Claypath", "claypath", "DH1 1QE", 54.77836, -1.57254, "under-offer", "Under Reservation for 2027-28", 210, 6, "2015/06/house6pic3-244x163.jpg"),
  loc8me("highgate", "Highgate", "Highgate", "viaduct", "DH1 4GA", 54.7785, -1.58034, "Available 21/07/2027", 185, 5, "2025/10/8545157.jpg"),
  urbis("49-albert-street-durham", "49 Albert Street", "viaduct", "DH1 4RJ", 54.78081, -1.5868, "under-offer", "Under Reservation for 2027-28", 210, 7, "2015/06/albert49-488x326.jpg"),
  urbis("9-albert-street-durham", "9 Albert Street", "viaduct", "DH1", 54.78043, -1.58667, "under-offer", "Under Reservation for 2027-28", 210, 6, "2015/06/9-Albert-Street-Web-2-Copy-488x326.jpg"),
  loc8me("wynyard-grove", "Wynyard Grove", "Wynyard Grove", "gilesgate", "DH1 2QJ", 54.77957, -1.55482, "Available 01/07/2027", 190, 9, "2025/09/8583258.jpg", "D"),
  loc8me("gilesgate-5", "Gilesgate", "Gilesgate", "gilesgate", "DH1 1HY", 54.77852, -1.56137, "Available 01/07/2027", 195, 4, "2025/10/7912532.jpg"),
  loc8me("county-durham", "County Durham", "Gilesgate Bank", "gilesgate", "DH1 1HY", 54.77865, -1.56069, "Available 01/07/2027", 195, 6, "2025/10/7932062.jpg", "C"),
  loc8me("douglas-villas", "Douglas Villas", "48 Douglas Villas", "gilesgate", "DH1 1JL", 54.78018, -1.56482, "Available 25/09/2027", 205, 4, "2026/10/9992809.png"),
  loc8me("wakenshaw-road", "Wakenshaw Road", "103 Wakenshaw Road", "gilesgate", "DH1 1EP", 54.78294, -1.55732, "Available 01/07/2027", 147, 4, "2025/10/8229061.jpg"),
  loc8me("orchard-drive-4", "Orchard Drive", "Orchard Drive", "gilesgate", "DH1 1LA", 54.78074, -1.5634, "Available 01/07/2027", 155, 6, "2026/11/7945364.jpg"),
  loc8me("donnini-place", "Donnini Place", "36 Donnini Place", "gilesgate", "DH1 1ES", 54.78082, -1.55483, "Available 01/07/2027", 162, 4, "2026/10/7926607.jpg"),
  loc8me("sherburn-road", "Sherburn Road", "Sherburn Road", "gilesgate", "DH1 2JR", 54.77866, -1.55473, "Available 27/06/2027", 168, 3, "2025/09/7912324.jpg"),
  loc8me("bradford-crescent", "Bradford Crescent", "Bradford Crescent", "gilesgate", "DH1 1ER", 54.78324, -1.55587, "Available 08/07/2027", 171, 3, "2025/09/7933551.jpg"),
  loc8me("west-view", "West View", "West View", "gilesgate", "DH1 1HZ", 54.77934, -1.56005, "Available 01/07/2027", 173, 4, "2026/10/8399868.jpg"),
  loc8me("orchard-drive-2", "Orchard Drive", "Orchard Drive", "gilesgate", "DH1 1LA", 54.78083, -1.56319, "Available 01/07/2027", 180, 6, "2025/09/7926795.jpg"),
  loc8me("west-view-l-2", "West View (L)", "West View", "gilesgate", "DH1 1HZ", 54.77928, -1.56006, "Available 30/06/2027", 185, 5, "2025/10/7912604.jpg"),
  loc8me("gort-place", "Gort Place", "Gort Place", "gilesgate-moor", "DH1 1EY", 54.78218, -1.55377, "Available 01/07/2027", 133, 2, "2025/09/9031906.jpg"),
  loc8me("habgood-drive-2", "Habgood Drive", "Habgood Drive", "gilesgate-moor", "DH1 2TN", 54.77482, -1.54447, "Available 01/07/2027", 156, 4, "2025/10/8327900.jpg"),
  loc8me("habgood-drive", "Habgood Drive", "Habgood Drive", "gilesgate-moor", "DH1 2TN", 54.77547, -1.54404, "Available 01/07/2027", 159, 4, "2025/10/8296684.jpg"),
  loc8me("wesley-house", "Wesley House", "Wesley House", "gilesgate-moor", "DH1 2JD", 54.77932, -1.54342, "Available 01/07/2027", 162, 6, "2026/10/9975991.png"),
  loc8me("musgrave-gardens", "Musgrave Gardens", "Musgrave Gardens", "gilesgate-moor", "DH1 1PL", 54.78074, -1.5486, "Available 01/07/2027", 164, 4, "2026/10/7912955.jpg"),
  loc8me("kepier-crescent-2", "Kepier Crescent", "Kepier Crescent", "gilesgate-moor", "DH1 1PQ", 54.78199, -1.54647, "Available 09/07/2027", 165, 4, "2026/10/7926800.jpg"),
  loc8me("edward-street", "Edward Street", "Edward Street", "gilesgate-moor", "DH1 1PU", 54.78045, -1.55299, "Available 01/07/2027", 165, 4, "2025/09/8307026.jpg"),
  loc8me("musgrave-gardens-2", "Musgrave Gardens", "Musgrave Gardens", "gilesgate-moor", "DH1 1PL", 54.78074, -1.54848, "Available 01/07/2027", 166, 5, "2025/09/7912480.jpg"),
  loc8me("churchill-square", "Churchill Square", "58 Churchill Square", "gilesgate-moor", "DH1 1EU", 54.78146, -1.55397, "Available 13/07/2027", 168, 3, "2026/10/7912782.jpg"),
  loc8me("edward-street-2", "Edward Street", "Edward Street", "gilesgate-moor", "DH1 1PU", 54.78045, -1.55287, "Available 14/07/2027", 176, 4, "2025/10/7912735.jpg"),
  loc8me("hartley-gardens", "Hartley Gardens", "31 Hartley Gardens", "gilesgate-moor", "DH1 1GZ", 54.78427, -1.5495, "Available 01/07/2027", 185, 2, "2026/11/9946456.jpg"),
  sturents("whinney-hill/225881?contract=296190", "Whinney Hill", "DH1 3BD", "Harringtons Students", 54.77065, -1.56696, "Available from 1 Jul 2027", 189, 6, ["6485816.jpg", "9980940.jpg"]),
  sturents("whinney-hill/351795?contract=471735", "Whinney Hill", "DH1 3BD", "Harringtons Students", 54.77035, -1.56713, "Available from 1 Jul 2027", 189, 6, ["10011456.jpg", "10003968.jpg"]),
  sturents("whinney-hill/429669?contract=624953", "Whinney Hill", "DH1 3BD", "Harringtons Students", 54.77005, -1.5673, "Available from 1 Jul 2027", 209, 4, ["10001007.jpg", "10001000.jpg"]),
  sturents("whinney-hill/253452?contract=327370", "Whinney Hill", "DH1 3BQ", "Harringtons Students", 54.77244, -1.5662, "Available from 1 Jul 2027", 219, 4, ["6835918.jpg", "7255957.jpg"]),
  sturents("mount-joy-crescent/112942?contract=57189", "Mount Joy Crescent", "DH1 3BA", "J W Wood", 54.76933, -1.56903, "Available from 2 Jul 2027", 238, 4, ["6230374.png", "8565362.jpg"]),
  sturents("illingworth-grove/384871?contract=536202", "Illingworth Grove", "DH1 3BL", "J W Wood", 54.77157, -1.5653, "Available from 5 Jul 2027", 325, 2, ["8740489.jpg", "8740476.jpg"], "2–3 bed, check advert"),
  urbis("36-the-avenue-durham", "36 The Avenue", "crossgate", "DH1 4EB", 54.77375, -1.58839, "under-offer", "Under Reservation for 2027-28", 210, 7, "2020/09/36-The-Avenue-Ext-Web-1-Copy-488x326.jpg"),
  urbis("38-the-avenue-durham", "38 The Avenue", "crossgate", "DH1 4EB", 54.77375, -1.58827, "under-offer", "Under Reservation for 2027-28", 210, 7, "2015/06/38-The-Avenue-Ext-Web-2-Copy-488x326.jpg"),
  urbis("37-the-avenue-durham", "37 The Avenue", "crossgate", "DH1 4EB", 54.77375, -1.58815, "under-offer", "Under Reservation for 2027-28", 210, 7, "2015/06/house2pic2-244x163.jpg"),
  urbis("15421-southwest-39th-terrace", "39 The Avenue", "crossgate", "DH1 4EB", 54.77361, -1.58841, "under-offer", "Under Reservation for 2027-28", 210, 6, "2014/06/house1pic4-244x163.jpg"),
  loc8me("lowes-barn-bank-2", "Lowes Barn Bank", "Lowes Barn Bank", "nevilles-cross", "DH1 3QJ", 54.76684, -1.59509, "Available 27/06/2027", 190, 5, "2026/10/7924318.jpg"),
  loc8me("st-johns-road", "St Johns Road", "St Johns Road", "nevilles-cross", "DH1 4NU", 54.77264, -1.593, "Available 28/06/2027", 205, 5, "2025/10/9362125.png"),
  loc8me("st-bedes-close-3", "St Bedes Close", "St Bedes Close", "nevilles-cross", "DH1 4AB", 54.77506, -1.59502, "Available 01/07/2027", 205, 6, "2025/09/8637316.jpg"),
  loc8me("st-bedes-close-2", "St Bedes Close", "St Bedes Close", "nevilles-cross", "DH1 4AB", 54.77517, -1.59646, "Available 01/07/2027", 210, 6, "2026/10/9010414.jpg"),
  loc8me("neville-terrace", "Neville Terrace", "Neville Terrace", "nevilles-cross", "DH1 4AH", 54.77838, -1.59724, "Available 04/07/2027", 154, 4, "2025/10/7922116.jpg"),
  loc8me("kells-building", "Kells Building", "Kells Building, Nevilles Cross Bank", "nevilles-cross", "DH1 4JL", 54.76989, -1.59731, "Available 01/07/2027", 164, 4, "2026/11/7912997.jpg"),
  loc8me("homer-terrace", "Homer Terrace", "Homer Terrace", "nevilles-cross", "DH1 4JT", 54.77111, -1.59554, "Available 01/07/2027", 164, 4, "2026/11/7912675.jpg"),
  loc8me("nevilles-cross-bank", "Nevilles Cross Bank", "Nevilles Cross Bank", "nevilles-cross", "DH1 4JF", 54.77169, -1.59554, "Available 01/07/2027", 166, 4, "2026/11/8593474.jpg"),
  loc8me("neville-terrace-l", "Neville Terrace (L)", "9 Neville Terrace", "nevilles-cross", "DH1 4AH", 54.77808, -1.59727, "Available 01/07/2027", 185, 3, "2026/10/8736949.jpg"),
  loc8me("high-street-north", "High Street North", "High Street North", "langley-moor", "DH7 8JH", 54.7562, -1.61283, "Available 01/07/2027", 165, 3, "2025/10/8614964.jpg", "D"),
  loc8me("high-street-north-2", "High Street North", "103 High Street North", "langley-moor", "DH7 8JH", 54.75664, -1.61234, "Available 01/07/2027", 165, 3, "2025/10/8370792.jpg"),
  loc8me("high-street-south", "High Street South", "High Street South", "langley-moor", "DH7 8EX", 54.75717, -1.61109, "Available 05/07/2027", 167, 3, "2025/10/8592583.jpg"),
  loc8me("john-street-south", "John Street South", "John Street South", "langley-moor", "DH7 8RP", 54.75215, -1.61725, "Available 01/07/2027", 175, 3, "2026/10/8490208-31-scaled.jpg"),
];

const NEWCASTLE_AREAS: Area[] = [
  { id: "jesmond", name: "Jesmond", postcode: "NE2", lat: 54.994, lng: -1.609, active: true },
  { id: "heaton", name: "Heaton", postcode: "NE6", lat: 54.983146, lng: -1.574495, active: true },
  { id: "sandyford", name: "Sandyford", postcode: "NE2", lat: 54.982211, lng: -1.600881, active: true },
  { id: "newcastle-city-centre", name: "Newcastle City Centre", postcode: "NE1", lat: 54.9738, lng: -1.6132, active: false },
  { id: "gateshead", name: "Gateshead", postcode: "NE8", lat: 54.962, lng: -1.601, active: false },
];

// Hand-entered from the five adverts supplied by the owner; no listing scraping.
// Coordinates are Postcodes.io postcode centres (looked up 2026-11-14), not verified building footprints.
const NEWCASTLE_HOUSES: House[] = [
  { id: "newcastle-lavender", name: "Lavender Gardens", address: "Lavender Gardens", area: "jesmond", postcode: "NE2 3DE", lat: 54.991984, lng: -1.610662, rent: 166, bedrooms: 5, landlord: "Seekers", availableFrom: "2027-07-09", sourceUrl: "https://sturents.com/student-accommodation/newcastle-upon-tyne/house/lavender-gardens/218809?contract=288227", photos: ["https://public.sturents.com/photos/8326030.jpg", "https://public.sturents.com/photos/8314329.jpg"] },
  { id: "newcastle-bayswater", name: "Bayswater Road", address: "Bayswater Road", area: "jesmond", postcode: "NE2 3HP", lat: 54.994722, lng: -1.60962, rent: 166, bedrooms: 5, landlord: "Seekers", availableFrom: "2027-07-01", sourceUrl: "https://sturents.com/student-accommodation/newcastle-upon-tyne/house/bayswater-road/218842?contract=288647", photos: ["https://public.sturents.com/photos/8371038.jpg", "https://public.sturents.com/photos/6438236.jpg"] },
  { id: "newcastle-tavistock", name: "Tavistock Road", address: "Tavistock Road", area: "jesmond", postcode: "NE2 3HY", lat: 54.995531, lng: -1.607205, rent: 156, bedrooms: 6, landlord: "Seekers", availableFrom: "2027-07-06", sourceUrl: "https://sturents.com/student-accommodation/newcastle-upon-tyne/house/tavistock-road/432143?contract=633320", photos: ["https://public.sturents.com/photos/10062377.jpg", "https://public.sturents.com/photos/10062182.jpg"] },
  { id: "newcastle-hartford", name: "Hartford Court", address: "Hartford Court", area: "heaton", postcode: "NE6 5BG", lat: 54.983146, lng: -1.574495, rent: 121, bedrooms: 5, landlord: "Seekers", availableFrom: "2027-07-06", sourceUrl: "https://sturents.com/student-accommodation/newcastle-upon-tyne/house/hartford-court/435380?contract=640985", photos: ["https://public.sturents.com/photos/10158589.jpg", "https://public.sturents.com/photos/10158607.jpg"] },
  { id: "newcastle-lillico", name: "1 Lillico House", address: "1 Lillico House, Sandyford Road", area: "sandyford", postcode: "NE2 1BN", lat: 54.982211, lng: -1.600881, rent: 161, bedrooms: 5, landlord: "Loc8me (Newcastle)", availableFrom: "2027-07-01", sourceUrl: "https://sturents.com/student-accommodation/newcastle-upon-tyne/house/sandyford-road/426290?contract=615266", photos: ["https://public.sturents.com/photos/9929985.jpg", "https://public.sturents.com/photos/9929953.jpg"] },
].map((listing): House => ({
  ...listing, cityId: "newcastle", availability: "available", approximateLocation: true,
  photoCredit: `${listing.landlord} via StuRents`, telemetryStatus: "unchecked",
  // Unchecked numeric fields are internal placeholders, never displayed, ranked or classified as measurements.
  xray: { id: listing.id, address: listing.address, postcode: listing.postcode, area: NEWCASTLE_AREAS.find((a) => a.id === listing.area)!.name,
    tag: "Agent listing", epc: "G", epcScore: 0, bill: 0, billFactors: [], damp: 0, dampNote: "Not checked yet", noise: 0, rent: listing.rent, median: 0 },
}));

export const CITIES: City[] = [
  { id: "durham", name: "Durham", center: { lat: 54.7765, lng: -1.5745 }, areas: DURHAM_AREAS, houses: DURHAM_HOUSES,
    walkDestinations: [{ name: "Durham University Science Site", lat: 54.7645, lng: -1.578 }, { name: "Bill Bryson Library", lat: 54.7647, lng: -1.5788 }] },
  { id: "newcastle", name: "Newcastle", aliases: ["Newcastle upon Tyne"], center: { lat: 54.9783, lng: -1.6178 }, overviewZoom: 12.4, areas: NEWCASTLE_AREAS, houses: NEWCASTLE_HOUSES,
    walkDestinations: [{ name: "Newcastle University (King's Gate)", lat: 54.9803, lng: -1.6149 }, { name: "Northumbria University (City Campus)", lat: 54.9776, lng: -1.6073 }] },
];

export const hasTelemetry = (house: House) => house.telemetryStatus !== "unchecked";
export const cityForHouse = (house: House) => CITIES.find((city) => city.id === (house.cityId ?? "durham"))!;
export function estimatedWalkMinutes(house: House, destination: Destination) {
  const [x, y] = project(house.lat, house.lng, destination, 1);
  return Math.max(1, Math.round(Math.hypot(x, y) * 1.25 / 4.8 * 60));
}

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

export const findCity = (q: string) => CITIES.find((c) => [c.id, c.name, ...(c.aliases ?? [])].some((name) => name.toLowerCase() === q.trim().toLowerCase()));
export const suggestCities = (q: string) => CITIES.filter((c) => [c.name, ...(c.aliases ?? [])].some((name) => name.toLowerCase().startsWith(q.trim().toLowerCase())));

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
  return { lat, lng, r: Math.max(city.id === "newcastle" ? 220 : 0, Math.round(r + 45)) };
}

// ── Risk layers ──────────────────────────────────────────────────────────────
export type RiskLayer = "all" | "epc" | "hmo" | "crime";
export type Risk = "low" | "med" | "high" | "unknown";
export const RISK_LAYERS: { id: RiskLayer; label: string; legend: Partial<Record<Risk, string>> }[] = [
  { id: "all", label: "All Risks", legend: { low: "Lower risk", med: "Some risk", high: "Higher risk" } },
  { id: "epc", label: "EPC & Heating Cost", legend: { low: "EPC A–C", med: "EPC D", high: "EPC E–G" } },
  { id: "hmo", label: "HMO Licensing", legend: { low: "Under 5 beds", med: "5+ beds: licence needed" } },
  { id: "crime", label: "Crime & Noise", legend: { low: "Quiet", med: "Moderate", high: "Loud at night" } },
];

/** "4 bed", or the listing's own note when the advert is unclear about the count. */
export const bedsOf = (hs: House) => hs.bedroomsNote ?? `${hs.bedrooms} bed`;

/** Mandatory HMO licensing in England applies to 5+ occupants in 2+ households. */
export const needsHmoLicence = (hs: House) => hs.bedrooms >= 5;

export function riskOf(hs: House, layer: RiskLayer): Risk {
  if (!hasTelemetry(hs)) return "unknown";
  const x = hs.xray;
  if (layer === "epc") return x.epcScore >= 69 ? "low" : x.epcScore >= 55 ? "med" : "high";
  if (layer === "hmo") return needsHmoLicence(hs) ? "med" : "low";
  if (layer === "crime") return x.noise >= 70 ? "high" : x.noise >= 40 ? "med" : "low";
  const avg = (100 - x.epcScore + x.damp + x.noise) / 3;
  return avg >= 60 ? "high" : avg >= 40 ? "med" : "low";
}

export function riskLabel(hs: House, layer: RiskLayer): string {
  if (!hasTelemetry(hs)) return layer === "hmo" ? "HMO licence: Not checked yet" : "Not checked yet";
  const x = hs.xray;
  if (layer === "epc") return `EPC ${x.epc} · £${x.bill}/mo heating`;
  if (layer === "hmo") return needsHmoLicence(hs) ? "HMO licence needed" : "No mandatory HMO licence";
  if (layer === "crime") return `Noise ${x.noise}/100`;
  return { low: "Lower risk", med: "Some risk", high: "Higher risk", unknown: "Not checked yet" }[riskOf(hs, "all")];
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
  return hs.filter((x) => x.rent <= f.maxRent && x.bedrooms >= f.minBeds && x.bedrooms <= f.maxBeds && (f.epc === "any" || (hasTelemetry(x) && x.xray.epc <= f.epc))
    && (f.availability === "all" || x.availability === f.availability));
}

export const AVAIL_LABEL: Record<Availability, string> = { available: "Available", "under-offer": "Reserved", let: "Taken" };

// ── Advert links and photos ──────────────────────────────────────────────────
const http = (u: string | undefined) => { try { return u && /^https?:$/.test(new URL(u).protocol) ? u : null; } catch { return null; } };
/** The listing's real advert URL, or null — callers hide their link when it is null. */
export const advertUrl = (hs: House) => http(hs.sourceUrl);
/** Photo URLs to show for a listing under the configured IMAGE_SOURCE (main photo first, at most 5). */
export const photosOf = (hs: House): string[] => (IMAGE_SOURCE === "agent" ? (hs.photos ?? []).map(http).filter((u): u is string => !!u).slice(0, 5) : []);
