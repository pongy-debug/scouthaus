export interface PortalListing {
  agent_or_portal: string;
  listing_url_or_id: string;
  pppw_gbp: number | null;
  status: "AVAILABLE" | "LET_AGREED" | "STALE_CONFLICT";
  first_listed_at: string | null;
}

export interface EvaluatedHouse {
  property_id: string;
  address: string;
  postcode: string;
  bedrooms: number;
  tenancy_start_date: string;
  official_property_data: {
    epc_rating: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
    floor_area_sqm: number | null;
    hmo_licensed: boolean | null;
    max_permitted_occupants: number | null;
    sources: string[];
  };
  statutory_constraints: {
    ground_4a_eligible_hmo: boolean;
    earliest_ground_4a_signing_date: string;
    outside_6_month_window: boolean;
    max_upfront_rent_months: number;
    holding_deposit_deadline_days: number;
  };
  live_listing_status: {
    is_available_for_target_cycle: boolean;
    lowest_listed_pppw_gbp: number | null;
    highest_listed_pppw_gbp: number | null;
    bills_included: boolean;
    portals: PortalListing[];
  };
  micro_market_velocity: {
    postcode_sector: string;
    total_cohort_stock_n: number | null;
    active_cohort_listings: number | null;
    cohort_absorption_rate_pct: number | null;
    historical_yoy_rent_change_pct: number | null;
    vs_local_benchmark: "BELOW_MEDIAN" | "AT_MEDIAN" | "ABOVE_MEDIAN" | "UNKNOWN";
  };
  timing_recommendation: {
    shortlist_rank: number;
    verdict: "SIGN_NOW" | "HOLD_AND_MONITOR" | "NEGOTIATE_OR_SWITCH_AGENT";
    optimal_signing_window: string;
    rationale: string;
  };
}

