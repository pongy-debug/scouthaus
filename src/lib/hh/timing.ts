import { z } from "zod";
import payload from "./evaluated-houses.json";
import type { EvaluatedHouse } from "./timing-types";
export type { EvaluatedHouse, PortalListing } from "./timing-types";

const amount = z.number().finite().nonnegative().nullable();
const count = z.number().int().nonnegative().nullable();
export const evaluatedHouseSchema = z.object({
  property_id: z.string().min(1), address: z.string(), postcode: z.string(), bedrooms: z.number().int().positive(), tenancy_start_date: z.string(),
  official_property_data: z.object({ epc_rating: z.enum(["A", "B", "C", "D", "E", "F", "G"]).nullable(), floor_area_sqm: amount, hmo_licensed: z.boolean().nullable(), max_permitted_occupants: count, sources: z.array(z.string()) }),
  statutory_constraints: z.object({ ground_4a_eligible_hmo: z.boolean(), earliest_ground_4a_signing_date: z.string(), outside_6_month_window: z.boolean(), max_upfront_rent_months: z.number().nonnegative(), holding_deposit_deadline_days: z.number().nonnegative() }),
  live_listing_status: z.object({ is_available_for_target_cycle: z.boolean(), lowest_listed_pppw_gbp: amount, highest_listed_pppw_gbp: amount, bills_included: z.boolean(), portals: z.array(z.object({ agent_or_portal: z.string(), listing_url_or_id: z.string(), pppw_gbp: amount, status: z.enum(["AVAILABLE", "LET_AGREED", "STALE_CONFLICT"]), first_listed_at: z.string().nullable() })) }),
  micro_market_velocity: z.object({ postcode_sector: z.string(), total_cohort_stock_n: count, active_cohort_listings: count, cohort_absorption_rate_pct: z.number().finite().nullable(), historical_yoy_rent_change_pct: z.number().finite().nullable(), vs_local_benchmark: z.enum(["BELOW_MEDIAN", "AT_MEDIAN", "ABOVE_MEDIAN", "UNKNOWN"]) }),
  timing_recommendation: z.object({ shortlist_rank: z.number().int().positive(), verdict: z.enum(["SIGN_NOW", "HOLD_AND_MONITOR", "NEGOTIATE_OR_SWITCH_AGENT"]), optimal_signing_window: z.string(), rationale: z.string() }),
});

/** Match only exact property IDs. Bad or duplicate records never attach to another house. */
export function parseEvaluatedHouses(input: unknown): Map<string, EvaluatedHouse> {
  const envelope = z.object({ evaluated_houses: z.array(z.unknown()) }).safeParse(input);
  const results = new Map<string, EvaluatedHouse>();
  const duplicate = new Set<string>();
  for (const raw of envelope.success ? envelope.data.evaluated_houses : []) {
    const result = evaluatedHouseSchema.safeParse(raw);
    if (!result.success) continue;
    const row = result.data;
    if (results.has(row.property_id)) duplicate.add(row.property_id);
    results.set(row.property_id, row);
  }
  for (const id of duplicate) results.delete(id);
  return results;
}
const evaluations = parseEvaluatedHouses(payload);
export const evaluationFor = (id: string) => evaluations.get(id);
export function safeSourceUrl(value: string): string | null {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
