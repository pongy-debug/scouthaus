// Shared, browser-safe helpers for the Contract summary and the AI-drafted email: types, clause lookup in the
// contract text, plain-text export, and the word diff used to show and merge AI revisions. No network, no secrets.
import type { Flag } from "./scanner";

export const NOT_STATED = "Not stated in this contract";

/** The key terms always shown, in this order. Anything Gemini does not return is shown as "Not stated". */
export const KEY_TERMS = [
  ["rent", "Rent and how often it is paid"],
  ["deposit", "Deposit and where it is protected"],
  ["dates", "Tenancy start and end dates"],
  ["type", "Tenancy type (fixed or periodic)"],
  ["notice", "Notice needed to leave"],
  ["bills", "Bills included or not"],
  ["tenants", "Number of tenants and joint liability"],
  ["guarantor", "Guarantor required or not"],
  ["breakClause", "Break clause"],
] as const;
export type TermKey = (typeof KEY_TERMS)[number][0];
export const TERM_KEYS = KEY_TERMS.map(([k]) => k) as [TermKey, ...TermKey[]];

export interface SummaryItem { text: string; clause: string }
export interface SummaryFee extends SummaryItem { amount: string }
export interface ContractSummary {
  overview: string;
  keyTerms: { term: TermKey; value: string; clause: string }[];
  tenantMust: SummaryItem[];
  landlordMust: SummaryItem[];
  fees: SummaryFee[];
}

export type Tone = "polite" | "firm" | "brief";
export const TONES: [Tone, string][] = [["polite", "Polite"], ["firm", "Firm"], ["brief", "Brief"]];
export const riskLevel = (score: number) => (score >= 60 ? "High risk" : score >= 30 ? "Moderate risk" : "Low risk");

/** Run every piece of AI-written text through `fix` (used to put real names back, in the browser). */
export function mapSummary(s: ContractSummary, fix: (t: string) => string): ContractSummary {
  const item = <T extends SummaryItem>(i: T): T => ({ ...i, text: fix(i.text), clause: fix(i.clause) });
  return {
    overview: fix(s.overview),
    keyTerms: s.keyTerms.map((k) => ({ ...k, value: fix(k.value), clause: fix(k.clause) })),
    tenantMust: s.tenantMust.map(item), landlordMust: s.landlordMust.map(item),
    fees: s.fees.map((f) => ({ ...item(f), amount: fix(f.amount) })),
  };
}

/** The fixed key-terms table: one row per term, empty value = not stated. */
export function termRows(s: ContractSummary) {
  return KEY_TERMS.map(([key, label]) => {
    const hit = s.keyTerms.find((k) => k.term === key && k.value.trim());
    return { key, label, value: hit?.value.trim() ?? "", clause: hit?.clause ?? "" };
  });
}

// ── Clause lookup ────────────────────────────────────────────────────────────

export interface ContractLine { text: string; num?: string }
export function contractLines(text: string): ContractLine[] {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((t) => {
    const num = t.match(/^(?:clause\s*)?(\d+(?:\.\d+)*)[.):\s-]+\S/i)?.[1];
    return num ? { text: t, num } : { text: t };
  });
}
/** "2.1, 3.2 and Schedule A" → ["2.1", "3.2", "Schedule A"] */
export function clauseRefs(clause: string): string[] {
  return clause.split(/\s*(?:,|;|&|\band\b)\s*/i).map((c) => c.trim().replace(/^(?:clauses?|cl\.)\s*/i, "")).filter(Boolean);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Index of the contract line a clause reference points at, or -1 when it cannot be found. */
export function findClauseLine(lines: ContractLine[], ref: string): number {
  const r = ref.trim().replace(/^(?:clauses?|cl\.|section|para(?:graph)?)\s*/i, "").replace(/[.:]$/, "");
  if (!r) return -1;
  const exact = lines.findIndex((l) => l.num === r);
  if (exact >= 0) return exact;
  const base = r.match(/^\d+(?:\.\d+)*/)?.[0];
  if (!base) { const low = r.toLowerCase(); return lines.findIndex((l) => l.text.toLowerCase().includes(low)); }
  const same = lines.findIndex((l) => l.num === base);
  if (same >= 0) return same;
  const child = lines.findIndex((l) => l.num?.startsWith(`${base}.`));
  if (child >= 0 || !base.includes(".")) return child;
  // PDF text does not always start a clause on its own line.
  const inline = new RegExp(`(?:^|\\s)${esc(base)}[.):\\s]`);
  return lines.findIndex((l) => inline.test(l.text));
}

// ── Export ───────────────────────────────────────────────────────────────────

export interface Block { kind: "h1" | "h2" | "p" | "li" | "small"; text: string }
const ref = (clause: string) => (clause.trim() ? ` (Clause ${clauseRefs(clause).join(", ")})` : "");
const firstSentence = (s: string) => s.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? s;
export const watchOutLine = (f: Flag) => `${f.label.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}: ${firstSentence(f.explain)}`;
export const SUMMARY_DISCLAIMER = "AI-generated summary for information only, not legal advice. Check it against the contract.";

/** The summary as headed blocks — the one source for "Copy summary" and "Download as PDF". */
export function summaryBlocks(s: ContractSummary, flags: Flag[], title: string): Block[] {
  const list = (items: string[]): Block[] => (items.length ? items.map((text) => ({ kind: "li" as const, text })) : [{ kind: "p", text: NOT_STATED }]);
  return [
    { kind: "h1", text: `Contract summary — ${title}` },
    { kind: "p", text: s.overview },
    { kind: "h2", text: "Key terms" },
    ...termRows(s).map((r): Block => ({ kind: "li", text: `${r.label}: ${r.value ? `${r.value}${ref(r.clause)}` : NOT_STATED}` })),
    { kind: "h2", text: "What you are agreeing to do" }, ...list(s.tenantMust.map((i) => `${i.text}${ref(i.clause)}`)),
    { kind: "h2", text: "What the landlord must do" }, ...list(s.landlordMust.map((i) => `${i.text}${ref(i.clause)}`)),
    { kind: "h2", text: "Fees and charges" }, ...list(s.fees.map((f) => `${f.text}${f.amount ? ` — ${f.amount}` : ""}${ref(f.clause)}`)),
    { kind: "h2", text: "Watch out" },
    ...(flags.length ? flags.map((f): Block => ({ kind: "li", text: `${watchOutLine(f)}${ref(f.clause)}` })) : [{ kind: "p" as const, text: "No red-flag clauses were identified in this check." }]),
    { kind: "small", text: SUMMARY_DISCLAIMER },
  ];
}
export function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => (b.kind === "h1" ? `${b.text.toUpperCase()}\n` : b.kind === "h2" ? `\n${b.text.toUpperCase()}` : b.kind === "li" ? `• ${b.text}` : b.kind === "small" ? `\n${b.text}` : b.text)).join("\n");
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export interface DiffOp { type: "same" | "add" | "del"; a?: number; b?: number }
/** Longest-common-subsequence diff of two token lists. `a`/`b` are indexes into the inputs. */
export function diffTokens(a: string[], b: string[]): DiffOp[] {
  const n = a.length, m = b.length, w = m + 1;
  const t = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) t[i * w + j] = a[i] === b[j] ? t[(i + 1) * w + j + 1]! + 1 : Math.max(t[(i + 1) * w + j]!, t[i * w + j + 1]!);
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push({ type: "same", a: i++, b: j++ });
    else if (t[(i + 1) * w + j]! >= t[i * w + j + 1]!) ops.push({ type: "del", a: i++ });
    else ops.push({ type: "add", b: j++ });
  }
  while (i < n) ops.push({ type: "del", a: i++ });
  while (j < m) ops.push({ type: "add", b: j++ });
  return ops;
}
/** Placeholders stay whole; otherwise words and the whitespace between them. */
export const tokenize = (s: string) => s.match(/\[[A-Z]+(?:_[A-Z]+)*(?:_\d+)?\]|\s+|[^\s[]+|\[/g) ?? [];

export interface Change { type: "same" | "add" | "del"; text: string }
/** What changed between two versions of the email, grouped into runs for display. */
export function diffText(before: string, after: string): Change[] {
  const a = tokenize(before), b = tokenize(after);
  const out: Change[] = [];
  for (const op of diffTokens(a, b)) {
    const text = op.type === "add" ? b[op.b!]! : a[op.a!]!;
    const last = out[out.length - 1];
    if (last && last.type === op.type) last.text += text; else out.push({ type: op.type, text });
  }
  return out;
}

/**
 * Merge an AI revision into the local email. `sent` is what was sent (each token with the local text it stood for),
 * `reply` is the revised text that came back. Tokens the AI left alone are copied from the local text, so the user's
 * own wording — and the real names behind placeholders — come through byte for byte; only new text is `restore`d.
 */
export function mergeRevision(sent: { sent: string; original: string }[], reply: string, restore: (s: string) => string): string {
  const b = tokenize(reply);
  let out = "", added = "";
  const flush = () => { if (added) { out += restore(added); added = ""; } };
  for (const op of diffTokens(sent.map((s) => s.sent), b)) {
    if (op.type === "add") added += b[op.b!]!;
    else { flush(); if (op.type === "same") out += sent[op.a!]!.original; }
  }
  flush();
  return out;
}
