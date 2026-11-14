import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { PROPERTIES, type Layer } from "@/lib/hh/data";
import { PropertyDrawer } from "@/components/hh/PropertyDrawer";
import { ContractScanner } from "@/components/hh/ContractScanner";

const DurhamScene = lazy(() => import("@/components/hh/DurhamScene"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "HouseHunt — Durham Rental X-Ray" },
      { name: "description", content: "3D X-ray of Durham rentals: EPC, damp, winter bills, noise, plus a local tenancy contract red-flag scanner." },
      { property: "og:title", content: "HouseHunt — Durham Rental X-Ray" },
      { property: "og:description", content: "See heat loss, damp risk and unfair contract clauses before you sign in Durham." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const LAYERS: { id: Layer; label: string }[] = [
  { id: "thermal", label: "Thermal & EPC X-Ray" },
  { id: "damp", label: "Damp & Mould Risk" },
  { id: "bill", label: "Winter Bill Heatmap" },
  { id: "noise", label: "HMO & Late-Night Noise" },
];

function Index() {
  const [xray, setXray] = useState(true);
  const [layer, setLayer] = useState<Layer>("thermal");
  const [selected, setSelected] = useState("gilesgate");
  const [q, setQ] = useState("");
  const p = PROPERTIES.find((x) => x.id === selected)!;
  const matches = PROPERTIES.filter((x) => `${x.postcode} ${x.address} ${x.area}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen">
      <header className="glass flex flex-wrap items-center gap-3 px-4 py-2.5">
        <div className="text-xl font-extrabold tracking-tight">House<span className="text-primary">Hunt</span></div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={xray} onCheckedChange={setXray} /> 3D X-Ray Vision</label>
        <div className="relative ml-auto w-full max-w-md">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search postcode or street…" className="w-full rounded-lg border border-input bg-background/60 px-3 py-1.5 font-mono text-xs outline-none focus:border-primary" />
          {q && (
            <div className="glass absolute z-20 mt-1 w-full p-1">
              {matches.length ? matches.map((m) => <button key={m.id} onClick={() => { setSelected(m.id); setQ(""); }} className="block w-full rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-accent">{m.postcode} — {m.address}</button>) : <div className="p-2 text-xs text-muted-foreground">No match in the local Durham dataset</div>}
            </div>
          )}
        </div>
        <div className="flex w-full flex-wrap gap-1.5">
          {PROPERTIES.map((m) => (
            <button key={m.id} onClick={() => setSelected(m.id)} className={`rounded-md border px-2 py-1 font-mono text-[11px] transition ${m.id === selected ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {m.postcode} — {m.address} ({m.tag} • EPC {m.epc})
            </button>
          ))}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <section className="flex min-h-0 flex-col gap-3 lg:w-[58%]">
          <div className="glass relative h-[420px] overflow-hidden lg:h-auto lg:flex-1">
            <Suspense fallback={<div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">Rendering Durham…</div>}>
              <DurhamScene layer={layer} xray={xray} selected={selected} onSelect={setSelected} />
            </Suspense>
            <div className="glass absolute left-3 top-3 flex flex-col gap-1 p-2">
              <div className="px-1 text-[10px] uppercase tracking-widest text-muted-foreground">X-Ray layer</div>
              {LAYERS.map((l) => (
                <button key={l.id} onClick={() => { setLayer(l.id); setXray(true); }} className={`rounded px-2 py-1 text-left text-xs transition ${layer === l.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{l.label}</button>
              ))}
            </div>
            <div className="absolute bottom-3 right-3 font-mono text-[10px] text-muted-foreground">drag to orbit · scroll to zoom · right-drag to pan</div>
          </div>
          <PropertyDrawer p={p} />
        </section>
        <section className="min-h-[600px] lg:min-h-0 lg:w-[42%]"><ContractScanner /></section>
      </main>

      <footer className="glass flex flex-wrap justify-between gap-2 px-4 py-2 font-mono text-[10px] text-muted-foreground">
        <span>Local Demo Dataset: Modelled on UK Gov EPC Open Data (Durham DH1) & English Housing Statutes</span>
        <span>Responsible AI Guardrail: Tenant empowerment & educational transparency tool — not formal legal representation.</span>
      </footer>
    </div>
  );
}
