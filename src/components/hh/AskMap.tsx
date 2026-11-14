import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { askMap, type MapAction } from "@/lib/hh/assistant";
import { AVAIL_LABEL, RISK_LAYERS, bedsLabel, type Area, type Filters, type House, type RiskLayer } from "@/lib/hh/find";

interface Msg { role: "user" | "assistant"; text: string; applied?: string[]; error?: boolean }
export interface AskMapState { filters: Filters; layer: RiskLayer; areaId: string | null; selectedId: string | null }

const SUGGESTIONS = ["4–5 beds in Gilesgate under £150, available only", "We're a group of 5 — quietest house?", "Which house has the lowest true monthly cost?"];
const HELLO: Msg = { role: "assistant", text: "Tell me what you're looking for — budget, bedrooms, warm, quiet, an area — and I'll set the filters and fly you to the best match." };

/** What the assistant changed on the map, shown as chips under its reply. */
function describe(a: MapAction, prev: AskMapState, areas: Area[], houses: House[]): string[] {
  const beds = { min: Math.min(...houses.map((h) => h.bedrooms)), max: Math.max(...houses.map((h) => h.bedrooms)) };
  const out: string[] = [];
  const f = a.filters, p = prev.filters;
  if (f.maxRent !== p.maxRent) out.push(`Max £${f.maxRent} pppw`);
  if (f.minBeds !== p.minBeds || f.maxBeds !== p.maxBeds) { const b = bedsLabel(f, beds); out.push(b === "Any" ? "Any bedrooms" : `${b} bedrooms`); }
  if (f.epc !== p.epc) out.push(f.epc === "any" ? "Any EPC" : `EPC ${f.epc} or better`);
  if (f.availability !== p.availability) out.push(f.availability === "all" ? "Any availability" : `${AVAIL_LABEL[f.availability]} only`);
  if (a.layer !== prev.layer) out.push(`Layer: ${RISK_LAYERS.find((l) => l.id === a.layer)!.label}`);
  const h = a.houseId ? houses.find((x) => x.id === a.houseId) : undefined;
  if (h) { if (h.id !== prev.selectedId) out.push(`Flew to ${h.name}`); }
  else if (a.areaId === null) { if (prev.areaId || prev.selectedId) out.push("Back to all areas"); }
  else if (a.areaId && a.areaId !== prev.areaId) out.push(`Flew to ${areas.find((x) => x.id === a.areaId)?.name ?? a.areaId}`);
  return out;
}

/** Floating "Ask the map" chat: every reply can update the filters, the risk layer and the camera. */
export function AskMap({ cityId, areas, houses, state, onAction }: { cityId: string; areas: Area[]; houses: House[]; state: AskMapState; onAction: (a: MapAction) => void }) {
  const suggestions = cityId === "newcastle" ? ["5 bed houses in Jesmond", "Show me Heaton under £130 a week", "Show houses in Sandyford"] : SUGGESTIONS;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy, open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const send = async (text: string) => {
    const q = text.trim(); if (!q || busy) return;
    const history = [...msgs.filter((m) => !m.error), { role: "user" as const, text: q }];
    setMsgs((m) => [...m, { role: "user", text: q }]); setDraft(""); setBusy(true);
    try {
      const r = await askMap({ data: { cityId, state, messages: history.slice(-24).map(({ role, text }) => ({ role, text })) } });
      if (r.ok) { onAction(r.action); setMsgs((m) => [...m, { role: "assistant", text: r.reply, applied: describe(r.action, state, areas, houses) }]); }
      else setMsgs((m) => [...m, { role: "assistant", error: true, text: r.reason === "no-key" ? "The assistant isn't set up yet (no Gemini key). You can still use the filters above the map." : `I couldn't answer that just now (${r.message}). Try again, or use the filters above the map.` }]);
    } catch (e) {
      console.warn("Ask-the-map request failed", e);
      setMsgs((m) => [...m, { role: "assistant", error: true, text: "I couldn't reach the assistant — check your connection and try again." }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="absolute bottom-3 left-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
      {open && (
        <section aria-label="Ask the map" className="glass flex h-[26rem] max-h-[60vh] w-80 max-w-full flex-col overflow-hidden bg-popover/95 shadow-xl">
          <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" /> Ask the map</div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </header>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "border border-warning/50 bg-warning/10" : "bg-muted"}`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {!!m.applied?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {m.applied.map((a) => <span key={a} className="rounded-full border border-primary/50 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{a}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><div className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground" role="status">Thinking…</div></div>}
            {msgs.length === 1 && !busy && (
              <div className="flex flex-col items-start gap-1 pt-1">
                {suggestions.map((s) => <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-border px-2.5 py-1 text-left text-[11px] text-muted-foreground transition hover:border-primary hover:text-foreground">{s}</button>)}
              </div>
            )}
            <div ref={end} />
          </div>
          <form className="flex items-center gap-2 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); void send(draft); }}>
            <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="e.g. quiet 4-bed under £150" aria-label="Message the map assistant"
              className="min-w-0 flex-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary" />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-40"><Send className="size-3.5" /></button>
          </form>
          <p className="px-3 pb-2 text-[10px] text-muted-foreground">Messages go to Google Gemini. Answers use this city's listed properties.</p>
        </section>
      )}
      <button type="button" aria-expanded={open} aria-label={open ? "Hide map assistant" : "Ask the map"} onClick={() => setOpen((o) => !o)}
        className="glow flex items-center gap-2 rounded-full bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110">
        <MessageCircle className="size-4" /> {!open && <span>Ask the map</span>}
      </button>
    </div>
  );
}
