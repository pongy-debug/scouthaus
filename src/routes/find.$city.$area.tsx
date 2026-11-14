import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Crumbs, SiteFooter, SiteNav } from "@/components/hh/SiteNav";
import { MapFallback, useWebGL } from "@/components/hh/MapFallback";
import { PropertyDrawer } from "@/components/hh/PropertyDrawer";
import { CITIES, findCity, houseToProperty, project, type Availability, type House } from "@/lib/hh/find";

const StreetMap = lazy(() => import("@/components/hh/StreetMap"));

const LEGEND: { id: Availability; label: string; cls: string }[] = [
  { id: "available", label: "Available", cls: "bg-success" },
  { id: "under-offer", label: "Under offer", cls: "bg-warning" },
  { id: "let", label: "Let", cls: "bg-muted-foreground" },
];

export const Route = createFileRoute("/find/$city/$area")({
  ssr: false,
  loader: ({ params }) => {
    const c = findCity(params.city); const a = c?.areas.find((x) => x.id === params.area && x.active);
    if (!c || !a) throw notFound();
    return { cityId: c.id, areaId: a.id, title: `${a.name}, ${c.name}` };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.title ?? "Area";
    return { meta: [
      { title: `${t} student houses in 3D | HouseHunt` },
      { name: "description", content: `Every listed student house in ${t}, colour-coded by availability, with rent, bedrooms and an energy & damp X-ray.` },
      { property: "og:title", content: `${t} — student houses in 3D` },
      { property: "og:description", content: `Hover a house for rent and availability, click for the full X-ray.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: Detail,
});

function Detail() {
  const { cityId, areaId } = Route.useLoaderData();
  const city = CITIES.find((c) => c.id === cityId)!;
  const area = city.areas.find((a) => a.id === areaId)!;
  const [onlyAvail, setOnlyAvail] = useState(false);
  
  const [open, setOpen] = useState<House | null>(null);
  const gl = useWebGL();
  const houses = city.houses.filter((h) => h.area === area.id && (!onlyAvail || h.availability === "available"));

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen">
      <SiteNav />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <Crumbs items={[{ label: "Home", to: "/" }, { label: "Find House", to: "/find" }, { label: city.name, to: "/find/$city", params: { city: city.id } }, { label: area.name }]} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={onlyAvail} onCheckedChange={setOnlyAvail} /> Available only</label>
          <Button asChild size="sm" variant="outline"><Link to="/find/$city" params={{ city: city.id }}><ArrowLeft /> Back to all areas</Link></Button>
        </div>
      </div>
      <div data-scene-root className="glass relative h-[70vh] overflow-hidden lg:h-auto lg:flex-1">
        {gl === false ? (
          <MapFallback points={houses.map((h) => { const [x, z] = project(h.lat, h.lng, area, 40); return { id: h.id, x, z, label: h.name, tone: h.availability === "available" ? "success" : h.availability === "let" ? "muted" : "warning", onClick: () => setOpen(h) }; })} />
        ) : gl ? (
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <StreetMap mode="detail" city={city} area={area} houses={houses} onOpen={setOpen} />
          </Suspense>
        ) : <Skeleton className="h-full w-full" />}
        <div className="glass absolute left-3 top-3 space-y-1 p-2 text-xs">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{area.name} · {area.postcode} · {houses.length} houses</div>
          {LEGEND.map((l) => <div key={l.id} className="flex items-center gap-2"><span className={`size-3 rounded-sm ${l.cls}`} />{l.label}</div>)}
        </div>
        <div className="absolute bottom-3 right-3 font-mono text-[10px] text-muted-foreground">hover near a house · click for X-ray · right-drag to tilt/orbit</div>
      </div>
      <SiteFooter />
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          {open && <>
            <SheetHeader><SheetTitle>{open.name} — {open.landlord}</SheetTitle></SheetHeader>
            <div className="mb-3 font-mono text-xs text-muted-foreground">{open.bedrooms} bedrooms · £{open.rent} pppw · {LEGEND.find((l) => l.id === open.availability)!.label}</div>
            <PropertyDrawer p={houseToProperty(open, area)} />
          </>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
