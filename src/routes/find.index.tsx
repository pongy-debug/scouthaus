import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crumbs, SiteFooter, SiteNav } from "@/components/hh/SiteNav";
import { findCity, suggestCities } from "@/lib/hh/find";
import { useWebGL } from "@/components/hh/MapFallback";

const CityGlobe = lazy(() => import("@/components/hh/CityGlobe"));
class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() { return this.state.failed ? <div className="city-globe-fallback" /> : this.props.children; }
}

export const Route = createFileRoute("/find/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Find House — Choose your city | Scouthaus" },
      { name: "description", content: "Pick a city to explore student houses in 3D. Currently available in Durham." },
      { property: "og:title", content: "Find a student house in 3D — Scouthaus" },
      { property: "og:description", content: "Search a city and fly into its student areas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FindCity,
});

function FindCity() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [missing, setMissing] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gl = useWebGL();
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); if (timer.current) clearTimeout(timer.current); };
  }, []);
  const go = (id: string) => {
    if (entering || timer.current) return;
    setEntering(true);
    timer.current = setTimeout(() => {
      void nav({ to: "/find/$city", params: { city: id } }).finally(() => { setEntering(false); timer.current = null; });
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1600);
  };
  const submit = () => { const c = findCity(q); if (c) go(c.id); else if (q.trim()) setMissing(q.trim()); };
  const sugg = suggestCities(q);
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <SiteNav />
      <div className="px-1"><Crumbs items={[{ label: "Home", to: "/" }, { label: "Find House" }]} /></div>
      <main className={`city-picker relative isolate flex min-h-[75vh] flex-1 items-center justify-center overflow-hidden rounded-2xl px-4 py-16 ${entering ? "city-picker-entering" : ""}`} aria-busy={entering}>
        <div className="city-globe-stage pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
          {gl ? <GlobeBoundary><Suspense fallback={<div className="city-globe-fallback" />}><CityGlobe entering={entering} reducedMotion={reducedMotion} /></Suspense></GlobeBoundary> : <div className="city-globe-fallback" />}
        </div>
        <div className="city-globe-shade pointer-events-none absolute inset-0 -z-10" />
        <div className="city-picker-panel w-full max-w-lg rounded-2xl border border-white/15 bg-slate-950/65 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your next chapter starts here</p>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Which city are you looking in?</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">Find your city. Explore its neighbourhoods. Find a place to call home.</p>
          <form className="mt-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search for a city" disabled={entering} value={q} onChange={(e) => { setQ(e.target.value); setMissing(null); }} placeholder="Start typing a city, e.g. Durham"
                className="w-full rounded-lg border border-input bg-background/60 py-3 pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            {sugg.length > 0 && !missing && (
              <div className="mt-2 space-y-1">
                {sugg.map((c) => (
                  <button disabled={entering} type="button" key={c.id} onClick={() => go(c.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/20 bg-slate-950/70 px-4 py-3 text-left text-sm text-white transition hover:border-primary hover:bg-slate-800 disabled:cursor-wait">
                    <span>{c.name}</span><span className="font-mono text-xs text-muted-foreground">{c.areas.filter((a) => a.active).length} areas · {c.houses.length} houses</span>
                  </button>
                ))}
              </div>
            )}
          </form>
          {missing && (
            <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
              <p><strong>{missing}</strong> is coming soon — Scouthaus is currently available in Durham.</p>
              <Button disabled={entering} className="mt-3" onClick={() => go("durham")}>Continue with Durham</Button>
            </div>
          )}
        </div>
        {entering && <p role="status" className="absolute bottom-12 inset-x-4 text-center text-sm font-medium tracking-wide text-white">Flying into Durham…</p>}
      </main>
      <SiteFooter />
    </div>
  );
}
