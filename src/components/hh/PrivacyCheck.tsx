import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, EyeOff, Lock, RotateCcw, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, applyRedactions, countByKind, type Redaction, type RedactionKind } from "@/lib/hh/redact";

const KINDS = Object.keys(KIND_LABEL) as RedactionKind[];

function privacyHeadline(items: Redaction[]) {
  const { total } = countByKind(items);
  return total === 0 ? "We found no personal details to remove" : `We removed ${total} personal detail${total === 1 ? "" : "s"} before analysis`;
}

/** Each removed value next to its placeholder. Shown only on this device; `onToggle` lets the user restore an item. */
export function RedactionList({ items, onToggle }: { items: Redaction[]; onToggle?: (id: string) => void }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No names, contact details, addresses or ID numbers were detected.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border text-sm" aria-label="Removed personal details">
      {items.map((it) => (
        <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className={`min-w-0 break-words ${it.enabled ? "" : "text-muted-foreground line-through"}`}>{it.value}</span>
          <span aria-hidden="true" className="text-muted-foreground">→</span>
          <code className={`rounded px-1.5 py-0.5 font-mono text-xs ${it.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{it.enabled ? it.placeholder : "kept as written"}</code>
          <span className="text-xs text-muted-foreground">{KIND_LABEL[it.kind]}{it.manual ? " · added by you" : ""}{it.hits > 1 ? ` · ${it.hits}×` : ""}</span>
          {onToggle && (
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => onToggle(it.id)} aria-label={it.enabled ? `Restore ${it.value}` : `Redact ${it.value} again`}>
              {it.enabled ? <><RotateCcw /> Restore</> : <><EyeOff /> Redact again</>}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * The review step before anything is sent: what was removed, a preview of exactly what will be sent, and controls to
 * restore an item or redact a selection. All of it works on text held in browser memory.
 */
export function PrivacyCheck({ text, items, busy, onToggle, onRedact, onAnalyse, onClear, onEditText }: {
  text: string; items: Redaction[]; busy: boolean;
  onToggle: (id: string) => void; onRedact: (selection: string) => boolean; onAnalyse: () => void; onClear: () => void; onEditText: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(text);
  const [view, setView] = useState<"sent" | "original">("sent");
  const [selection, setSelection] = useState("");
  const preview = useRef<HTMLPreElement>(null);
  const { parts } = useMemo(() => applyRedactions(text, items), [text, items]);
  const { total, byKind } = countByKind(items);

  const readSelection = () => {
    const sel = window.getSelection();
    const inside = !!sel && !!sel.anchorNode && !!preview.current?.contains(sel.anchorNode);
    setSelection(inside ? sel.toString().trim() : "");
  };
  const redactSelection = () => {
    if (!selection) return;
    if (/\[[A-Z_]+(?:_\d+)?\]/.test(selection)) { toast.error("That selection already contains a placeholder — select only the text that is still visible"); return; }
    if (onRedact(selection)) { setSelection(""); window.getSelection()?.removeAllRanges(); }
    else toast.error("Couldn't find that exact text in the contract — try selecting a shorter piece on one line");
  };

  return (
    <section className="glass space-y-5 p-6 sm:p-8" aria-labelledby="privacy-check-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Lock className="size-4" /> Privacy check</div>
          <h2 id="privacy-check-heading" className="mt-2 text-xl font-semibold">{privacyHeadline(items)}</h2>
          {total > 0 && <p className="mt-1 text-sm text-muted-foreground">{KINDS.filter((k) => byKind[k] > 0).map((k) => `${KIND_LABEL[k]} ${byKind[k]}`).join(" · ")}</p>}
        </div>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}><Trash2 /> Clear contract</Button>
      </div>
      <p className="text-sm text-muted-foreground">Automatic redaction can miss things. Please check the preview before sending.</p>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">What was removed <span className="font-normal text-muted-foreground">· visible only on this device</span></h3>
        <RedactionList items={items} {...(editing ? {} : { onToggle })} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{editing ? "Edit contract text" : view === "sent" ? "What is sent" : "Original (stays on this device)"}</h3>
          {!editing && <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraftText(text); setSelection(""); setEditing(true); }}>Edit text</Button>
            <Button size="sm" variant="outline" disabled={busy || !selection} onMouseDown={(e) => e.preventDefault()} onClick={redactSelection}><EyeOff /> Redact this</Button>
            <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Preview">
              {(["original", "sent"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded px-2.5 py-1 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{v === "sent" ? "Show what is sent" : "Show original"}</button>
              ))}
            </div>
          </div>}
        </div>
        {editing ? <div className="space-y-3">
          <label htmlFor="contract-edit" className="text-sm font-medium">Edit contract text</label>
          <Textarea id="contract-edit" value={draftText} disabled={busy} onChange={(e) => setDraftText(e.target.value)} className="min-h-72 resize-y bg-background/50 font-mono text-xs leading-relaxed" />
          <p className="text-xs text-muted-foreground">Changes stay on this device. Applying changes detects personal details again and resets manual redactions. Review the preview before analysis.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || !draftText.trim()} onClick={() => { onEditText(draftText); setEditing(false); setView("sent"); setSelection(""); }}>Apply changes</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setDraftText(text); setEditing(false); }}>Cancel editing</Button>
          </div>
        </div> : <>
        <pre ref={preview} aria-label={view === "sent" ? "Redacted contract preview" : "Original contract preview"} onMouseUp={readSelection} onKeyUp={readSelection} onTouchEnd={readSelection}
          className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background/50 p-4 font-mono text-xs leading-relaxed">
          {parts.map((p, i) => p.id
            ? <mark key={i} className={view === "sent" ? "rounded bg-primary/20 px-0.5 text-primary" : "rounded bg-warning/25 px-0.5 text-foreground"}>{view === "sent" ? p.sent : p.original}</mark>
            : <span key={i}>{p.original}</span>)}
        </pre>
        <p className="text-xs text-muted-foreground">Missed something? Select it in the preview and choose “Redact this”. Wrongly removed? Use “Restore” in the list above.</p>
        </>}
      </div>

      <div className="space-y-2 border-t border-border pt-5">
        <Button disabled={busy || editing} onClick={onAnalyse} className="w-full sm:w-auto">Analyse redacted contract <ArrowRight /></Button>
        <p className="text-xs text-muted-foreground">Only the redacted version is sent to Google Gemini. Your personal details stay in your browser.</p>
      </div>
    </section>
  );
}
