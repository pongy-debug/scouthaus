import { useEffect, useRef } from "react";
import { ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { HouseThumb } from "@/components/hh/HousePhoto";
import { AVAIL_LABEL, advertUrl, bedsOf, type Area, type Availability, type House } from "@/lib/hh/find";

const BADGE: Record<Availability, string> = {
  available: "border-success/50 bg-success/15 text-success",
  "under-offer": "border-warning/50 bg-warning/15 text-warning",
  let: "border-border bg-muted text-muted-foreground",
};

export interface HouseGroup { area: Area; houses: House[] }

/** Houses for the current view: grouped by area on the overview, a single group inside an area. */
export function HouseList({ groups, grouped, hoverId, selectedId, availableOnly, onAvailableOnly, onHover, onPick }: {
  groups: HouseGroup[]; grouped: boolean; hoverId: string | null; selectedId: string | null;
  availableOnly: boolean; onAvailableOnly: (v: boolean) => void; onHover: (id: string | null) => void; onPick: (h: House) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hoverId) root.current?.querySelector(`[data-house="${hoverId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hoverId]);
  const empty = groups.every((g) => g.houses.length === 0);
  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col">
      <label className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
        <Switch checked={availableOnly} onCheckedChange={onAvailableOnly} /> Available only
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5" onMouseLeave={() => onHover(null)}>
        {empty && <p className="p-3 text-xs text-muted-foreground">No houses match the current filters.</p>}
        {groups.map((g) => g.houses.length > 0 && (
          <section key={g.area.id}>
            {grouped && <h3 className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.area.name} · {g.houses.length}</h3>}
            {g.houses.map((h) => {
              const url = advertUrl(h);
              return (
                <div key={h.id} onMouseEnter={() => onHover(h.id)}
                  className={`flex items-center rounded-md border transition ${h.id === selectedId ? "border-primary bg-primary/15" : h.id === hoverId ? "border-primary/60 bg-accent" : "border-transparent"}`}>
                  <button type="button" data-house={h.id} onFocus={() => onHover(h.id)} onClick={() => onPick(h)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left">
                    <HouseThumb house={h} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{h.name}</span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">{g.area.name} · £{h.rent} pppw · {bedsOf(h)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${BADGE[h.availability]}`}>{AVAIL_LABEL[h.availability]}</span>
                  </button>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`View original advert for ${h.name}`} title="View original advert" className="shrink-0 p-2 text-muted-foreground hover:text-primary">
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
