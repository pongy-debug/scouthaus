import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, LoaderCircle, Mail, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { draftEmail, reviseEmail, type AiEmail } from "@/lib/hh/gemini";
import { applyRedactions, extendRedactions, findLeaks, restoreText, type Redaction } from "@/lib/hh/redact";
import type { Flag } from "@/lib/hh/scanner";
import { TONES, diffText, mergeRevision, tokenize, type Change, type Tone } from "@/lib/hh/summary";

interface Version { subject: string; body: string; label: string }
const HISTORY = 8;
const failMessage = (r: Extract<AiEmail, { ok: false }>) => (r.reason === "no-key" ? "AI drafting is not set up on this site yet (no Gemini key)" : r.message);

/**
 * The email to the landlord or agent, written by Gemini. Everything sent is redacted here first (flagged clauses,
 * the current draft, the user's instruction); real names and addresses are swapped back in below, in the browser.
 * There is no template fallback: if Gemini fails, the error is shown with "Try again".
 */
export function EmailDrafter({ open, onOpenChange, flags, risk, address, items: contractItems }: {
  open: boolean; onOpenChange: (o: boolean) => void; flags: Flag[]; risk: "Low risk" | "Moderate risk" | "High risk"; address: string; items: Redaction[];
}) {
  // Value → placeholder map for this email: the contract's, plus anything new the user types. Browser memory only.
  const [items, setItems] = useState(contractItems);
  const [tone, setTone] = useState<Tone>("polite");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const run = useRef(0);

  const last = versions[versions.length - 1];
  const dirty = !!last && (last.subject !== subject || last.body !== body);
  /** Add the AI's version to the history, first saving any manual edits so Undo can return to them. */
  const commit = (v: Version) => {
    setVersions((vs) => [...vs, ...(dirty ? [{ subject, body, label: "Your edits" }] : []), v].slice(-HISTORY));
    setSubject(v.subject); setBody(v.body);
  };
  const send = async (what: string, request: () => Promise<AiEmail>, retry: () => void, done: (r: Extract<AiEmail, { ok: true }>) => void) => {
    const id = ++run.current;
    setBusy(what); setError(null);
    let r: AiEmail;
    try { r = await request(); } catch { r = { ok: false, reason: "failed", message: "Gemini could not be reached" }; }
    if (id !== run.current) return;
    setBusy(null);
    if (r.ok) done(r); else setError({ message: failMessage(r), retry });
  };
  const blocked = () => toast.error("Redaction check failed, so nothing was sent.");

  const draft = (t: Tone, fresh = false) => {
    const out = (s: string) => applyRedactions(s, items).redacted;
    const ph = (re: RegExp) => items.filter((it) => it.enabled && re.test(it.placeholder)).map((it) => it.placeholder);
    // Only this goes to Gemini: the flagged clauses, their legal reason and statute, the risk level, the tone, and placeholders.
    const data = {
      flags: flags.map((f) => ({ clause: out(f.clause), label: f.label, severity: f.severity, quote: out(f.text), statute: out(f.statute), explain: out(f.explain), ask: out(f.ask) })),
      risk, tone: t,
      parties: { tenants: ph(/^\[TENANT_\d+\]$/), recipients: ph(/^\[(?:LANDLORD|AGENT)_\d+\]$/), property: address === "the property" ? "" : out(address) },
    };
    if (findLeaks(JSON.stringify(data), items).length) { blocked(); return; }
    setChanges(null);
    void send("Gemini is drafting your email…", () => draftEmail({ data }), () => draft(t, fresh), (r) => {
      const v = { subject: restoreText(r.subject, items), body: restoreText(r.body, items), label: `${TONES.find(([k]) => k === t)![1]} draft` };
      if (fresh) { setVersions([v]); setSubject(v.subject); setBody(v.body); } else commit(v);
    });
  };

  const revise = () => {
    const ask = instruction.trim();
    if (!ask || !body.trim()) return;
    // The draft and the instruction may hold details typed since the contract was read: redact those too.
    const all = extendRedactions(`${subject}\n${body}\n${ask}`, items);
    const sentBody = applyRedactions(body, all), sentSubject = applyRedactions(subject, all).redacted;
    const data = { subject: sentSubject, body: sentBody.redacted, instruction: applyRedactions(ask, all).redacted };
    if (findLeaks(JSON.stringify(data), all).length) { blocked(); return; }
    setItems(all);
    const before = body;
    void send("Gemini is updating your email…", () => reviseEmail({ data }), revise, (r) => {
      const restore = (s: string) => restoreText(s, all);
      // Text the AI left alone is copied from the local draft, so manual edits and real names survive exactly.
      const tokens = sentBody.parts.flatMap((p) => (p.id ? [{ sent: p.sent, original: p.original }] : tokenize(p.original).map((t) => ({ sent: t, original: t }))));
      const next = mergeRevision(tokens, r.body, restore);
      commit({ subject: r.subject === sentSubject ? subject : restore(r.subject), body: next, label: `AI: ${ask.length > 48 ? `${ask.slice(0, 48)}…` : ask}` });
      setChanges(diffText(before, next));
      setInstruction("");
    });
  };

  const undo = () => {
    // Back to the version before the latest AI change (which includes any manual edits made before it).
    const prev = versions[versions.length - 2];
    if (!prev) return;
    setVersions(versions.slice(0, -1)); setSubject(prev.subject); setBody(prev.body); setChanges(null);
  };
  const startAgain = () => { run.current++; setVersions([]); setSubject(""); setBody(""); setChanges(null); setInstruction(""); setTone("polite"); draft("polite", true); };

  // First open: ask Gemini for the draft.
  const started = useRef(false);
  useEffect(() => { if (open && !started.current) { started.current = true; draft("polite", true); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDraft = versions.length > 0;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email to your landlord or agent</DialogTitle>
          <DialogDescription>Written by Gemini AI from the flagged clauses. Names and addresses are sent as placeholders and put back here, in your browser.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span id="tone-label" className="font-medium">Tone</span>
          <div role="radiogroup" aria-labelledby="tone-label" className="flex rounded-md border border-border p-0.5">
            {TONES.map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={tone === k} disabled={!!busy} onClick={() => { if (k !== tone) { setTone(k); draft(k, !hasDraft); } }}
                className={`rounded px-3 py-1 text-xs disabled:opacity-60 ${tone === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
            ))}
          </div>
          {hasDraft && <span className="text-xs text-muted-foreground">Changing the tone redrafts the email.</span>}
        </div>

        {busy && <div role="status" className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"><LoaderCircle className="size-4 shrink-0 animate-spin text-primary" /> {busy}</div>}
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold">{hasDraft ? "The email could not be updated" : "The email could not be drafted"}</p>
            <p className="mt-1 text-muted-foreground">{error.message}.{hasDraft ? " Your current draft is unchanged." : ""}</p>
            <Button size="sm" className="mt-3" onClick={error.retry}>Try again</Button>
          </div>
        )}

        {hasDraft && (
          <>
            <div className="space-y-1.5"><label htmlFor="email-subject" className="text-sm font-medium">Subject</label>
              <Input id="email-subject" value={subject} disabled={!!busy} onChange={(e) => setSubject(e.target.value)} /></div>
            <div className="space-y-1.5"><label htmlFor="email-body" className="text-sm font-medium">Email</label>
              <Textarea id="email-body" value={body} disabled={!!busy} onChange={(e) => setBody(e.target.value)} className="h-72 text-sm leading-relaxed" />
              <p className="text-xs text-muted-foreground">Drafted by AI. Read it before sending. This is not legal advice.</p></div>

            {changes && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3" role="region" aria-label="What changed">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">What changed</p>
                  <span className="text-xs text-muted-foreground"><mark className="rounded bg-primary/25 px-1 text-foreground">added</mark> <del className="ml-1 text-muted-foreground">removed</del></span>
                  <Button size="sm" variant="outline" className="ml-auto h-7" onClick={undo}><Undo2 /> Undo</Button></div>
                {changes.every((c) => c.type === "same") ? <p className="text-xs text-muted-foreground">The AI made no changes.</p> : (
                  <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {changes.map((c, i) => c.type === "add" ? <mark key={i} className="rounded bg-primary/25 text-foreground">{c.text}</mark> : c.type === "del" ? <del key={i} className="text-muted-foreground">{c.text}</del> : <span key={i}>{c.text}</span>)}
                  </p>
                )}
              </div>
            )}

            <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); revise(); }}>
              <label htmlFor="email-instruction" className="text-sm font-medium">Ask AI to change or add something</label>
              <div className="flex flex-wrap gap-2">
                <Textarea id="email-instruction" value={instruction} disabled={!!busy} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="e.g. also mention the broken boiler · make it shorter · add that all three of us agree" className="min-w-0 flex-1 text-sm" />
                <Button type="submit" variant="secondary" disabled={!!busy || !instruction.trim()}><Sparkles /> Update email</Button>
              </div>
              <p className="text-xs text-muted-foreground">The AI edits your current draft, including anything you typed, and changes only what you ask. Known names and contact details are replaced with placeholders before sending; avoid typing new people's names here.</p>
            </form>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button disabled={!!busy} onClick={async () => { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); toast.success("Email copied to clipboard"); }}><Copy /> Copy email</Button>
              <Button asChild variant="secondary"><a href={mailto}><Mail /> Open in my email app</a></Button>
              {!changes && versions.length > 1 && <Button variant="outline" disabled={!!busy} onClick={undo}><Undo2 /> Undo</Button>}
              <Button variant="ghost" disabled={!!busy} onClick={startAgain}><RotateCcw /> Start again</Button>
            </div>

            {versions.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Version history (this session)</p>
                <ol className="space-y-1 text-xs" aria-label="Version history">
                  {versions.map((v, i) => (
                    <li key={i} className="flex items-center gap-2"><span className="font-mono text-muted-foreground">{i + 1}.</span><span className="min-w-0 flex-1 truncate">{v.label}</span>
                      {i === versions.length - 1 && !dirty ? <span className="text-muted-foreground">current</span>
                        : <button type="button" disabled={!!busy} className="text-primary underline-offset-2 hover:underline" onClick={() => { setSubject(v.subject); setBody(v.body); setChanges(null); }}>Restore</button>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
