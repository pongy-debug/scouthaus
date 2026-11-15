import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileUp, Mail, FileSearch, FileText, LoaderCircle, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scan, type ScanResult, type Flag } from "@/lib/hh/scanner";
import { analyseContract, summariseContract, type AiScan, type AiSummary } from "@/lib/hh/gemini";
import { addManualRedaction, applyRedactions, countByKind, detectRedactions, findLeaks, restoreText, type Redaction } from "@/lib/hh/redact";
import { SAMPLES } from "@/lib/hh/samples";
import { contractLines, findClauseLine, mapSummary, riskLevel } from "@/lib/hh/summary";
import { PrivacyCheck, RedactionList } from "@/components/hh/PrivacyCheck";
import { SummaryPanel, type SummaryState } from "@/components/hh/SummaryPanel";
import { EmailDrafter } from "@/components/hh/EmailDrafter";

// PDFs and photos are read locally (pdf.js text layer, OCR for scanned pages); the reader is loaded on first use.
async function readFile(file: File, progress: (m: string) => void) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return (await import("@/lib/hh/pdf")).readPdf(file, progress);
  if (file.type.startsWith("image/")) return (await import("@/lib/hh/pdf")).readImage(file, progress);
  return file.text();
}

type Source = { by: "gemini" } | { by: "local"; why?: string };
/** A contract held in browser memory: the original text and the list of personal details found in it. */
interface Loaded { name: string; text: string; items: Redaction[] }

/** Real values go back into the AI's answer here, in the browser, so the review reads naturally. */
function restoreResult(r: ScanResult, items: Redaction[]): ScanResult {
  const fix = (s: string) => restoreText(s, items);
  return { ...r, ...(r.scoreReason ? { scoreReason: fix(r.scoreReason) } : {}), flags: r.flags.map((f) => ({ ...f, clause: fix(f.clause), text: fix(f.text), explain: fix(f.explain), ask: fix(f.ask), statute: fix(f.statute) })) };
}

export function ContractScanner() {
  const [text, setText] = useState("");
  // The original contract and the value → placeholder map live only in this component's state: they are dropped
  // when the visitor leaves the page or chooses "Clear contract", and are never sent, stored or logged.
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [sent, setSent] = useState<Redaction[] | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [address, setAddress] = useState("the property");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [emailFlags, setEmailFlags] = useState<Flag[] | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [jump, setJump] = useState<{ line: number; n: number } | null>(null);
  const summaryRun = useRef(0);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clear = () => {
    setDoc(null); setSent(null); summaryRun.current++; setResult(null); setSource(null); setSummary(null); setEmailFlags(null); setEmailOpen(false); setTextOpen(false); setJump(null); setOpen(null); setText(""); setAddress("the property"); setPrivacyOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Step 1 — read the contract on this device and find personal details. Nothing is sent anywhere yet.
  const load = async (input: { text: string; name: string } | { file: File }) => {
    if (reading) return;
    summaryRun.current++; setResult(null); setSource(null); setSummary(null); setEmailFlags(null); setSent(null); setDoc(null);
    let t = "text" in input ? input.text : "";
    if ("file" in input) {
      setReading(`Reading ${input.file.name} on your device…`);
      try { t = await readFile(input.file, setReading); }
      catch { console.warn("Contract file could not be read"); }
      finally { setReading(null); if (fileRef.current) fileRef.current.value = ""; }
    }
    if (!t.trim()) { toast.error("file" in input ? "Couldn't read text from that file — is it password-protected or blank? Try pasting the clauses instead" : "Paste your contract or upload a file first"); return; }
    setDoc({ name: "file" in input ? input.file.name : input.name, text: t, items: detectRedactions(t) });
  };
  const toggleItem = (id: string) => setDoc((d) => d && { ...d, items: d.items.map((it) => (it.id === id ? { ...it, enabled: !it.enabled } : it)) });
  const redactSelection = (selection: string) => {
    if (!doc) return false;
    const items = addManualRedaction(doc.text, doc.items, selection);
    if (items) setDoc({ ...doc, items });
    return !!items;
  };

  // The plain-English summary is a second Gemini request on the same redacted text; real values go back in here.
  const summarise = async (redacted: string, items: Redaction[]) => {
    const id = ++summaryRun.current;
    setSummary({ status: "loading" });
    let r: AiSummary;
    try { r = await summariseContract({ data: { text: redacted } }); }
    catch { r = { ok: false, reason: "failed", message: "Gemini could not be reached" }; }
    if (id !== summaryRun.current) return;
    setSummary(r.ok ? { status: "ready", data: mapSummary(r.summary, (s) => restoreText(s, items)) }
      : { status: "error", message: r.reason === "no-key" ? "AI summaries are not set up on this site yet (no Gemini key)" : r.message });
  };
  const regenerate = () => {
    if (!doc || !sent) return;
    const { redacted } = applyRedactions(doc.text, sent);
    if (findLeaks(redacted, sent).length) { toast.error("Redaction check failed, so nothing was sent."); return; }
    void summarise(redacted, sent);
  };

  // Step 2 — send ONLY the redacted text to Gemini; if it is unavailable the local rules check the contract on this device.
  const analyse = async () => {
    if (reading || !doc) return;
    const items = doc.items;
    const { redacted } = applyRedactions(doc.text, items);
    if (findLeaks(redacted, items).length) { toast.error("Redaction check failed, so nothing was sent. Please clear the contract and try again."); return; }
    setResult(null); setSource(null); setEmailFlags(null);
    void summarise(redacted, items);
    setReading("Gemini is analysing the redacted contract… this can take up to a minute");
    let ai: AiScan;
    try { ai = await analyseContract({ data: { text: redacted } }); }
    catch { console.warn("Gemini request failed"); ai = { ok: false, reason: "failed", message: "Could not reach Gemini" }; }
    setReading(null); setSent(items);
    const property = items.find((it) => it.enabled && it.placeholder === "[PROPERTY_ADDRESS]")?.value;
    if (ai.ok) {
      const restored = restoreResult(ai.result, items);
      setAddress(restoreText(ai.address, items) || property || "the property"); setSource({ by: "gemini" });
      setResult(restored); setOpen(restored.flags[0]?.id ?? null);
      return;
    }
    const why = ai.reason === "no-key" ? "Gemini key not configured" : ai.message;
    setSource({ by: "local", why }); setAddress(property || "the property");
    const localResult = scan(doc.text); setResult(localResult); setOpen(localResult.flags[0]?.id ?? null);
  };
  // The email is written by Gemini from redacted flags (see EmailDrafter); a new set of flags starts a new draft.
  const draft = (flags: Flag[]) => { if (flags.map((f) => f.id).join() !== emailFlags?.map((f) => f.id).join()) setEmailFlags(flags); setEmailOpen(true); };
  // Clause numbers in the summary point into the contract text shown at the bottom of the review.
  const lines = useMemo(() => contractLines(doc?.text ?? ""), [doc]);
  const goToClause = (ref: string) => { const line = findClauseLine(lines, ref); if (line >= 0) { setTextOpen(true); setJump((j) => ({ line, n: (j?.n ?? 0) + 1 })); } };
  const goToFlag = (id: string) => { setOpen(id); requestAnimationFrame(() => document.getElementById(`flag-${id}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })); };
  useEffect(() => { if (jump && textOpen) document.getElementById(`contract-line-${jump.line}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" }); }, [jump, textOpen]);
  const removed = sent ? countByKind(sent).total : 0;
  const onFile = (f: File) => void load({ file: f });
  const risk = result ? (result.score >= 60 ? "text-destructive" : result.score >= 30 ? "text-warning" : "text-primary") : "";

  return (
    <div className="space-y-8 py-6 sm:py-10">
      <header className="max-w-2xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><ShieldCheck className="size-4" /> Before you sign</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contract Check</h1>
        <p className="text-base leading-relaxed text-muted-foreground">Understand your tenancy agreement. Check for unfair terms, unexpected fees and things to ask your landlord to change.</p>
      </header>

      <section className="glass overflow-hidden" aria-label="Check your contract">
        <div className="grid md:grid-cols-2">
          <div className={`flex flex-col items-center justify-center gap-4 border-b border-border p-6 text-center transition md:border-b-0 md:border-r sm:p-8 ${drag ? "bg-primary/15" : "bg-primary/5"}`}
            onDragOver={(e) => { e.preventDefault(); if (!reading) setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f && !reading) onFile(f); }}>
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-primary"><FileUp className="size-8" /></div>
            <div><h2 className="text-lg font-semibold">Upload your contract</h2><p className="mt-2 text-sm text-muted-foreground">Drag a file here or choose one from your device.</p></div>
            <Button disabled={!!reading} onClick={() => fileRef.current?.click()} className="w-full max-w-xs"><FileUp /> Choose a file</Button>
            <p className="text-xs text-muted-foreground">PDF, photo or text file · read on your device<br />You review what is removed before anything is sent.</p>
            <Button variant="link" size="sm" disabled={!!reading} onClick={() => void load({ text: SAMPLES.predatory.text, name: SAMPLES.predatory.name })}>Try sample contract</Button>
            <input ref={fileRef} type="file" accept=".txt,.pdf,text/plain,application/pdf,image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          <div className="flex flex-col gap-4 p-6 sm:p-8">
            <div><label htmlFor="contract-text" className="text-lg font-semibold">Or paste your contract</label><p className="mt-2 text-sm text-muted-foreground">Use the full agreement for a more complete review.</p></div>
            <Textarea id="contract-text" value={text} disabled={!!reading} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of your tenancy agreement here…" className="min-h-40 flex-1 resize-y bg-background/50 text-sm leading-relaxed" />
            <Button variant="secondary" disabled={!!reading || !text.trim()} onClick={() => void load({ text, name: "Pasted contract" })}>Check my contract <ArrowRight /></Button>
          </div>
        </div>
        <p className="border-t border-border px-6 py-4 text-xs leading-relaxed text-muted-foreground">Privacy: your contract is read and redacted in your browser. Names, contact details, addresses and ID numbers are replaced with placeholders, and only that redacted text is processed by Google Gemini, which also writes the summary and the draft email. If AI is unavailable, a basic check runs on your device.</p>
      </section>

      {doc && !result && !reading && <PrivacyCheck text={doc.text} items={doc.items} busy={!!reading} onToggle={toggleItem} onRedact={redactSelection} onAnalyse={() => void analyse()} onClear={clear} />}

      {reading && <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm" role="status"><LoaderCircle className="size-5 shrink-0 animate-spin text-primary" /><div><p className="font-semibold">Reviewing your contract</p><p className="mt-1 text-muted-foreground">{reading}</p></div></div>}
      {!result && !reading && !doc && <section className="grid gap-5 sm:grid-cols-3" aria-label="What you will get">
        {[['01', 'Understand the risk', 'A score showing how risky or unfair the agreement may be.'], ['02', 'See what needs attention', 'Clear explanations of the terms and fees worth reviewing.'], ['03', 'Know what to ask', 'A plain-English summary and an AI-drafted email you can edit.']].map(([step, title, description]) => <div key={step} className="rounded-xl border border-border bg-card/40 p-5"><span className="font-mono text-xs text-primary">{step}</span><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>)}
      </section>}

      {result && (
        <section className="space-y-5" aria-label="Your contract review">
          <div className="flex flex-wrap items-center gap-2"><FileSearch className="size-5 text-primary" /><h2 className="text-xl font-semibold">Your contract review</h2>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={clear}>Clear contract</Button></div>
          {sent && (
            <button type="button" onClick={() => setPrivacyOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              <Lock className="size-3.5" /> Privacy · {removed === 0 ? "No personal details were found to redact before AI analysis" : `${removed} personal detail${removed === 1 ? " was" : "s were"} redacted before AI analysis`}{source?.by === "local" ? " (AI was unavailable)" : ""}
            </button>
          )}
          {summary && <SummaryPanel state={summary} flags={result.flags} title={address} canOpen={(r) => findClauseLine(lines, r) >= 0} onClause={goToClause} onFlag={goToFlag} onRegenerate={regenerate} />}
          <div className="glass p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div><p className="text-sm text-muted-foreground">Risk level</p><p className={`mt-1 text-2xl font-semibold ${risk}`}>{riskLevel(result.score)}</p></div>
              <div className={risk}><span className="text-5xl font-bold tracking-tight">{result.score}</span><span className="ml-1 text-lg text-muted-foreground">/ 100</span></div>
            </div>
            <div className="my-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={`h-full rounded-full ${result.score >= 60 ? "bg-destructive" : result.score >= 30 ? "bg-warning" : "bg-primary"}`} style={{ width: `${result.score}%` }} /></div>
            <p className="text-xs text-muted-foreground">Higher scores mean more risk or unfairness.</p>
            {result.scoreReason && <p className="mt-4 text-sm leading-relaxed">{result.scoreReason}</p>}
            {source && <p className="mt-3 text-xs text-muted-foreground">{source.by === "gemini" ? "Reviewed with Gemini AI" : "Basic on-device check · AI review unavailable"}</p>}
            <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
              <div><p className="text-2xl font-semibold">{result.flags.length}</p><p className="text-sm text-muted-foreground">Issues to review</p></div>
              <div><p className="text-2xl font-semibold">£{result.illegalFees}</p><p className="text-sm text-muted-foreground">Potentially unlawful fees</p></div>
              <div><p className="text-2xl font-semibold">{result.unenforceable}</p><p className="text-sm text-muted-foreground">Terms that may not be enforceable</p></div>
            </div>
          </div>
          {result.flags.length === 0 ? <p className="text-sm text-muted-foreground">No issues identified in this check. Read the full agreement carefully before signing.</p> : (
            <>
              <div className="space-y-3">
                {result.flags.map((f) => <FlagCard key={f.id} f={f} open={open === f.id} toggle={() => setOpen(open === f.id ? null : f.id)} onEmail={() => draft([f])} />)}
              </div>
              <Button variant="outline" onClick={() => draft(result.flags)}><Mail /> Draft email to landlord/agent</Button>
            </>
          )}
          {doc && (
            <div className="rounded-lg border border-border bg-background/40" id="contract-text-view">
              <button type="button" onClick={() => setTextOpen(!textOpen)} aria-expanded={textOpen} className="flex w-full items-center gap-3 p-4 text-left text-sm font-semibold">
                <FileText className="size-4 text-primary" /> Contract text <span className="font-normal text-muted-foreground">· shown from this device only</span>
                <ChevronDown className={`ml-auto size-4 transition ${textOpen ? "rotate-180" : ""}`} />
              </button>
              {textOpen && (
                <div className="max-h-[28rem] space-y-1 overflow-auto border-t border-border p-4 font-mono text-xs leading-relaxed" aria-label="Contract text" role="region">
                  {lines.map((l, i) => <p key={i} id={`contract-line-${i}`} data-clause={l.num} aria-current={jump?.line === i ? "location" : undefined} className={`rounded px-1.5 py-0.5 ${jump?.line === i ? "bg-primary/20 text-foreground ring-1 ring-primary/40" : ""}`}>{l.text}</p>)}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Redacted before AI analysis</DialogTitle><DialogDescription>These details were replaced with placeholders before the contract was sent. The real values are shown only on this device and were put back into your review locally.</DialogDescription></DialogHeader>
          <RedactionList items={(sent ?? []).filter((it) => it.enabled)} />
        </DialogContent>
      </Dialog>

      {result && sent && emailFlags && <EmailDrafter key={emailFlags.map((f) => f.id).join()} open={emailOpen} onOpenChange={setEmailOpen} flags={emailFlags} risk={riskLevel(result.score)} address={address} items={sent} />}
    </div>
  );
}

function FlagCard({ f, open, toggle, onEmail }: { f: Flag; open: boolean; toggle: () => void; onEmail: () => void }) {
  const red = f.severity === "red";
  return (
    <div id={`flag-${f.id}`} className={`scroll-mt-24 rounded-lg border bg-background/40 ${red ? "border-destructive/50" : "border-warning/50"}`}>
      <button onClick={toggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
        <span className={`rounded px-2 py-1 text-xs font-semibold ${red ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>{red ? "High concern" : "Worth reviewing"}</span>
        <span className="text-sm font-semibold normal-case">{f.label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}<span className="ml-2 font-normal text-muted-foreground">Clause {f.clause}</span></span>
        <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4 text-sm leading-relaxed">
          <p className="italic text-muted-foreground">"{f.text}"</p>
          <p className="font-mono text-xs text-primary">Relevant law: {f.statute}</p>
          <p className="text-xs">{f.explain}</p>
          <Button size="sm" variant="secondary" onClick={onEmail}><Mail /> Draft an email about this issue</Button>
        </div>
      )}
    </div>
  );
}
