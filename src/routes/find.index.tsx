import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crumbs, SiteFooter, SiteNav } from "@/components/hh/SiteNav";
import { findCity, suggestCities } from "@/lib/hh/find";

export const Route = createFileRoute("/find/")({
  head: () => ({
    meta: [
      { title: "Find House — Choose your city | HouseHunt" },
      { name: "description", content: "Pick a city to explore student houses in 3D. Currently available in Durham." },
      { property: "og:title", content: "Find a student house in 3D — HouseHunt" },
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
  const go = (id: string) => nav({ to: "/find/$city", params: { city: id } });
  const submit = () => { const c = findCity(q); if (c) go(c.id); else if (q.trim()) setMissing(q.trim()); };
  const sugg = suggestCities(q);
  return (
    <div className="flex min-h-screen flex-col gap-3 p-3">
      <SiteNav />
      <div className="px-1"><Crumbs items={[{ label: "Home", to: "/" }, { label: "Find House" }]} /></div>
      <main className="flex flex-1 items-center justify-center">
        <div className="glass w-full max-w-lg p-8">
          <h1 className="text-2xl font-bold">Which city are you looking in?</h1>
          <form className="relative mt-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setMissing(null); }} placeholder="Start typing a city, e.g. Durham"
              className="w-full rounded-lg border border-input bg-background/60 py-3 pl-9 pr-3 text-sm outline-none focus:border-primary" />
            {sugg.length > 0 && !missing && (
              <div className="mt-2 space-y-1">
                {sugg.map((c) => (
                  <button type="button" key={c.id} onClick={() => go(c.id)} className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary hover:bg-accent">
                    <span>{c.name}</span><span className="font-mono text-xs text-muted-foreground">{c.areas.filter((a) => a.active).length} areas · {c.houses.length} houses</span>
                  </button>
                ))}
              </div>
            )}
          </form>
          {missing && (
            <div className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
              <p><strong>{missing}</strong> is coming soon — HouseHunt is currently available in Durham.</p>
              <Button className="mt-3" onClick={() => go("durham")}>Continue with Durham</Button>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
