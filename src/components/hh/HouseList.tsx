import { HouseTimingAssessment } from "./HouseTimingAssessment";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { HouseThumb } from "@/components/hh/HousePhoto";
import { AVAIL_LABEL, advertUrl, bedsOf, rentOf, searchTerms, type Area, type Availability, type House } from "@/lib/hh/find";

const BADGE: Record<Availability, string> = {
  available: "border-success/50 bg-success/15 text-success",
  "under-offer": "border-warning/50 bg-warning/15 text-warning",
  let: "border-border bg-muted text-muted-foreground",
};

export interface HouseGroup { area: Area; houses: House[] }

/** `text` with every search word marked. */
function Hit({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${[...terms].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-primary/30 text-inherit">{part}</mark> : part))}</>;
}

/** Houses for the current view: grouped by area on the overview, a single group inside an area. */
export function HouseList({ groups, grouped, hoverId, selectedId, availableOnly, onAvailableOnly, onHover, onPick, query, onQuery, cityName, onSearchCity }: {
  groups: HouseGroup[]; grouped: boolean; hoverId: string | null; selectedId: string | null;
  availableOnly: boolean; onAvailableOnly: (v: boolean) => void; onHover: (id: string | null) => void; onPick: (h: House) => void;
  /** Search text, shared with the map assistant. */
  query: string; onQuery: (q: string) => void; cityName: string;
  /** Inside an area: widen the search to the whole city. Absent on the city overview. */
  onSearchCity?: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hoverId) root.current?.querySelector(`[data-house="${hoverId}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [hoverId]);
  const flat = groups.flatMap((g) => g.houses);
  const empty = flat.length === 0;
  const terms = searchTerms(query);
  const searching = terms.length > 0;
  // Arrow keys walk the results (the map highlights each one); Enter opens the highlighted or the first result.
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && query) { e.preventDefault(); onQuery(""); return; }
    if (!flat.length) return;
    const at = flat.findIndex((h) => h.id === hoverId);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      onHover(flat[e.key === "ArrowDown" ? Math.min(flat.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1)]!.id);
    } else if (e.key === "Enter") { e.preventDefault(); onPick(flat[Math.max(0, at)]!); }
  };
  const link = "font-medium text-primary underline underline-offset-2 hover:brightness-110";
  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col">
      <div className="relative border-b border-border p-2">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" role="combobox" aria-expanded={!empty} aria-controls="house-results" aria-activedescendant={hoverId && flat.some((h) => h.id === hoverId) ? `house-option-${hoverId}` : undefined}
          aria-label="Search houses" placeholder="Search by house, street, postcode or agent" value={query} autoComplete="off"
          onChange={(e) => onQuery(e.target.value)} onKeyDown={onKey}
          className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-9 text-sm text-foreground outline-none placeholder:text-xs focus:border-primary focus:ring-1 focus:ring-primary [&::-webkit-search-cancel-button]:appearance-none" />
        {query && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => onQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button>}
      </div>
      <label className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <Switch checked={availableOnly} onCheckedChange={onAvailableOnly} /> Available only
      </label>
      <div id="house-results" className="min-h-0 flex-1 overflow-y-auto p-1.5" onMouseLeave={() => onHover(null)}>
        {empty && (searching ? (
          <div className="space-y-2 p-3 text-xs text-muted-foreground" role="status">
            <p className="text-sm font-medium text-foreground">No houses match your search</p>
            {onSearchCity && <p><button type="button" className={link} onClick={onSearchCity}>Search all of {cityName}</button></p>}
            <p><button type="button" className={link} onClick={() => onQuery("")}>Clear search</button></p>
          </div>
        ) : <p className="p-3 text-xs text-muted-foreground">No houses match your filters in this area. Adjust the filters or return to all areas.</p>)}
        {groups.map((g) => g.houses.length > 0 && (
          <section key={g.area.id}>
            {grouped && <h3 className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.area.name} · {g.houses.length}</h3>}
            {g.houses.map((h) => {
              const url = advertUrl(h);
              return (
                <article key={h.id} className="mb-3 space-y-1">
                <div onMouseEnter={() => onHover(h.id)}
                  className={`flex items-center rounded-md border transition ${h.id === selectedId ? "border-primary bg-primary/15" : h.id === hoverId ? "border-primary/60 bg-accent" : "border-transparent"}`}>
                  <button type="button" id={`house-option-${h.id}`} data-house={h.id} onFocus={() => onHover(h.id)} onClick={() => onPick(h)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
                    <HouseThumb house={h} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold"><Hit text={h.name} terms={terms} /></span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground"><Hit text={g.area.name} terms={terms} /> · {rentOf(h)} · {h.propertyType === "studio" ? "Studio" : bedsOf(h)}</span>
                      {searching && <span className="block truncate text-[11px] text-muted-foreground"><Hit text={[h.address, h.address.includes(h.postcode) ? "" : h.postcode, h.landlord].filter(Boolean).join(" · ")} terms={terms} /></span>}
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${BADGE[h.availability]}`}>{AVAIL_LABEL[h.availability]}</span>
                  </button>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`View original advert for ${h.name}`} title="View original advert" className="shrink-0 p-2 text-muted-foreground hover:text-primary">
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
                <HouseTimingAssessment propertyId={h.id} />
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
