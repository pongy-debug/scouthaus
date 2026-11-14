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
}

export const PROPERTIES: Property[] = [
  { id: "gilesgate", postcode: "DH1 1HP", address: "14 Gilesgate", area: "Gilesgate", tag: "High Risk", epc: "E", epcScore: 42, bill: 248,
    billFactors: ["Uninsulated solid brick walls", "Single glazed sash windows", "Old non-condensing boiler"],
    damp: 84, dampNote: "North-facing Victorian terrace on a steep slope with solid 9\" brick walls. Cold internal surfaces sit below dew point most winter nights, so condensation and black mould are very likely in bedrooms and behind furniture.",
    noise: 58, rent: 168, median: 139 },
  { id: "viaduct", postcode: "DH1 4EN", address: "42 The Viaduct", area: "The Viaduct", tag: "Moderate Risk", epc: "D", epcScore: 61, bill: 176,
    billFactors: ["Partial cavity wall insulation", "Mixed double glazing", "Combi boiler (2009)"],
    damp: 52, dampNote: "Terraced street in a sheltered cutting near the railway. Moderate risk: ventilate the kitchen and bathroom and check window reveals for early mould.",
    noise: 44, rent: 142, median: 135 },
  { id: "claypath", postcode: "DH1 3LE", address: "8 Claypath", area: "Claypath", tag: "Low Risk", epc: "B", epcScore: 84, bill: 92,
    billFactors: ["Insulated modern conversion", "A-rated double glazing", "Condensing boiler + smart thermostat"],
    damp: 18, dampNote: "Modern conversion with mechanical extract ventilation and insulated walls. Low condensation risk with normal use.",
    noise: 66, rent: 152, median: 148 },
  { id: "northroad", postcode: "DH1 4DG", address: "19 North Road", area: "North Road", tag: "High Noise & Damp Risk", epc: "E", epcScore: 39, bill: 231,
    billFactors: ["Solid stone walls", "Single glazed rear windows", "Electric storage heaters"],
    damp: 78, dampNote: "Flat above shops in the river valley, where moisture and cold air collect. Rear rooms get little sun and are prone to rising damp and condensation.",
    noise: 91, rent: 155, median: 137 },
  { id: "bailey", postcode: "DH1 3HP", address: "5 Saddler Street / Bailey", area: "The Bailey", tag: "Historic Listed", epc: "F", epcScore: 28, bill: 289,
    billFactors: ["Grade II listed, no wall insulation allowed", "Original single glazed sash", "Gas boiler (1998)"],
    damp: 72, dampNote: "Grade II listed stone building on the Peninsula. Thick walls breathe slowly and listed status limits upgrades, so damp patches and high heat loss are common.",
    noise: 62, rent: 185, median: 160 },
];

export function epcFromScore(s: number): Epc {
  if (s >= 92) return "A"; if (s >= 81) return "B"; if (s >= 69) return "C";
  if (s >= 55) return "D"; if (s >= 39) return "E"; if (s >= 21) return "F"; return "G";
}
