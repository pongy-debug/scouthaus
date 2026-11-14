import type { Property } from "@/lib/hh/data";

const EPCS = ["A", "B", "C", "D", "E", "F", "G"] as const;
const epcTone = (e: string) => (e <= "B" ? "bg-success" : e <= "D" ? "bg-warning" : "bg-destructive");
const tone = (v: number) => (v >= 70 ? "text-destructive" : v >= 40 ? "text-warning" : "text-primary");

export function PropertyDrawer({ p }: { p: Property }) {
  const diff = Math.round(((p.rent - p.median) / p.median) * 100);
  return (
    <div className="glass grid gap-4 p-4 md:grid-cols-4">
      <div className="md:col-span-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Property physics & telemetry</div>
          <h2 className="text-lg font-bold">{p.address} <span className="font-mono text-sm text-primary">{p.postcode}</span></h2>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{p.area} · {p.tag}</span>
      </div>
      <Stat title="EPC energy rating">
        <div className="font-mono text-2xl font-semibold">{p.epc} <span className="text-sm text-muted-foreground">({p.epcScore}/100)</span></div>
        <div className="mt-2 flex gap-0.5">
          {EPCS.map((e) => <div key={e} className={`flex h-5 flex-1 items-center justify-center rounded-sm font-mono text-[10px] ${e === p.epc ? `${epcTone(e)} text-background font-bold scale-y-125` : "bg-muted text-muted-foreground"}`}>{e}</div>)}
        </div>
      </Stat>
      <Stat title="Predicted winter heating bill">
        <div className={`font-mono text-2xl font-semibold ${tone((p.bill - 80) / 2.2)}`}>£{p.bill}<span className="text-sm text-muted-foreground">/mo</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{p.billFactors.join(" • ")}</p>
      </Stat>
      <Stat title="Damp & condensation risk">
        <div className={`font-mono text-2xl font-semibold ${tone(p.damp)}`}>{p.damp}/100 <span className="text-sm">{p.damp >= 70 ? "High" : p.damp >= 40 ? "Moderate" : "Low"}</span></div>
        <p className="mt-1 line-clamp-4 text-xs text-muted-foreground" title={p.dampNote}>{p.dampNote}</p>
      </Stat>
      <Stat title="Fair rent benchmark">
        <div className="font-mono text-sm">Advertised: <span className="text-lg font-semibold">£{p.rent}/wk</span></div>
        <div className="font-mono text-sm text-muted-foreground">{p.postcode.split(" ")[0]} median: £{p.median}/wk</div>
        <div className={`mt-1 font-mono text-sm font-semibold ${diff > 10 ? "text-destructive" : diff > 3 ? "text-warning" : "text-primary"}`}>{diff > 0 ? "+" : ""}{diff}% {diff > 10 ? "Overpriced" : diff > 3 ? "Slightly high" : "Fair"}</div>
      </Stat>
    </div>
  );
}
function Stat({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-background/40 p-3"><div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{title}</div>{children}</div>;
}
