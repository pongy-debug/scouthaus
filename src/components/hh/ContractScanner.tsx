import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileUp, Mail, Copy, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SAMPLES, type SampleKey } from "@/lib/hh/samples";
import { scan, buildEmail, splitClauses, type ScanResult, type Flag } from "@/lib/hh/scanner";

async function readPdfText(file: File) {
  // Lightweight local PDF text pull: reads uncompressed text operators. Scanned/compressed PDFs may return little.
  const raw = new TextDecoder("latin1").decode(await file.arrayBuffer());
  const parts = [...raw.matchAll(/\(([^()]{3,})\)\s*Tj/g)].map((m) => m[1]);
  return parts.join("\n");
}

export function ContractScanner() {
  const [text, setText] = useState("");
  const [sample, setSample] = useState<SampleKey>("predatory");
  const [address, setAddress] = useState("the property");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (t: string, addr = address) => {
    if (!t.trim()) { toast.error("Paste a contract or load a sample first"); return; }
    setResult(null); setProgress(0); setAddress(addr);
    let p = 0;
    const id = setInterval(() => {
      p += 7 + Math.random() * 9;
      if (p >= 100) { clearInterval(id); setProgress(null); const r = scan(t); setResult(r); setOpen(r.flags[0]?.id ?? null); }
      else setProgress(p);
    }, 90);
  };
  const loadSample = () => { const s = SAMPLES[sample]; setText(s.text); run(s.text, s.address); };
  const onFile = async (f: File) => {
    const t = f.name.toLowerCase().endsWith(".pdf") ? await readPdfText(f) : await f.text();
    if (!t.trim()) { toast.error("Couldn't read text from that file — try pasting the clauses instead"); return; }
    setText(t); run(t, "the property");
  };
  const clauseCount = splitClauses(text).length;
  const risk = result ? (result.score >= 60 ? "text-destructive" : result.score >= 30 ? "text-warning" : "text-primary") : "";

  return (
    <div className="glass flex h-full flex-col gap-3 overflow-hidden p-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Local AI · runs in your browser</div>
        <h2 className="text-lg font-bold">Tenancy Contract Red-Flag Scanner</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SAMPLES) as SampleKey[]).map((k) => (
          <button key={k} onClick={() => setSample(k)} className={`rounded-full border px-3 py-1 text-xs transition ${sample === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{SAMPLES[k].name}</button>
        ))}
      </div>
      <Button onClick={loadSample} className="glow font-semibold"><ScanLine /> Analyze Sample 30-Page Durham Student AST</Button>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
        className={`rounded-lg border border-dashed p-2 transition ${drag ? "border-primary bg-primary/10" : "border-border"}`}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste tenancy clauses here, or drop a .txt / .pdf contract…" className="h-24 resize-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0" />
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><FileUp className="size-3.5" /> Upload file</button>
          <input ref={fileRef} type="file" accept=".txt,.pdf,text/plain,application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <Button size="sm" variant="secondary" onClick={() => run(text)}>Scan text</Button>
        </div>
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <div className="font-mono text-[11px] text-primary">Scanning {clauseCount} clauses against UK Tenant Fees Act 2019 & Housing Act 1988...</div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            <div className="animate-scanline absolute inset-y-0 w-1/4 bg-foreground/30" />
          </div>
        </div>
      )}

      {result && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className={`font-mono text-xl font-bold ${risk}`}>Risk Score: {result.score}/100</div>
            <div className="font-mono text-xs text-muted-foreground">{result.unenforceable} Unenforceable Clauses • £{result.illegalFees} in Illegal Fees Detected • {result.flags.length} flags in {result.clauses} clauses</div>
          </div>
          {result.flags.length === 0 ? <p className="text-sm text-muted-foreground">No red flags found. This contract looks consistent with the statutes we check — still read it carefully.</p> : (
            <>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {result.flags.map((f) => <FlagCard key={f.id} f={f} open={open === f.id} toggle={() => setOpen(open === f.id ? null : f.id)} onEmail={() => setEmail(buildEmail([f], address))} />)}
              </div>
              <Button variant="outline" onClick={() => setEmail(buildEmail(result.flags, address))}><Mail /> Generate Full Combined Email</Button>
            </>
          )}
        </div>
      )}

      <Dialog open={!!email} onOpenChange={(o) => !o && setEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Negotiation email</DialogTitle></DialogHeader>
          <Textarea value={email ?? ""} onChange={(e) => setEmail(e.target.value)} className="h-80 font-mono text-xs" />
          <Button onClick={async () => { await navigator.clipboard.writeText(email ?? ""); toast.success("Email copied to clipboard"); }}><Copy /> Copy Email</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagCard({ f, open, toggle, onEmail }: { f: Flag; open: boolean; toggle: () => void; onEmail: () => void }) {
  const red = f.severity === "red";
  return (
    <div className={`rounded-lg border bg-background/40 ${red ? "border-destructive/50" : "border-warning/50"}`}>
      <button onClick={toggle} className="flex w-full items-center gap-2 p-3 text-left">
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${red ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}>{f.label} — {red ? "RED" : "AMBER"}</span>
        <span className="font-mono text-xs">Clause {f.clause}</span>
        <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-sm">
          <p className="italic text-muted-foreground">"{f.text}"</p>
          <p className="font-mono text-xs text-primary">Statute: {f.statute}</p>
          <p className="text-xs">{f.explain}</p>
          <Button size="sm" variant="secondary" onClick={onEmail}><Mail /> Draft email for this clause</Button>
        </div>
      )}
    </div>
  );
}
