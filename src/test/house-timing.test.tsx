import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HouseTimingCard } from "@/components/hh/HouseTimingCard";
import { parseEvaluatedHouses, safeSourceUrl, type EvaluatedHouse } from "@/lib/hh/timing";

// Synthetic test fixture only. Never shipped as a property assessment.
const house: EvaluatedHouse = {
  property_id: "test-house", address: "Test address", postcode: "DH1 1AA", bedrooms: 4, tenancy_start_date: "2027-07-01",
  official_property_data: { epc_rating: "C", floor_area_sqm: 90, hmo_licensed: true, max_permitted_occupants: 4, sources: ["https://example.com/epc", "Local register"] },
  statutory_constraints: { ground_4a_eligible_hmo: true, earliest_ground_4a_signing_date: "2027-01-01", outside_6_month_window: true, max_upfront_rent_months: 1, holding_deposit_deadline_days: 15 },
  live_listing_status: { is_available_for_target_cycle: true, lowest_listed_pppw_gbp: 150, highest_listed_pppw_gbp: 170, bills_included: false, portals: [{ agent_or_portal: "Test agent", listing_url_or_id: "https://example.com/listing", pppw_gbp: 150, status: "AVAILABLE", first_listed_at: null }] },
  micro_market_velocity: { postcode_sector: "DH1 1", total_cohort_stock_n: 48, active_cohort_listings: 18, cohort_absorption_rate_pct: 62, historical_yoy_rent_change_pct: null, vs_local_benchmark: "BELOW_MEDIAN" },
  timing_recommendation: { shortlist_rank: 1, verdict: "HOLD_AND_MONITOR", optimal_signing_window: "Jan 2027", rationale: "Test rationale" },
};
afterEach(cleanup);
it.each([["SIGN_NOW", "Sign Now"], ["HOLD_AND_MONITOR", "Hold & Monitor"], ["NEGOTIATE_OR_SWITCH_AGENT", "Negotiate / Cheaper Portal"]] as const)("renders %s with verified metrics and separate source links", (verdict, label) => {
  render(<HouseTimingCard house={{ ...house, timing_recommendation: { ...house.timing_recommendation, verdict } }} />);
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText("Save £20/wk vs other agents")).toBeInTheDocument();
  expect(screen.getByText("HMO Licensed")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
  const accordion = screen.getByText("Timing & Contract Rules").closest("details")!;
  expect(accordion).not.toHaveAttribute("open");
  accordion.open = true;
  expect(screen.getByText(/This is not a ban on signing early/)).toBeVisible();
  expect(screen.getByRole("link", { name: /Test agent/ })).toHaveAttribute("href", "https://example.com/listing");
  expect(screen.getByRole("link", { name: "Public record 1" })).toHaveAttribute("href", "https://example.com/epc");
});
it("shows explicit unknowns without a fabricated verdict or progress value", () => {
  render(<HouseTimingCard />);
  expect(screen.getByText("Timing not assessed")).toBeInTheDocument();
  expect(screen.getAllByText(/Unverified/).length).toBeGreaterThan(3);
  expect(screen.queryByRole("progressbar")).toBeNull();
});
it("clamps progress and never calls a false licence flag Non-HMO", () => {
  render(<HouseTimingCard house={{ ...house, official_property_data: { ...house.official_property_data, hmo_licensed: false }, micro_market_velocity: { ...house.micro_market_velocity, cohort_absorption_rate_pct: -12 }, statutory_constraints: { ...house.statutory_constraints, outside_6_month_window: false } }} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByText("No licence recorded")).toBeInTheDocument();
  expect(screen.queryByText(/This is not a ban/)).toBeNull();
});
it("validates the envelope, rejects duplicates, and disallows executable source URLs", () => {
  expect(parseEvaluatedHouses({ evaluated_houses: [house, { broken: true }] }).get("test-house")).toEqual(house);
  expect(parseEvaluatedHouses({ evaluated_houses: [house, house] }).size).toBe(0);
  expect(parseEvaluatedHouses(null).size).toBe(0);
  expect(safeSourceUrl("javascript:alert(1)")).toBeNull();
  expect(safeSourceUrl("ID-123")).toBeNull();
});
