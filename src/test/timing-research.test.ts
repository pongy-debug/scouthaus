import { afterEach, expect, it, vi } from "vitest";
import { CITIES } from "@/lib/hh/find";
import { assessPublishedListing, calculateMarket, setSigningWindow } from "@/lib/hh/timingResearch.server";
import type { EvaluatedHouse } from "@/lib/hh/timing";
const listing = CITIES[0]!.houses[0]!;
function fixture(): EvaluatedHouse {
  return {
    property_id: listing.id, address: listing.address, postcode: listing.postcode, bedrooms: listing.bedrooms, tenancy_start_date: "2027-08-31",
    official_property_data: { epc_rating: "A", floor_area_sqm: 100, hmo_licensed: true, max_permitted_occupants: 5, sources: ["https://invented.test"] },
    statutory_constraints: { ground_4a_eligible_hmo: true, earliest_ground_4a_signing_date: "wrong", outside_6_month_window: false, max_upfront_rent_months: 1, holding_deposit_deadline_days: 15 },
    live_listing_status: { is_available_for_target_cycle: true, lowest_listed_pppw_gbp: 1, highest_listed_pppw_gbp: 999, bills_included: true, portals: [{ agent_or_portal: "Agent", listing_url_or_id: "https://invented.test", pppw_gbp: 150, status: "AVAILABLE", first_listed_at: null }] },
    micro_market_velocity: { postcode_sector: "DH1 1", total_cohort_stock_n: 50, active_cohort_listings: 20, cohort_absorption_rate_pct: 99, historical_yoy_rent_change_pct: 12, vs_local_benchmark: "BELOW_MEDIAN" },
    timing_recommendation: { shortlist_rank: 1, verdict: "SIGN_NOW", optimal_signing_window: "Now", rationale: "Test only" },
  };
}
const response = (text: string, metadata?: object) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(metadata ? { groundingMetadata: metadata } : {}) }] }), { status: 200 });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("returns a setup message without calling Google when the key is absent", async () => {
  vi.stubEnv("GEMINI_API_KEY", ""); const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await assessPublishedListing(listing)).toMatchObject({ ok: false, message: expect.stringContaining("Secrets") });
  expect(fetch).not.toHaveBeenCalled();
});
it("refuses an ungrounded answer instead of inventing citations", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-key");
  const fetch = vi.fn().mockResolvedValue(response("Unsupported answer")); vi.stubGlobal("fetch", fetch);
  expect(await assessPublishedListing(listing)).toMatchObject({ ok: false, message: expect.stringContaining("no web citations") });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("clears uncited facts, replaces invented URLs, computes prices, and caches the assessment", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-key");
  const fetch = vi.fn().mockResolvedValueOnce(response("Test research", { groundingChunks: [{ web: { uri: "https://example.com/actual", title: "Agent advert" } }] }))
    .mockResolvedValueOnce(response(JSON.stringify({ evaluated_houses: [fixture()], evidence: { portal_0: [0] } })));
  vi.stubGlobal("fetch", fetch);
  const result = await assessPublishedListing(listing);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  expect(result.house.official_property_data.epc_rating).toBeNull();
  expect(result.house.official_property_data.hmo_licensed).toBeNull();
  expect(result.house.micro_market_velocity.cohort_absorption_rate_pct).toBeNull();
  expect(result.house.micro_market_velocity.vs_local_benchmark).toBe("UNKNOWN");
  expect(result.house.timing_recommendation.verdict).toBe("HOLD_AND_MONITOR");
  expect(result.house.live_listing_status.lowest_listed_pppw_gbp).toBe(150);
  expect(result.house.live_listing_status.portals[0]!.listing_url_or_id).toBe("https://example.com/actual");
  expect(result.house.statutory_constraints.outside_6_month_window).toBe(false);
  expect(JSON.parse(fetch.mock.calls[0]![1].body).tools).toEqual([{ google_search: {} }]);
  expect(JSON.parse(fetch.mock.calls[1]![1].body).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  await assessPublishedListing(listing);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("calculates absorption and calendar-month signing dates without trusting model arithmetic", () => {
  const row = fixture(); calculateMarket(row); setSigningWindow(row, "2026-11-15");
  expect(row.micro_market_velocity.cohort_absorption_rate_pct).toBe(60);
  expect(row.statutory_constraints.earliest_ground_4a_signing_date).toBe("2027-02-28");
  expect(row.statutory_constraints.outside_6_month_window).toBe(true);
  row.micro_market_velocity.active_cohort_listings = 51; calculateMarket(row);
  expect(row.micro_market_velocity.cohort_absorption_rate_pct).toBeNull();
});
