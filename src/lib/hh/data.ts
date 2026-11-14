export type Layer = "thermal" | "damp" | "bill" | "noise";
export type Epc = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface Property {
  id: string;
  postcode: string;
  address: string;
  area: string;
  tag: string;
  epc: Epc;
  epcScore: number;
  bill: number;
  billFactors: string[];
  damp: number;
  dampNote: string;
  noise: number;
  rent: number;
  median: number;
  pos: [number, number];
  floors: number;
}

export const PROPERTIES: Property[] = [
  { id: "gilesgate", postcode: "DH1 1HP", address: "14 Gilesgate", area: "Gilesgate", tag: "High Risk", epc: "E", epcScore: 42, bill: 248,
    billFactors: ["Uninsulated solid brick walls", "Single glazed sash windows", "Old non-condensing boiler"],
    damp: 84, dampNote: "North-facing Victorian terrace on a steep slope with solid 9\" brick walls. Cold internal surfaces sit below dew point most winter nights, so condensation and black mould are very likely in bedrooms and behind furniture.",
    noise: 58, rent: 168, median: 139, pos: [7, -4.5], floors: 3 },
  { id: "viaduct", postcode: "DH1 4EN", address: "42 The Viaduct", area: "The Viaduct", tag: "Moderate Risk", epc: "D", epcScore: 61, bill: 176,
    billFactors: ["Partial cavity wall insulation", "Mixed double glazing", "Combi boiler (2009)"],
    damp: 52, dampNote: "Terraced street in a sheltered cutting near the railway. Moderate risk: ventilate the kitchen and bathroom and check window reveals for early mould.",
    noise: 44, rent: 142, median: 135, pos: [-7.6, -3], floors: 2 },
  { id: "claypath", postcode: "DH1 3LE", address: "8 Claypath", area: "Claypath", tag: "Low Risk", epc: "B", epcScore: 84, bill: 92,
    billFactors: ["Insulated modern conversion", "A-rated double glazing", "Condensing boiler + smart thermostat"],
    damp: 18, dampNote: "Modern conversion with mechanical extract ventilation and insulated walls. Low condensation risk with normal use.",
    noise: 66, rent: 152, median: 148, pos: [3, -3.2], floors: 4 },
  { id: "northroad", postcode: "DH1 4DG", address: "19 North Road", area: "North Road", tag: "High Noise & Damp Risk", epc: "E", epcScore: 39, bill: 231,
    billFactors: ["Solid stone walls", "Single glazed rear windows", "Electric storage heaters"],
    damp: 78, dampNote: "Flat above shops in the river valley, where moisture and cold air collect. Rear rooms get little sun and are prone to rising damp and condensation.",
    noise: 91, rent: 155, median: 137, pos: [-5.6, -1.4], floors: 3 },
  { id: "bailey", postcode: "DH1 3HP", address: "5 Saddler Street / Bailey", area: "The Bailey", tag: "Historic Listed", epc: "F", epcScore: 28, bill: 289,
    billFactors: ["Grade II listed, no wall insulation allowed", "Original single glazed sash", "Gas boiler (1998)"],
    damp: 72, dampNote: "Grade II listed stone building on the Peninsula. Thick walls breathe slowly and listed status limits upgrades, so damp patches and high heat loss are common.",
    noise: 62, rent: 185, median: 160, pos: [0.2, 0.9], floors: 4 },
];

export const AREAS = [
  { name: "Gilesgate", center: [7, -4.5], epc: 38, damp: 80, noise: 55, bill: 235 },
  { name: "The Viaduct", center: [-7.6, -3], epc: 58, damp: 50, noise: 42, bill: 180 },
  { name: "Claypath", center: [3, -3.2], epc: 72, damp: 30, noise: 70, bill: 130 },
  { name: "North Road", center: [-5.6, -1.4], epc: 42, damp: 74, noise: 88, bill: 220 },
  { name: "The Bailey", center: [0.2, 0.9], epc: 30, damp: 68, noise: 58, bill: 270 },
] as const;

export function epcFromScore(s: number): Epc {
  if (s >= 92) return "A"; if (s >= 81) return "B"; if (s >= 69) return "C";
  if (s >= 55) return "D"; if (s >= 39) return "E"; if (s >= 21) return "F"; return "G";
}

function rng(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

export interface Block { x: number; z: number; w: number; d: number; h: number; epc: number; damp: number; noise: number; bill: number; area: string }

// River Wear loop around the Peninsula (opens north). Returns points [x,z].
export function riverPoints(): [number, number][] {
  return [[-10, -8], [-7, -5.6], [-4.6, -3.4], [-3.5, -0.4], [-2.7, 2.4], [-0.8, 3.9], [1.6, 3.7], [3.4, 1.8], [3.5, -0.6], [4.6, -1.6], [7, -1], [10, 0.5]];
}

function distToRiver(x: number, z: number) {
  const p = riverPoints(); let m = Infinity;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i]!, [bx, bz] = p[i + 1]!;
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    m = Math.min(m, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return m;
}

export function makeBlocks(): Block[] {
  const r = rng(42);
  const out: Block[] = [];
  for (const a of AREAS) {
    for (let i = 0; i < 26; i++) {
      const ang = r() * Math.PI * 2, rad = 0.5 + r() * (a.name === "The Bailey" ? 1.8 : 2.1);
      const x = a.center[0] + Math.cos(ang) * rad, z = a.center[1] + Math.sin(ang) * rad;
      if (distToRiver(x, z) < 0.75) continue;
      const j = () => (r() - 0.5) * 30;
      out.push({ x, z, w: 0.35 + r() * 0.4, d: 0.35 + r() * 0.5, h: 0.3 + r() * 1.1,
        epc: Math.max(5, Math.min(98, a.epc + j())), damp: Math.max(0, Math.min(100, a.damp + j())),
        noise: Math.max(0, Math.min(100, a.noise + j())), bill: Math.round(a.bill + j() * 2), area: a.name });
    }
  }
  return out;
}
