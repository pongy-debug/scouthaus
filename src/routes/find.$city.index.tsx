import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Crumbs, SiteFooter, SiteNav } from "@/components/hh/SiteNav";
import { MapFallback, useWebGL } from "@/components/hh/MapFallback";
import { CITIES, findCity } from "@/lib/hh/find";
import { overviewPos } from "@/components/hh/overviewPos";

const StreetMap = lazy(() => import("@/components/hh/StreetMap"));

export const Route = createFileRoute("/find/$city/")({
  ssr: false,
  loader: ({ params }) => { const c = findCity(params.city); if (!c) throw notFound(); return { cityId: c.id }; },
  head: ({ loaderData }) => {
    const name = CITIES.find((c) => c.id === loaderData?.cityId)?.name ?? "City";
    return { meta: [
      { title: `${name} student areas in 3D | HouseHunt` },
      { name: "description", content: `Explore ${name} postcode areas in 3D — available houses and average rents at a glance.` },
      { property: "og:title", content: `${name} in 3D — HouseHunt` },
      { property: "og:description", content: `Hover an area to see available houses and rent, click to fly in.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: Overview,
});

function Overview() {
  const { cityId } = Route.useLoaderData();
  const city = CITIES.find((c) => c.id === cityId)!;
  const nav = useNavigate();
  const gl = useWebGL();
  const pick = (area: string) => nav({ to: "/find/$city/$area", params: { city: city.id, area } });
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen">
      <SiteNav />
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <Crumbs items={[{ label: "Home", to: "/" }, { label: "Find House", to: "/find" }, { label: city.name }]} />
        <span className="font-mono text-[10px] text-muted-foreground">hover an area · click to fly in · drag to orbit</span>
      </div>
      <div data-scene-root className="glass relative h-[70vh] overflow-hidden lg:h-auto lg:flex-1">
        {gl === false ? (
          <MapFallback points={city.areas.map((a) => { const [x, z] = overviewPos(city, a); return { id: a.id, x, z, label: `${a.name} · ${a.postcode}`, tone: a.active ? "primary" : "muted", onClick: a.active ? () => pick(a.id) : undefined }; })} />
        ) : gl ? (
          <Suspense fallback={<Skeleton className="h-full w-full" />}><StreetMap mode="overview" city={city} onPick={pick} /></Suspense>
        ) : <Skeleton className="h-full w-full" />}
      </div>
      <SiteFooter />
    </div>
  );
}
