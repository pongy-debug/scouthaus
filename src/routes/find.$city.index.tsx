import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronUp, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Crumbs, SiteFooter, SiteNav } from "@/components/hh/SiteNav";
import { MapFallback, useWebGL } from "@/components/hh/MapFallback";
import { PropertyDrawer } from "@/components/hh/PropertyDrawer";
import { HouseList } from "@/components/hh/HouseList";
import { CompareDialog, MAX_COMPARE } from "@/components/hh/CompareDialog";
import { overviewPos } from "@/components/hh/overviewPos";
import { CITIES, RISK_LAYERS, applyFilters, defaultFilters, findCity, project, rentRange, type Filters, type House, type Risk, type RiskLayer } from "@/lib/hh/find";

const StreetMap = lazy(() => import("@/components/hh/StreetMap"));

const RISK_CLS: Record<Risk, string> = { low: "bg-success", med: "bg-warning", high: "bg-destructive" };
const field = "rounded-md border border-input bg-background px-2 py-1 font-mono text-xs outline-none focus:border-primary";

export const Route = createFileRoute("/find/$city/")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { area?: string } => (typeof s["area"] === "string" ? { area: s["area"] } : {}),
  loader: ({ params }) => { const c = findCity(params.city); if (!c) throw notFound(); return { cityId: c.id }; },
  head: ({ loaderData }) => {
    const name = CITIES.find((c) => c.id === loaderData?.cityId)?.name ?? "City";
    return { meta: [
      { title: `${name} student houses in 3D | Scouthaus` },
      { name: "description", content: `Explore ${name} student areas in 3D — every listed house with rent, availability and an EPC, HMO and noise X-ray.` },
      { property: "og:title", content: `${name} in 3D — Scouthaus` },
      { property: "og:description", content: `Click an area to fly in, then click a house for its X-ray.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: FindMap,
});

function FindMap() {
  const { cityId } = Route.useLoaderData();
  const city = CITIES.find((c) => c.id === cityId)!;
  const search = Route.useSearch();
  const nav = Route.useNavigate();
  const gl = useWebGL();
  const mobile = useIsMobile();
  const area = city.areas.find((a) => a.active && a.id === search.area) ?? null;

  const [filters, setFilters] = useState<Filters>(() => defaultFilters(city));
  const [layer, setLayer] = useState<RiskLayer>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const houses = applyFilters(city.houses, filters);
  const selected = houses.find((h) => h.id === selectedId) ?? null;
  const groups = (area ? [area] : city.areas.filter((a) => a.active)).map((a) => ({ area: a, houses: houses.filter((h) => h.area === a.id) }));
  const listed = groups.reduce((n, g) => n + g.houses.length, 0);
  const rents = rentRange(city);
  const legend = RISK_LAYERS.find((l) => l.id === layer)!.legend;
  // The list and the X-Ray share one slot, so an open drawer always collapses the list.
  const showList = listOpen && !selected;

  const setArea = (id: string | null) => void nav({ search: id ? { area: id } : {} });
  const pickArea = (id: string) => { setSelectedId(null); setArea(id); };
  const openHouse = (h: House) => { setHoverId(null); setSelectedId(h.id); if (h.area !== area?.id) setArea(h.area); };
  const toggleList = () => { if (selected) { setSelectedId(null); setListOpen(true); } else setListOpen((o) => !o); };
  const toggleCompare = (id: string) => setPinned((p) => {
    if (p.includes(id)) return p.filter((x) => x !== id);
    if (p.length >= MAX_COMPARE) { toast.error(`Compare holds up to ${MAX_COMPARE} houses — remove one first`); return p; }
    return [...p, id];
  });
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const list = <HouseList groups={groups} grouped={!area} hoverId={hoverId} selectedId={selectedId} onHover={setHoverId} onPick={openHouse}
    availableOnly={filters.availability === "available"} onAvailableOnly={(v) => set("availability", v ? "available" : "all")} />;
  const xray = selected && <PropertyDrawer house={selected} pinned={pinned.includes(selected.id)} onToggleCompare={() => toggleCompare(selected.id)} onClose={() => setSelectedId(null)} />;

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen">
      <SiteNav />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <Crumbs items={area
          ? [{ label: "Home", to: "/" }, { label: "Find House", to: "/find" }, { label: city.name, to: "/find/$city", params: { city: city.id } }, { label: area.name }]
          : [{ label: "Home", to: "/" }, { label: "Find House", to: "/find" }, { label: city.name }]} />
        {area
          ? <Button size="sm" variant="outline" onClick={() => { setSelectedId(null); setArea(null); }}><ArrowLeft /> Back to all areas</Button>
          : <span className="font-mono text-[10px] text-muted-foreground">hover an area · click to fly in · drag to orbit</span>}
      </div>

      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-xs text-muted-foreground" aria-label="Filters">
        <label className="flex items-center gap-2">Max rent
          <input type="range" min={rents.min} max={rents.max} step={1} value={filters.maxRent} onChange={(e) => set("maxRent", Number(e.target.value))} className="w-28 accent-primary" />
          <span className="w-16 font-mono text-foreground">£{filters.maxRent} pppw</span>
        </label>
        <label className="flex items-center gap-2">Bedrooms
          <select className={field} value={filters.minBeds} onChange={(e) => set("minBeds", Number(e.target.value))}>
            <option value={0}>Any</option><option value={4}>4+</option><option value={5}>5+</option><option value={6}>6+</option>
          </select>
        </label>
        <label className="flex items-center gap-2">EPC
          <select className={field} value={filters.epc} onChange={(e) => set("epc", e.target.value as Filters["epc"])}>
            <option value="any">Any</option><option value="C">C or better</option><option value="D">D or better</option>
          </select>
        </label>
        <label className="flex items-center gap-2">Availability
          <select className={field} value={filters.availability} onChange={(e) => set("availability", e.target.value as Filters["availability"])}>
            <option value="all">All</option><option value="available">Available</option><option value="under-offer">Under offer</option><option value="let">Let</option>
          </select>
        </label>
        <span className="ml-auto font-mono">{houses.length} of {city.houses.length} houses</span>
        <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters(city))}>Reset</Button>
      </div>

      <div data-scene-root className="glass relative h-[70vh] overflow-hidden lg:h-auto lg:flex-1">
        {gl === false ? (
          <MapFallback points={area
            ? houses.filter((h) => h.area === area.id).map((h) => { const [x, z] = project(h.lat, h.lng, area, 40); return { id: h.id, x, z, label: h.name, tone: h.availability === "available" ? "success" : h.availability === "let" ? "muted" : "warning", onClick: () => openHouse(h) }; })
            : city.areas.map((a) => { const [x, z] = overviewPos(city, a); return { id: a.id, x, z, label: `${a.name} · ${a.postcode}`, tone: a.active ? "primary" : "muted", onClick: a.active ? () => pickArea(a.id) : undefined }; })} />
        ) : gl ? (
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <StreetMap city={city} area={area} houses={houses} layer={layer} selectedId={selected?.id ?? null} hoverId={hoverId} onPickArea={pickArea} onOpen={openHouse} onHover={setHoverId} />
          </Suspense>
        ) : <Skeleton className="h-full w-full" />}

        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto space-y-2">
            <div className="glass flex flex-wrap gap-1 p-1" role="group" aria-label="Risk layer">
              {RISK_LAYERS.map((l) => (
                <button key={l.id} type="button" aria-pressed={layer === l.id} onClick={() => setLayer(l.id)}
                  className={`rounded px-2 py-1 text-xs transition ${layer === l.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{l.label}</button>
              ))}
            </div>
            <div className="glass inline-flex flex-wrap gap-x-3 gap-y-1 px-2 py-1 text-[11px]">
              {(Object.keys(legend) as Risk[]).map((r) => <span key={r} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${RISK_CLS[r]}`} />{legend[r]}</span>)}
            </div>
          </div>
          <div className="pointer-events-auto ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCompareOpen(true)}><GitCompareArrows /> Compare ({pinned.length})</Button>
            <Button size="sm" variant="secondary" aria-expanded={showList} onClick={toggleList}>Houses ({listed}) {showList ? <ChevronUp /> : <ChevronDown />}</Button>
          </div>
        </div>

        {!mobile && (showList || selected) && (
          <aside className="glass absolute bg-popover/95 bottom-9 right-3 top-14 z-20 flex w-[340px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden" aria-label={selected ? "Property X-Ray" : "Houses"}>
            {selected ? <div className="min-h-0 flex-1 overflow-y-auto p-3">{xray}</div> : list}
          </aside>
        )}
      </div>
      <SiteFooter />

      {mobile && (
        <>
          <Drawer shouldScaleBackground={false} open={showList} onOpenChange={setListOpen}>
            <DrawerContent className="h-[70vh]">
              <DrawerTitle className="px-3 pt-3 text-base">Houses ({listed})</DrawerTitle>
              <DrawerDescription className="px-3 pb-1 text-xs">{area ? area.name : `All areas in ${city.name}`} · tap a house to fly to it</DrawerDescription>
              {list}
            </DrawerContent>
          </Drawer>
          <Drawer shouldScaleBackground={false} open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerTitle className="sr-only">Property X-Ray</DrawerTitle>
              <DrawerDescription className="sr-only">Costs, EPC, HMO licensing, noise and reviews for the selected house</DrawerDescription>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">{xray}</div>
            </DrawerContent>
          </Drawer>
        </>
      )}
      <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} houses={pinned.flatMap((id) => city.houses.filter((h) => h.id === id))} areas={city.areas} onRemove={toggleCompare} />
    </div>
  );
}
