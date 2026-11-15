# House timing assessments

Find House renders `HouseTimingCard` beneath each listing's existing map-selection button. Expanders and external source links are separate controls, so they do not open the property drawer.

Optional precomputed assessments go in `src/lib/hh/evaluated-houses.json`, with an `evaluated_houses` array matching `timing-types.ts`. Match `property_id` exactly to the listing's `id` in `find.ts`. The file is intentionally empty; users can request a live Gemini assessment using the action on each card.

`parseEvaluatedHouses` validates data, excludes malformed records and duplicate IDs, and makes a map for exact-ID lookup. API integrations can use the same parser. Do not put API keys in this client-side file. Unknown assessments render explicit Unverified fields without a recommendation or a fake scarcity score. Progress values are bounded to 0–100; null remains unknown. Plain source IDs remain text, and only HTTP(S) sources become links.

The six-month Ground 4A condition affects a landlord's ability to use that possession ground, not the validity of an earlier tenancy agreement. The UI deliberately corrects the proposed blanket ban on early signing. Source checked 15 November 2026: https://www.gov.uk/government/publications/grounds-for-possession-tenant-guidance/grounds-for-possession-guidance-for-tenants

Do not interpret `hmo_licensed: false` as proof that a property is not an HMO. Do not derive whole-market scarcity from the app's small manually entered listing sample or label an AI-generated estimate as verified public data.

## Gemini web research

Each card has an on-demand Check timing with Gemini action. `timingAgent.ts` accepts only a known listing ID; `timingResearch.server.ts` sends public listing fields to Gemini with Google Search, then makes a separate JSON extraction request. The existing GEMINI_API_KEY stays server-side; optional GEMINI_TIMING_MODEL defaults to gemini-2.5-flash. Never expose keys in client code or JSON files.

The search must supply grounding citations. Fact fields without source-index evidence are cleared. Actual citation URLs replace generated portal links. Web-derived results are labelled AI assessments rather than independently verified data. Missing or ambiguous unit matches should remain unknown. Grounding is not an independent audit: users should inspect the linked sources.

Calculations: available same-unit portal price minimum/maximum; saving = maximum - minimum; absorption = 100 * (total stock - active stock) / total stock, only with valid cited same-cohort counts. Six-month dates use calendar months and clamp to the final day of the target month. Unsupported scarcity cannot trigger SIGN_NOW. Partial evidence and API errors never create fake values.

Research uses up to two Gemini calls per property. Results are cached for 30 minutes client-side and in-process server-side; concurrent identical requests coalesce. The server allows at most two concurrent requests and ten starts per minute per process. These are best-effort limits in multi-instance deployments, not an account-wide quota. Search suggestions are rendered in a script-disabled sandboxed iframe.

Model/API documentation: https://ai.google.dev/gemini-api/docs/generate-content/google-search
