import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HouseTimingCard } from "./HouseTimingCard";
import { evaluationFor } from "@/lib/hh/timing";
import type { TimingAssessment } from "@/lib/hh/timingAgent";

const saved = new Map<string, { until: number; data: TimingAssessment }>();
export function HouseTimingAssessment({ propertyId }: { propertyId: string }) {
  const [result, setResult] = useState<TimingAssessment | null>(() => {
    const cached = saved.get(propertyId); return cached && cached.until > Date.now() ? cached.data : null;
  });
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const research = async () => {
    if (busy) return;
    setBusy(true);
    let next: TimingAssessment;
    try {
      const { assessHouseTiming } = await import("@/lib/hh/timingAgent");
      next = await assessHouseTiming({ data: { propertyId } });
    } catch { next = { ok: false, message: "Could not reach the research service. Try again." }; }
    if (next.ok) { if (saved.size >= 100) saved.delete(saved.keys().next().value!); saved.set(propertyId, { until: Date.now() + 30 * 60_000, data: next }); }
    if (active.current) { setResult(next); setBusy(false); }
  };
  return <div className="space-y-2">
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void research()} className="w-full">{busy ? "Searching the web…" : result?.ok ? "Check again" : "Check timing with Gemini"}</Button>
    {busy && <p role="status" className="px-2 text-xs text-muted-foreground">Searching current sources and calculating the comparison. This may take up to two minutes; you can keep browsing.</p>}
    {result && !result.ok && <p role="alert" className="px-2 text-xs text-destructive">{result.message}</p>}
    {result?.ok && <p className="px-2 text-[11px] text-muted-foreground">AI web assessment · {new Date(result.checkedAt).toLocaleString("en-GB")} · Sources supplied by Google Search; figures are not independently verified. Results cached for 30 minutes.</p>}
    <HouseTimingCard house={result?.ok ? result.house : evaluationFor(propertyId)} aiSourced={result?.ok === true} />
    {result?.ok && <details className="px-2 text-xs"><summary className="cursor-pointer">Web research sources</summary><ul className="mt-2 space-y-1">{result.sources.map((source, i) => <li key={`${source.url}-${i}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline">{source.title}</a></li>)}</ul>
    </details>}
    {result?.ok && result.searchHtml && <iframe title="Google Search suggestions" srcDoc={result.searchHtml} sandbox="allow-popups allow-popups-to-escape-sandbox" className="mt-2 h-40 w-full border-0" />}
  </div>;
}
