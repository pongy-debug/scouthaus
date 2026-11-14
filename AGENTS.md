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
- Listing data lives client-side in src/lib/hh. Contract Scanner: uploads and pasted text go to Google Gemini through the `analyseContract` server function (src/lib/hh/gemini.ts), using the owner's own `GEMINI_API_KEY` secret (owner's decision — a deliberate exception to the Lovable gateway rule above; optional `GEMINI_MODEL`). Never call Gemini from browser code.
- The scanner must keep working with no key or offline: it falls back to the local reader (src/lib/hh/pdf.ts: pdf.js text + tesseract OCR) and the rules in scanner.ts. Built-in samples always run locally.
- Find House maps use MapLibre (OpenFreeMap positron vector tiles, fill-extrusion) in StreetMap, lazy-loaded on ssr:false routes; X-Ray map is still R3F (DurhamScene).
- Find House areas/houses live in src/lib/hh/find.ts (CITIES); scenes place them with `project()` from real lat/lng — add cities there, not in components.
- Route modules must not import scene modules (three.js) statically; shared helpers like overviewPos live in three-free files.
