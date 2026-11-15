<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## HouseHunt
- Listing data lives client-side in src/lib/hh. Contract Scanner: the contract is read in the browser (src/lib/hh/pdf.ts: pdf.js text + tesseract OCR), personal details are replaced by placeholders in the browser (src/lib/hh/redact.ts), the user reviews them in the Privacy check panel, and only the redacted text goes to Google Gemini through the `analyseContract` server function (src/lib/hh/gemini.ts), using the owner's own `GEMINI_API_KEY` secret (owner's decision — a deliberate exception to the Lovable gateway rule above; optional `GEMINI_MODEL`). Never call Gemini from browser code.
- Privacy rules for the scanner: `analyseContract` takes text only — never add a file/bytes input, and never send, log or store the original contract text or the value→placeholder map (it lives in component state only). Placeholders are swapped back to real values in the browser. The same rule covers `summariseContract` (plain-English summary) and `draftEmail` / `reviseEmail` (email to the landlord, src/components/hh/EmailDrafter.tsx): they receive redacted text only, and the email has no template fallback — a Gemini failure shows an error with "Try again".
- The scanner must keep working with no key or offline: the red-flag check falls back to the rules in scanner.ts, run on the device (the summary and email need Gemini). The built-in sample goes through the same redaction flow as an upload.
- Find House maps use MapLibre (OpenFreeMap positron vector tiles, fill-extrusion) in StreetMap, lazy-loaded on ssr:false routes; X-Ray map is still R3F (DurhamScene).
- Find House areas/houses live in src/lib/hh/find.ts (CITIES); scenes place them with `project()` from real lat/lng — add cities there, not in components.
- Map landmarks (cathedral, library, station) are their own data set in src/lib/hh/landmarks.ts, never house listings. That file is written by `node scripts/build-landmarks.mjs` (Postcodes.io check, OSM footprints, Wikimedia Commons photo + credit, free licences only) — add a landmark to SEEDS there and rerun; do not call Wikipedia or OSM from the app. Cyan (#22D3EE) is reserved for hovered landmarks.
- The house search box lives in HouseList; its text is one state in the city route shared with the filters and the map assistant (`MapAction.query`), matched by `matchesSearch` in find.ts.
- Route modules must not import scene modules (three.js) statically; shared helpers like overviewPos live in three-free files.
