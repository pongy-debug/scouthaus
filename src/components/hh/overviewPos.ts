import { project, type Area, type City } from "@/lib/hh/find";

export const OVERVIEW_PER_KM = 9;
const MAX_R = 13; // far-away inactive areas are pulled in to the edge

export function overviewPos(city: City, a: Area): [number, number] {
  const [x, z] = project(a.lat, a.lng, city.center, OVERVIEW_PER_KM);
  const d = Math.hypot(x, z);
  return d > MAX_R ? [(x / d) * MAX_R, (z / d) * MAX_R] : [x, z];
}
