# Newcastle listings and data

The five Newcastle adverts in `src/lib/hh/find.ts` were entered from the owner's supplied details. No extra StuRents listings were scraped. Photo URLs remain remote and are linked and credited to the original advert. Availability dates reflect the supplied advert details, not a live availability feed.

Pins use the supplied street/postcode and Postcodes.io postcode centres checked on 14 November 2026. All five pins are marked approximate, including 1 Lillico House because its exact building location has not been verified. Approximate pins must not snap onto an arbitrary OSM building.

The original Durham implementation has seeded demo telemetry and no national API clients or walking routes. Newcastle never inherits that telemetry. Its unknown measurements remain grey on risk layers, are excluded from EPC-restricted searches, and cannot be used by the chatbot to rank houses by heating, noise or damp.

`propertyInsights.ts` provides city-independent server-side clients for:

- Postcodes.io postcode lookup: https://postcodes.io/
- Police.uk latest available monthly reports within one mile of the approximate pin: https://data.police.uk/docs/method/crime-street/
- The current England/Wales EPC search API: https://get-energy-performance-data.communities.gov.uk/api-technical-documentation/search-certificates/domestic

Configure `EPC_API_TOKEN` in Lovable Secrets to enable EPC lookup. Do not commit the token. The current service uses a bearer token obtained through GOV.UK One Login; the retired OpenDataCommunities service is not used. EPC lookup only accepts an exact address and postcode match, never the first certificate on a street. The first four listings need a published full address before automated matching is possible. Unavailable services display unknown/unavailable data, not synthetic results.

No Newcastle HMO register has been supplied. Status remains “Not checked yet”; no Durham register is consulted.

Walking times are labelled estimates: straight-line distance multiplied by 1.25, at 4.8 km/h. University destinations live with each city in `find.ts`; links open a walking-route search for the actual street/postcode. These are not routed travel times.
