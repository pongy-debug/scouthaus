import { toast } from "sonner";
import { ArrowDown, Copy, Download, LoaderCircle, RefreshCw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Flag } from "@/lib/hh/scanner";
import { NOT_STATED, SUMMARY_DISCLAIMER, blocksToText, clauseRefs, summaryBlocks, termRows, watchOutLine, type ContractSummary, type SummaryItem } from "@/lib/hh/summary";

export type SummaryState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ContractSummary };

/**
 * Plain-English summary written by Gemini from the redacted contract; real names were put back in the browser before
 * it reaches this component. `canOpen` says whether a clause reference can be found in the contract text.
 */
export function SummaryPanel({ state, flags, title, canOpen, onClause, onFlag, onRegenerate }: {
  state: SummaryState; flags: Flag[]; title: string;
  canOpen: (ref: string) => boolean; onClause: (ref: string) => void; onFlag: (id: string) => void; onRegenerate: () => void;
}) {
  const Refs = ({ clause }: { clause: string }) => {
    const refs = clauseRefs(clause);
    if (!refs.length) return <span className="text-xs text-muted-foreground">No clause number</span>;
    return <span className="inline-flex flex-wrap gap-x-2">{refs.map((r) => canOpen(r)
      ? <button key={r} type="button" onClick={() => onClause(r)} title="Show this clause in the contract" className="font-mono text-xs text-primary underline-offset-2 hover:underline">Clause {r}</button>
      : <span key={r} className="font-mono text-xs text-muted-foreground">Clause {r}</span>)}</span>;
  };
  const List = ({ items, extra }: { items: SummaryItem[]; extra?: (i: number) => string }) => items.length === 0
    ? <p className="text-sm text-muted-foreground">{NOT_STATED}</p>
    : <ul className="space-y-2 text-sm leading-relaxed">{items.map((it, i) => <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span aria-hidden="true" className="text-primary">•</span><span className="min-w-0 flex-1">{it.text}{extra?.(i) ? <strong className="ml-1 font-semibold">{extra(i)}</strong> : null}</span><Refs clause={it.clause} /></li>)}</ul>;

  const data = state.status === "ready" ? state.data : null;
  const text = () => blocksToText(summaryBlocks(data!, flags, title));
  const download = async () => {
    const { textPdf } = await import("@/lib/hh/pdfWrite"); // built on this device; nothing is uploaded
    const url = URL.createObjectURL(new Blob([textPdf(summaryBlocks(data!, flags, title)) as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url; a.download = "contract-summary.pdf"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="glass space-y-6 p-6 sm:p-8" aria-labelledby="contract-summary-heading">
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText className="size-5 text-primary" /><h3 id="contract-summary-heading" className="text-lg font-semibold">Contract summary</h3>
        <Button variant="ghost" size="sm" className="ml-auto" disabled={state.status === "loading"} onClick={onRegenerate}><RefreshCw /> Regenerate</Button>
      </div>

      {state.status === "loading" && <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" /> Writing your contract summary…</div>}
      {state.status === "error" && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold">The summary could not be written</p>
          <p className="mt-1 text-muted-foreground">{state.message}. Your contract check below is not affected.</p>
          <Button size="sm" className="mt-3" onClick={onRegenerate}>Try again</Button>
        </div>
      )}

      {data && (
        <>
          <p className="text-sm leading-relaxed">{data.overview}</p>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Key terms</h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sr-only"><tr><th>Term</th><th>What the contract says</th><th>Clause</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {termRows(data).map((r) => (
                    <tr key={r.key} className="align-baseline">
                      <th scope="row" className="w-2/5 px-3 py-2 font-medium text-muted-foreground">{r.label}</th>
                      <td className={`px-3 py-2 ${r.value ? "" : "text-muted-foreground"}`}>{r.value || NOT_STATED}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{r.value ? <Refs clause={r.clause} /> : <span className="text-xs text-muted-foreground" aria-hidden="true">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2"><h4 className="text-sm font-semibold">What you are agreeing to do</h4><List items={data.tenantMust} /></div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">What the landlord must do</h4><List items={data.landlordMust} /></div>
          <div className="space-y-2"><h4 className="text-sm font-semibold">Fees and charges</h4><List items={data.fees} extra={(i) => data.fees[i]?.amount ?? ""} /></div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Watch out</h4>
            {flags.length === 0 ? <p className="text-sm text-muted-foreground">No red-flag clauses were identified in this check.</p> : (
              <ul className="space-y-2 text-sm leading-relaxed">
                {flags.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span aria-hidden="true" className={f.severity === "red" ? "text-destructive" : "text-warning"}>•</span>
                    <span className="min-w-0 flex-1">{watchOutLine(f)}</span>
                    <Refs clause={f.clause} />
                    <button type="button" onClick={() => onFlag(f.id)} aria-label={`Full entry for clause ${f.clause}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline">Full entry <ArrowDown className="size-3" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-5">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={async () => { await navigator.clipboard.writeText(text()); toast.success("Summary copied to clipboard"); }}><Copy /> Copy summary</Button>
              <Button variant="secondary" size="sm" onClick={() => void download()}><Download /> Download as PDF</Button>
            </div>
            <p className="text-xs text-muted-foreground">{SUMMARY_DISCLAIMER}</p>
          </div>
        </>
      )}
    </section>
  );
}
