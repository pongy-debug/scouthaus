import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileUp, Mail, Copy, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SAMPLES, type SampleKey } from "@/lib/hh/samples";
import { scan, buildEmail, splitClauses, type ScanResult, type Flag } from "@/lib/hh/scanner";

export function ContractScanner() {
  const [text, setText] = useState("");
  const [sample, setSample] = useState<SampleKey>("predatory");
  const [address, setAddress] = useState("the property");
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const request = useRef(0);
  const busy = useRef(false);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const [result, setResult] = useState<ScanResult | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearResult = () => {
    setResult(null);
    setOpen(null);
    setEmail(null);
  };
  const run = () => {
    if (busy.current) return;
    if (!text.trim()) {
      toast.error("Paste a contract or load a sample first");
      return;
    }
    const next = scan(text);
    if (!next.clauses) {
      toast.error("No readable clauses found");
      return;
    }
    setResult(next);
    setOpen(next.flags[0]?.id ?? null);
    setEmail(null);
  };
  const loadSample = () => {
    if (busy.current) return;
    const s = SAMPLES[sample];
    setText(s.text);
    setAddress(s.address);
    clearResult();
  };
  const onFile = async (f: File) => {
    if (busy.current) return;
    if (!/\.(pdf|txt)$/i.test(f.name)) {
      toast.error("Choose a PDF or .txt file");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Choose a file smaller than 20 MB");
      return;
    }
    busy.current = true;
    const token = ++request.current;
    setReading(true);
    setProgress(0);
    clearResult();
    setText("");
    setAddress("the property");
    try {
      const t = /\.pdf$/i.test(f.name)
        ? await (
            await import("@/lib/hh/pdf")
          ).readPdfText(f, (value) => {
            if (token === request.current) setProgress(value);
          })
        : await f.text();
      if (token !== request.current) return;
      if (!t.trim())
        throw new Error(
          "No readable text found. Scanned images need OCR; paste the contract text instead.",
        );
      setText(t);
      toast.success("Text loaded. Review it below, then analyse the contract.");
    } catch (error) {
      if (token === request.current)
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not read this file. Try pasting its text.",
        );
    } finally {
      busy.current = false;
      if (token === request.current) {
        setReading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
  };
  const clauseCount = splitClauses(text).length;
  const risk = result
    ? result.score >= 60
      ? "text-destructive"
      : result.score >= 30
        ? "text-warning"
        : "text-primary"
    : "";

  return (
    <div className="glass flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Local rule-based review · files stay in your browser
        </div>
        <h2 className="text-lg font-bold">Tenancy Contract Red-Flag Scanner</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(SAMPLES) as SampleKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSample(k)}
            className={`rounded-full border px-3 py-1 text-xs transition ${sample === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {SAMPLES[k].name}
          </button>
        ))}
      </div>
      <Button disabled={reading} onClick={loadSample} className="glow font-semibold">
        <ScanLine /> Load sample contract
      </Button>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`rounded-lg border border-dashed p-2 transition ${drag ? "border-primary bg-primary/10" : "border-border"}`}
      >
        <p className="mb-1 text-xs text-muted-foreground">
          1. Upload or paste · 2. Review and edit the extracted text · 3. Analyse
        </p>
        <Textarea
          aria-label="Contract text to review"
          disabled={reading}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setAddress("the property");
            clearResult();
          }}
          placeholder="Paste tenancy clauses here, or drop a .txt / .pdf contract…"
          className="h-24 resize-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            disabled={reading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <FileUp className="size-3.5" /> Upload file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.pdf,text/plain,application/pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button size="sm" variant="secondary" disabled={reading || !text.trim()} onClick={run}>
            Analyse contract
          </Button>
        </div>
      </div>

      {reading && (
        <div className="space-y-1">
          <div className="font-mono text-[11px] text-primary">
            Reading file… {Math.round(progress)}%
          </div>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            <div className="animate-scanline absolute inset-y-0 w-1/4 bg-foreground/30" />
          </div>
        </div>
      )}

      {!reading && (
        <p className="text-[11px] text-muted-foreground">
          {clauseCount} text sections ready. Automated checks can miss issues; results are not a
          legal determination.
        </p>
      )}

      {result && (
        <div className="flex shrink-0 flex-col gap-3">
          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className={`font-mono text-xl font-bold ${risk}`}>
              Indicative risk: {result.score}/100
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {result.flags.length} potential issues in {result.clauses} sections • £
              {result.illegalFees} in flagged charges
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background/40 p-3 text-xs">
            <h3 className="mb-2 font-semibold">Key contract information — source excerpts</h3>
            <dl className="space-y-2">
              {result.summary.map((detail) => (
                <div key={detail.label}>
                  <dt className="font-semibold">{detail.label}</dt>
                  <dd className="text-muted-foreground">
                    {detail.text
                      ? `${detail.clause}: ${detail.text}`
                      : "Not found in supplied text — ask the landlord to confirm."}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {result.flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No issues matched the current rules. This does not establish that the contract is fair
              or legally compliant.
            </p>
          ) : (
            <>
              <div className="space-y-2 pr-1">
                {result.flags.map((f) => (
                  <FlagCard
                    key={f.id}
                    f={f}
                    open={open === f.id}
                    toggle={() => setOpen(open === f.id ? null : f.id)}
                    onEmail={() => setEmail(buildEmail([f], address))}
                  />
                ))}
              </div>
            </>
          )}
          <Button
            variant="outline"
            onClick={() =>
              setEmail(
                buildEmail(
                  result.flags,
                  address,
                  result.summary.filter((detail) => !detail.text).map((detail) => detail.label),
                ),
              )
            }
          >
            <Mail /> Draft landlord email
          </Button>
        </div>
      )}

      <Dialog open={!!email} onOpenChange={(o) => !o && setEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Negotiation email</DialogTitle>
          </DialogHeader>
          <Textarea
            value={email ?? ""}
            onChange={(e) => setEmail(e.target.value)}
            className="h-80 font-mono text-xs"
          />
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(email ?? "");
                toast.success("Email copied to clipboard");
              } catch {
                toast.error("Could not copy. Select and copy the email text manually.");
              }
            }}
          >
            <Copy /> Copy Email
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagCard({
  f,
  open,
  toggle,
  onEmail,
}: {
  f: Flag;
  open: boolean;
  toggle: () => void;
  onEmail: () => void;
}) {
  const red = f.severity === "red";
  return (
    <div
      className={`rounded-lg border bg-background/40 ${red ? "border-destructive/50" : "border-warning/50"}`}
    >
      <button onClick={toggle} className="flex w-full items-center gap-2 p-3 text-left">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${red ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground"}`}
        >
          {f.label} — REVIEW
        </span>
        <span className="font-mono text-xs">Clause {f.clause}</span>
        <ChevronDown className={`ml-auto size-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-sm">
          <p className="italic text-muted-foreground">"{f.text}"</p>
          <p className="font-mono text-xs text-primary">Statute: {f.statute}</p>
          <p className="text-xs">{f.explain}</p>
          <p className="text-xs">
            <span className="font-semibold">Ask the landlord: </span>Could you {f.ask}?
          </p>
          <Button size="sm" variant="secondary" onClick={onEmail}>
            <Mail /> Draft email for this clause
          </Button>
        </div>
      )}
    </div>
  );
}
