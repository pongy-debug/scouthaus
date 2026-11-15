import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Component, lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Starfield } from "@/components/hh/Starfield";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crumbs } from "@/components/hh/SiteNav";
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
      { name: "description", content: "Pick Durham or Newcastle to explore student houses in 3D." },
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
  const [hi, setHi] = useState(0);
  const gl = useWebGL();
  const [entering, setEntering] = useState(false);
  const [destination, setDestination] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);
  const go = (id: string) => {
    if (entering || timer.current) return;
    setEntering(true);
    setDestination(findCity(id)?.name ?? id);
    timer.current = setTimeout(() => {
      void nav({ to: "/find/$city", params: { city: id } }).finally(() => { setEntering(false); timer.current = null; });
    }, 2200);
  };
  // Suggestions only appear once something is typed and it matches the start of a city name.
  const sugg = q.trim() ? suggestCities(q) : [];
  const open = sugg.length > 0 && !missing;
  const active = Math.min(hi, sugg.length - 1);
  const submit = () => { const c = open ? sugg[active] : findCity(q); if (c) go(c.id); else if (q.trim()) setMissing(q.trim()); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
    e.preventDefault();
    setHi((active + (e.key === "ArrowDown" ? 1 : sugg.length - 1)) % sugg.length);
  };
  return (
    <div className="find-city-page flex min-h-screen flex-col gap-3 p-3">
      <div className="px-1"><Crumbs items={[{ label: "Home", to: "/" }, { label: "Find House" }]} /></div>
      <main className={`city-picker relative isolate flex min-h-[75vh] flex-1 items-center justify-center overflow-hidden rounded-3xl px-6 py-16 md:px-12 ${entering ? "city-picker-entering" : ""}`} aria-busy={entering}>
        <Starfield className="city-picker-stars" />
        <div className="city-globe-stage pointer-events-none absolute inset-0 -z-20" aria-hidden="true">
          {gl === true && <GlobeBoundary><Suspense fallback={null}><CityGlobe entering={entering} /></Suspense></GlobeBoundary>}
          {gl === false && <div className="city-globe-fallback" />}
        </div>
        <div className="city-globe-shade pointer-events-none absolute inset-0 -z-10" />
        <div className="city-picker-panel relative z-10 w-full max-w-160 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your next chapter starts here</p>
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">Which city are you looking in?</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">Find your city. Explore its neighbourhoods. Find a place to call home.</p>
          <form className="relative mx-auto mt-6 max-w-md text-left" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search for a city" role="combobox" aria-expanded={open} aria-controls="city-suggestions" aria-autocomplete="list" autoComplete="off" disabled={entering} value={q}
                onChange={(e) => { setQ(e.target.value); setMissing(null); setHi(0); }} onKeyDown={onKey} placeholder="Search your city, e.g. Durham"
                className="w-full rounded-2xl border border-white/15 bg-slate-950/50 py-4 pl-9 pr-3 shadow-lg shadow-black/10 backdrop-blur-sm text-sm outline-none focus:border-primary" />
            </div>
            {open && (
              <div id="city-suggestions" className="absolute inset-x-0 top-full z-10 mt-2 space-y-1 rounded-lg border border-white/15 bg-slate-950/75 p-1 backdrop-blur-sm duration-200 animate-in fade-in slide-in-from-top-1">
                {sugg.map((c, i) => (
                  <button disabled={entering} type="button" key={c.id} onClick={() => go(c.id)} onMouseEnter={() => setHi(i)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm text-white transition disabled:cursor-wait ${i === active ? "bg-white/10" : ""}`}>
                    <span>{c.name}</span><span className="font-mono text-xs text-muted-foreground">{c.areas.filter((a) => a.active).length} areas · {c.houses.length} houses</span>
                  </button>
                ))}
              </div>
            )}
          </form>
          {missing && (
            <div className="mx-auto mt-4 max-w-md rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
              <p><strong>{missing}</strong> is coming soon — explore Durham or Newcastle today.</p>
              <Button disabled={entering} className="mt-3" onClick={() => go("durham")}>Continue with Durham</Button>
              <Button disabled={entering} className="ml-2 mt-3" onClick={() => go("newcastle")}>Explore Newcastle</Button>
            </div>
          )}
        </div>
        {entering && <p role="status" className="absolute bottom-12 inset-x-4 text-center text-sm font-medium tracking-wide text-white">Flying into {destination}…</p>}
      </main>
    </div>
  );
}
