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

export function epcFromScore(s: number): Epc {
  if (s >= 92) return "A"; if (s >= 81) return "B"; if (s >= 69) return "C";
  if (s >= 55) return "D"; if (s >= 39) return "E"; if (s >= 21) return "F"; return "G";
}
