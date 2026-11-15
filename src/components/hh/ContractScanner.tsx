import { useEffect, useRef, useState, type ComponentType } from "react";
import { FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACT_FILE_ACCEPT, CONTRACT_FILE_HINT, contractFileError } from "@/lib/hh/upload";

type Input = { file: File } | { text: string; name: string } | { sample: true };
// No readers, redaction engine, sample data or AI client in this initial shell.
export function ContractScanner() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<{ Component: ComponentType<{ initialInput: Input }>; input: Input } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const begin = async (input: Input) => {
    if (loading) return;
    if ("file" in input) {
      const issue = contractFileError(input.file);
      if (issue) { setError(issue); if (file.current) file.current.value = ""; return; }
    }
    setLoading(true); setError("");
    try {
      const { ScannerSession } = await import("./ScannerSession");
      if (live.current) setSession({ Component: ScannerSession, input });
    } catch { if (live.current) setError("Could not load the reader. Please try again."); }
    finally { if (live.current) setLoading(false); }
  };
  if (session) return <session.Component initialInput={session.input} />;
  return <div className="space-y-8 py-6 sm:py-10">
    <header className="max-w-2xl space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><ShieldCheck className="size-4" /> Before you sign</div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contract Check</h1>
      <p className="text-base leading-relaxed text-muted-foreground">Understand your tenancy agreement. Check for unfair terms, unexpected fees and things to ask your landlord to change.</p>
    </header>
    <section className="glass grid overflow-hidden md:grid-cols-2" aria-label="Check your contract">
      <div className="flex flex-col items-center justify-center gap-4 border-b border-border bg-primary/5 p-6 text-center sm:p-8 md:border-b-0 md:border-r"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void begin({ file: f }); }}>
        <FileUp className="size-8 text-primary" />
        <h2 className="text-lg font-semibold">Upload your contract</h2>
        <p className="text-sm text-muted-foreground">Drag a file here or choose one from your device.</p>
        <Button disabled={loading} onClick={() => file.current?.click()}>Choose a file</Button>
        <input ref={file} type="file" accept={CONTRACT_FILE_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void begin({ file: f }); }} />
        <p className="text-xs text-muted-foreground">{CONTRACT_FILE_HINT}</p>
        <Button variant="link" disabled={loading} onClick={() => void begin({ sample: true })}>Try sample contract</Button>
        {loading && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> Loading contract reader...</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex flex-col gap-4 p-6 sm:p-8">
        <label htmlFor="contract-text" className="text-lg font-semibold">Or paste your contract</label>
        <Textarea id="contract-text" value={text} onChange={(e) => setText(e.target.value)} disabled={loading} placeholder="Paste the text of your tenancy agreement here..." className="min-h-40 flex-1" />
        <Button disabled={loading || !text.trim()} onClick={() => void begin({ text, name: "Pasted contract" })}>Check my contract</Button>
        <p className="text-xs text-muted-foreground">Files are read on your device. Review and redact personal details before sending text to Google Gemini. Samples run locally.</p>
      </div>
    </section>
  </div>;
}
