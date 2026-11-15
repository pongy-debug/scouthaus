import { safeSourceUrl, type EvaluatedHouse } from "@/lib/hh/timing";

const verdicts = {
  SIGN_NOW: { label: "Sign Now", tone: "border-amber-500/40 bg-amber-500/15 text-amber-500", bar: "bg-amber-500" },
  HOLD_AND_MONITOR: { label: "Hold & Monitor", tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-500", bar: "bg-emerald-500" },
  NEGOTIATE_OR_SWITCH_AGENT: { label: "Negotiate / Cheaper Portal", tone: "border-indigo-400/40 bg-indigo-400/15 text-indigo-400", bar: "bg-indigo-400" },
};
const benchmark = { BELOW_MEDIAN: "Below VOA Median", AT_MEDIAN: "At VOA Median", ABOVE_MEDIAN: "Above VOA Median", UNKNOWN: "Unverified" };
const money = (n: number | null | undefined) => n == null ? "Unverified" : `£${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
function Source({ value, children }: { value: string; children: React.ReactNode }) {
  const url = safeSourceUrl(value);
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline underline-offset-2">{children}</a> : <span>{children}</span>;
}
/** An agent evaluation supplements the listing; unknowns remain explicit, never estimated. */
export function HouseTimingCard({ house, aiSourced = false }: { house?: EvaluatedHouse | undefined; aiSourced?: boolean }) {
  const timing = house?.timing_recommendation, listing = house?.live_listing_status, official = house?.official_property_data, market = house?.micro_market_velocity;
  const verdict = timing ? verdicts[timing.verdict] : null;
  const low = listing?.lowest_listed_pppw_gbp, high = listing?.highest_listed_pppw_gbp;
  const saving = low != null && high != null && high > low ? high - low : 0;
  const absorption = market?.cohort_absorption_rate_pct;
  const bounded = absorption == null ? null : Math.max(0, Math.min(100, absorption));
  const legal = house?.statutory_constraints;
  return <div className="overflow-hidden rounded-lg border border-border bg-card/40 text-xs" aria-label="Contract timing and market assessment">
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
      {verdict ? <span className={`rounded-full border px-2 py-1 font-semibold ${verdict.tone}`}>{verdict.label}</span> : <span className="font-medium text-muted-foreground">Timing not assessed</span>}
      {timing && <span className="text-muted-foreground">Best window: <strong className="text-foreground">{timing.optimal_signing_window || "Unverified"}</strong></span>}
    </div>
    <div className="space-y-3 p-3">
      <dl className="grid grid-cols-2 gap-3">
        <div><dt className="text-muted-foreground">{aiSourced ? "Web-listed rent" : "Verified rent"}</dt><dd className="mt-1 font-semibold">{money(low)}{low != null && " pppw"}</dd>
          {saving > 0 && <p className="mt-1 rounded bg-primary/10 px-2 py-1 text-primary">Save {money(saving)}/wk vs other agents</p>}
          {listing && <p className="mt-1 text-muted-foreground">{aiSourced ? "Bills: check cited advert" : listing.bills_included ? "Bills included" : "Bills excluded"}</p>}
        </div>
        <div><dt className="text-muted-foreground">Official property specs</dt><dd className="mt-1 space-y-1"><span className="inline-block rounded border border-border px-1.5 py-0.5">EPC {official?.epc_rating ?? "Unverified"}</span><p>{official?.floor_area_sqm == null ? "Floor area: Unverified" : `${official.floor_area_sqm} m²`}</p></dd></div>
        <div><dt className="text-muted-foreground">HMO status</dt><dd className="mt-1">{official?.hmo_licensed == null ? "Unverified" : official.hmo_licensed ? "HMO Licensed" : "No licence recorded"}</dd>{official?.max_permitted_occupants != null && <dd>Max {official.max_permitted_occupants} occupants</dd>}</div>
        <div><dt className="text-muted-foreground">Local benchmark</dt><dd className="mt-1">{market ? benchmark[market.vs_local_benchmark] : "Unverified"}</dd></div>
      </dl>
      <div><p className="mb-1 text-muted-foreground">{bounded == null ? "Absorption: Unverified" : `${bounded.toFixed(0)}% absorbed`} · {market?.active_cohort_listings ?? "Unverified"} of {market?.total_cohort_stock_n ?? "Unverified"} {house ? `${house.bedrooms}-beds` : "listings"} left{market?.postcode_sector ? ` in ${market.postcode_sector}` : ""}</p>
        {bounded != null ? <div role="progressbar" aria-label="Micro-market absorption" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bounded} className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${verdict?.bar ?? "bg-primary"}`} style={{ width: `${bounded}%` }} /></div> : <div className="h-2 rounded-full bg-muted" />}
      </div>
      <details className="border-t border-border pt-2">
        <summary className="cursor-pointer font-semibold">Timing &amp; Contract Rules</summary>
        <div className="mt-3 space-y-3 leading-relaxed">
          <p>{timing?.rationale || "No agent assessment has been supplied for this property yet."}</p>
          {legal?.outside_6_month_window && legal.ground_4a_eligible_hmo && <p className="rounded border border-primary/30 bg-primary/10 p-2">Ground 4A: a landlord cannot rely on this possession ground if the tenancy is agreed more than six months before it starts. This is not a ban on signing early. Agent-calculated earliest date for this condition: {legal.earliest_ground_4a_signing_date || "Unverified"}. <a href="https://www.gov.uk/government/publications/grounds-for-possession-tenant-guidance/grounds-for-possession-guidance-for-tenants" target="_blank" rel="noopener noreferrer" className="underline">Government guidance</a></p>}
          {listing && <div><h4 className="font-semibold">Portal listings</h4><ul className="space-y-2">{listing.portals.map((p, i) => <li key={`${p.listing_url_or_id}-${i}`}><Source value={p.listing_url_or_id}>{p.agent_or_portal} · {money(p.pppw_gbp)}{p.pppw_gbp != null && " pppw"} · {p.status.replaceAll("_", " ")}</Source></li>)}</ul>{!listing.portals.length && <p>Unverified</p>}</div>}
          <div><h4 className="font-semibold">Official sources</h4>{official?.sources.length ? <ul>{official.sources.map((source, i) => <li key={`${source}-${i}`}><Source value={source}>{safeSourceUrl(source) ? `Public record ${i + 1}` : source}</Source></li>)}</ul> : <p>Unverified</p>}</div>
        </div>
      </details>
    </div>
  </div>;
}
