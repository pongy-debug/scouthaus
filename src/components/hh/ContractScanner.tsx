import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileUp, Mail, Copy, FileSearch, LoaderCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scan, buildEmail, type ScanResult, type Flag } from "@/lib/hh/scanner";
import { analyseContract, type AiScan } from "@/lib/hh/gemini";

// PDFs and photos are read locally (pdf.js text layer, OCR for scanned pages); the reader is loaded on first use.
async function readFile(file: File, progress: (m: string) => void) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return (await import("@/lib/hh/pdf")).readPdf(file, progress);
  if (file.type.startsWith("image/")) return (await import("@/lib/hh/pdf")).readImage(file, progress);
  return file.text();
}

const isDoc = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf") || f.type.startsWith("image/");
const toBase64 = (f: File) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = () => fail(r.error);
  r.readAsDataURL(f);
});
const MAX_AI_FILE = 10 * 1024 * 1024;
type Source = { by: "gemini" } | { by: "local"; why?: string };

export function ContractScanner() {
  const [text, setText] = useState("");
  const [address, setAddress] = useState("the property");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Gemini reads and analyses the contract; if it is unavailable the local reader and rules take over.
  const analyse = async (input: { text: string } | { file: File }) => {
    if (reading) return;
    const file = "file" in input ? input.file : null;
    const pasted = "text" in input ? input.text : "";
    if (!file && !pasted.trim()) { toast.error("Paste your contract or upload a file first"); return; }
    setResult(null); setSource(null);
    let ai: AiScan;
    if (file && isDoc(file) && file.size > MAX_AI_FILE) ai = { ok: false, reason: "failed", message: "File is over 10 MB" };
    else {
      setReading(file ? `Gemini is reading ${file.name}… a long contract can take a minute or two` : "Gemini is analysing the contract… this can take up to a minute");
      try {
        const text = file ? (isDoc(file) ? undefined : await file.text()) : pasted;
        ai = await analyseContract({ data: file && isDoc(file) ? { file: { name: file.name, mime: file.type || "application/pdf", data: await toBase64(file) } } : { text: text ?? "" } });
      } catch (e) { console.warn("Gemini request failed", e); ai = { ok: false, reason: "failed", message: "Could not reach Gemini" }; }
    }
    if (ai.ok) {
      setReading(null); setAddress(ai.address || "the property"); setSource({ by: "gemini" });
      setResult(ai.result); setOpen(ai.result.flags[0]?.id ?? null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const why = ai.reason === "no-key" ? "Gemini key not configured" : ai.message;
    let t = file ? "" : pasted;
    if (file) {
      try { t = await readFile(file, setReading); }
      catch (e) { console.warn("Contract file could not be read", e); }
      finally { if (fileRef.current) fileRef.current.value = ""; }
    }
    setReading(null);
    if (!t.trim()) { toast.error("Couldn't read text from that file — is it password-protected or blank? Try pasting the clauses instead"); return; }
    setText(t); setSource({ by: "local", why }); setAddress("the property");
    const localResult = scan(t); setResult(localResult); setOpen(localResult.flags[0]?.id ?? null);
  };
  const onFile = (f: File) => void analyse({ file: f });
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
            <p className="text-xs text-muted-foreground">PDF, photo or text file · AI checks up to 10 MB<br />Your check starts as soon as you upload.</p>
            <input ref={fileRef} type="file" accept=".txt,.pdf,text/plain,application/pdf,image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          <div className="flex flex-col gap-4 p-6 sm:p-8">
            <div><label htmlFor="contract-text" className="text-lg font-semibold">Or paste your contract</label><p className="mt-2 text-sm text-muted-foreground">Use the full agreement for a more complete review.</p></div>
            <Textarea id="contract-text" value={text} disabled={!!reading} onChange={(e) => setText(e.target.value)} placeholder="Paste the text of your tenancy agreement here…" className="min-h-40 flex-1 resize-y bg-background/50 text-sm leading-relaxed" />
            <Button variant="secondary" disabled={!!reading || !text.trim()} onClick={() => void analyse({ text })}>Check my contract <ArrowRight /></Button>
          </div>
        </div>
        <p className="border-t border-border px-6 py-4 text-xs leading-relaxed text-muted-foreground">Files and pasted text are sent to Google Gemini for review. If AI is unavailable, a basic check runs on your device.</p>
      </section>

      {reading && <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm" role="status"><LoaderCircle className="size-5 shrink-0 animate-spin text-primary" /><div><p className="font-semibold">Reviewing your contract</p><p className="mt-1 text-muted-foreground">{reading}</p></div></div>}
      {!result && !reading && <section className="grid gap-5 sm:grid-cols-3" aria-label="What you will get">
        {[['01', 'Understand the risk', 'A score showing how risky or unfair the agreement may be.'], ['02', 'See what needs attention', 'Clear explanations of the terms and fees worth reviewing.'], ['03', 'Know what to ask', 'An editable email asking your landlord for changes.']].map(([step, title, description]) => <div key={step} className="rounded-xl border border-border bg-card/40 p-5"><span className="font-mono text-xs text-primary">{step}</span><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>)}
      </section>}

      {result && (
        <section className="space-y-5" aria-label="Your contract review">
          <div className="flex items-center gap-2"><FileSearch className="size-5 text-primary" /><h2 className="text-xl font-semibold">Your contract review</h2></div>
          <div className="glass p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div><p className="text-sm text-muted-foreground">Risk level</p><p className={`mt-1 text-2xl font-semibold ${risk}`}>{result.score >= 60 ? "High risk" : result.score >= 30 ? "Moderate risk" : "Low risk"}</p></div>
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
                {result.flags.map((f) => <FlagCard key={f.id} f={f} open={open === f.id} toggle={() => setOpen(open === f.id ? null : f.id)} onEmail={() => setEmail(buildEmail([f], address))} />)}
              </div>
              <Button variant="outline" onClick={() => setEmail(buildEmail(result.flags, address))}><Mail /> Draft an email about all issues</Button>
            </>
          )}
        </section>
      )}

      <Dialog open={!!email} onOpenChange={(o) => !o && setEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Email to your landlord</DialogTitle></DialogHeader>
          <Textarea value={email ?? ""} onChange={(e) => setEmail(e.target.value)} className="h-80 font-mono text-xs" />
          <Button onClick={async () => { await navigator.clipboard.writeText(email ?? ""); toast.success("Email copied to clipboard"); }}><Copy /> Copy email</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagCard({ f, open, toggle, onEmail }: { f: Flag; open: boolean; toggle: () => void; onEmail: () => void }) {
  const red = f.severity === "red";
  return (
    <div className={`rounded-lg border bg-background/40 ${red ? "border-destructive/50" : "border-warning/50"}`}>
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
