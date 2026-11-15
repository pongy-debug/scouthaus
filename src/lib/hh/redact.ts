// Personal-detail redaction for the Contract Scanner. Everything in this file runs in the browser: the original
// text and the value → placeholder map never leave the device. Only `applyRedactions(...).redacted` may be sent on.
//
// Detection is deliberately rule-based and visible to the user (they review the list before anything is sent):
//  - regular expressions for emails, phones, postcodes, NI numbers, sort codes, IBANs and labelled numbers;
//  - names and addresses read from the parties sentence, labels such as "Tenant:" / "Address:" and signature
//    blocks, then every later occurrence of those values (including first-name-only mentions) is replaced.

export type RedactionKind = "name" | "email" | "phone" | "address" | "other";
export const KIND_LABEL: Record<RedactionKind, string> = { name: "Names", email: "Emails", phone: "Phones", address: "Addresses", other: "Other" };

/** One literal to look for in the contract and the text that is sent in its place. */
export interface Variant { match: string; sent: string }
export interface Redaction {
  id: string;
  /** e.g. "[TENANT_1]" */
  placeholder: string;
  kind: RedactionKind;
  /** The real value, shown to the user next to the placeholder. Browser memory only. */
  value: string;
  variants: Variant[];
  /** False once the user restores an item that was wrongly removed. */
  enabled: boolean;
  /** Added by the user with "Redact this". */
  manual?: boolean;
  /** How many times it occurs in the contract. */
  hits: number;
}
export interface Part { original: string; sent: string; id?: string }

const PC = "[A-Z]{1,2}\\d[A-Z\\d]?\\s?\\d[A-Z]{2}";
const WORD = "[A-Z][A-Za-z'’-]+";
const NAME = `(?:(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof)\\.?\\s+)?${WORD}(?:[ \\t]+(?:${WORD}|de|van|von|bin|al|di|da|le|la)){1,3}`;
const TITLES = ["Mr", "Mrs", "Ms", "Miss", "Mx", "Dr"];
const COMPANY = /\b(ltd|limited|llp|plc|inc|lettings?|propert(?:y|ies)|estates?|homes|management|group|housing|agency|agents?|students|investments?|developments?|university|college|trust|council|partners|services|residential|rentals?|company|co|associates|holdings|accommodation)\b\.?/i;
const NOT_A_NAME = /\b(The|Tenants?|Landlords?|Agents?|Guarantors?|Schedule|Property|Premises|Agreement|Deposit|Rent|Term|Date|Name|Address|Signed|Witness|Clause|Above|Below|Each|All|Any|This|That)\b/;
// First names that are also everyday words or months: replacing them on their own would damage clause wording and dates.
const AMBIGUOUS_FIRST = new Set(["Will", "Mark", "May", "Bill", "Grant", "Rose", "Sue", "Rob", "Pat", "Art", "Don", "Guy", "Hope", "Joy", "Faith", "Grace", "Penny", "Dean", "Earl", "Miles", "Rich", "Chase", "Hunter", "Summer", "Dawn", "Iris", "April", "June", "August", "Autumn", "Page", "Lane", "Bob", "Nick", "Jack", "Max", "Ray", "Sky", "Rain", "Reed", "Wade", "Cliff", "Dale", "Glen", "Heath", "Rod", "Stew", "Tony"]);
const ROLE: Record<string, string> = { tenant: "TENANT", "lead tenant": "TENANT", "joint tenant": "TENANT", lessee: "TENANT", occupier: "TENANT", occupant: "TENANT", student: "TENANT", guarantor: "GUARANTOR", landlord: "LANDLORD", lessor: "LANDLORD", witness: "WITNESS" };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Literal → pattern: whitespace is flexible (PDF text wraps lines) and it must not start or end inside a word. */
function toPattern(literal: string) {
  const body = norm(literal).split(" ").map(esc).join("\\s+");
  return `${/^[A-Za-z0-9]/.test(literal) ? "(?<![A-Za-z0-9])" : ""}${body}${/[A-Za-z0-9]$/.test(literal) ? "(?![A-Za-z0-9])" : ""}`;
}

/** Replace every occurrence of the enabled items. `redacted` is the only text that may leave the browser. */
export function applyRedactions(text: string, items: Redaction[]): { redacted: string; parts: Part[]; hits: Map<string, number> } {
  const table = new Map<string, { sent: string; id: string }>();
  const alts: string[] = [];
  for (const it of items) {
    if (!it.enabled) continue;
    for (const v of it.variants) {
      const key = norm(v.match);
      if (!key || table.has(key)) continue;
      table.set(key, { sent: v.sent, id: it.id });
      alts.push(v.match);
    }
  }
  const hits = new Map<string, number>();
  if (!alts.length) return { redacted: text, parts: text ? [{ original: text, sent: text }] : [], hits };
  // Longest first, so a full address wins over the postcode inside it and a full name over its first name.
  const re = new RegExp(alts.sort((a, b) => b.length - a.length).map(toPattern).join("|"), "g");
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const hit = table.get(norm(m[0]));
    if (!hit) continue;
    if (m.index > last) { const plain = text.slice(last, m.index); parts.push({ original: plain, sent: plain }); }
    parts.push({ original: m[0], sent: hit.sent, id: hit.id });
    hits.set(hit.id, (hits.get(hit.id) ?? 0) + 1);
    last = m.index + m[0].length;
  }
  if (last < text.length) { const plain = text.slice(last); parts.push({ original: plain, sent: plain }); }
  return { redacted: parts.map((p) => p.sent).join(""), parts, hits };
}

/** Values of enabled items that are still present in `outgoing` — must be empty before anything is sent. */
export function findLeaks(outgoing: string, items: Redaction[]): string[] {
  const flat = norm(outgoing);
  return items.filter((it) => it.enabled && it.hits > 0 && it.value.length > 3 && new RegExp(toPattern(it.value)).test(flat)).map((it) => it.placeholder);
}

/** Put the real values back into text that came from the AI (quotes, explanations) — locally, for display only. */
export function restoreText(text: string, items: Redaction[]): string {
  if (!text) return text;
  const used = items.filter((it) => it.enabled);
  // Whole replacements first ("[PROPERTY_ADDRESS], Durham DH1" → the full address), then bare placeholders.
  const whole = used.flatMap((it) => it.variants.filter((v) => v.sent !== it.placeholder && v.sent.includes(it.placeholder)).map((v) => ({ from: v.sent, to: v.match })))
    .sort((a, b) => b.from.length - a.from.length);
  let out = text;
  for (const w of whole) out = out.split(w.from).join(w.to);
  for (const it of used) {
    const bare = it.variants.find((v) => v.sent === it.placeholder)?.match ?? it.value;
    out = out.replace(new RegExp(`\\[?\\b${esc(it.placeholder.slice(1, -1))}\\b\\]?`, "gi"), () => bare);
  }
  return out;
}

export function countByKind(items: Redaction[]): { total: number; byKind: Record<RedactionKind, number> } {
  const byKind: Record<RedactionKind, number> = { name: 0, email: 0, phone: 0, address: 0, other: 0 };
  for (const it of items) if (it.enabled) byKind[it.kind]++;
  return { total: Object.values(byKind).reduce((a, b) => a + b, 0), byKind };
}

/** Recount occurrences after the list changes. */
export function withHits(text: string, items: Redaction[]): Redaction[] {
  const { hits } = applyRedactions(text, items.map((it) => ({ ...it, enabled: true })));
  return items.map((it) => ({ ...it, hits: hits.get(it.id) ?? 0 }));
}

/** "Redact this": add something the automatic pass missed. Returns null if the text is not in the contract. */
export function addManualRedaction(text: string, items: Redaction[], selection: string): Redaction[] | null {
  const value = norm(selection);
  if (value.length < 2 || !new RegExp(toPattern(value)).test(text)) return null;
  const existing = items.find((it) => it.variants.some((v) => norm(v.match) === value));
  if (existing) return items.map((it) => (it === existing ? { ...it, enabled: true } : it));
  const n = items.filter((it) => it.manual).length + 1;
  const placeholder = `[REDACTED_${n}]`;
  return withHits(text, [...items, { id: `manual-${n}`, placeholder, kind: "other", value, variants: [{ match: value, sent: placeholder }], enabled: true, manual: true, hits: 0 }]);
}

/**
 * Text typed after the contract was read (an edit to the email, an instruction to the AI) can hold new personal
 * details. Anything the detector finds that the existing items do not already cover gets a fresh placeholder.
 */
export function extendRedactions(text: string, items: Redaction[]): Redaction[] {
  const fresh = detectRedactions(applyRedactions(text, items).redacted).filter((it) => !/[[\]]/.test(it.value));
  if (!fresh.length) return items;
  const used = new Set(items.map((it) => it.placeholder));
  const out = [...items];
  for (const f of fresh) {
    const base = f.placeholder.slice(1, -1).replace(/_\d+$/, "");
    let n = 1;
    while (used.has(`[${base}_${n}]`)) n++;
    const placeholder = `[${base}_${n}]`;
    used.add(placeholder);
    out.push({ ...f, id: placeholder.slice(1, -1).toLowerCase(), placeholder, variants: f.variants.map((v) => ({ match: v.match, sent: v.sent.split(f.placeholder).join(placeholder) })), hits: 1 });
  }
  return out;
}

// ── Detection ────────────────────────────────────────────────────────────────

interface Found { kind: RedactionKind; label: string; value: string; variants?: (ph: string) => Variant[]; fixed?: boolean; at?: number }

function isName(piece: string) {
  const p = piece.trim();
  return new RegExp(`^${NAME}$`).test(p) && !COMPANY.test(p) && !NOT_A_NAME.test(p);
}
/** Leading names in a list such as "Priya Sharma, Tom Okafor and Mei Lin Chen, 27 Elm Grove…" (stops at the first non-name). */
function leadingNames(rest: string): string[] {
  if (COMPANY.test(rest.split(/[,(\n]/)[0] ?? "")) return [];
  const out: string[] = [];
  for (const piece of rest.split(/,|;|\band\b|&|\(|\.(?:\s|$)|\bof\b|\t/)) {
    if (!piece.trim()) continue;
    if (!isName(piece)) break;
    out.push(norm(piece));
  }
  return out;
}
function nameVariants(full: string) {
  return (ph: string): Variant[] => {
    const bare = full.replace(/^(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof)\.?\s+/, "");
    const words = bare.split(" ");
    const first = words[0]!, surname = words[words.length - 1]!;
    const list = [bare, bare.toUpperCase()];
    for (const t of TITLES) list.push(`${t} ${surname}`, `${t}. ${surname}`);
    if (first.length >= 3 && first !== surname && !AMBIGUOUS_FIRST.has(first)) list.push(first);
    return list.map((match) => ({ match, sent: ph }));
  };
}
/** Rented property: the house number and street go, the town and postcode district stay for jurisdiction checks. */
function propertyVariants(full: string) {
  return (ph: string): Variant[] => {
    const pc = full.match(new RegExp(`${PC}$`))?.[0];
    const body = (pc ? full.slice(0, -pc.length) : full).replace(/[,\s]+$/, "");
    const bits = body.split(",").map((b) => b.trim()).filter(Boolean);
    const streetBits = /^(?:Flat|Apartment|Apt|Room|Unit)\b/i.test(bits[0] ?? "") && bits.length > 2 ? 2 : 1;
    const street = bits.slice(0, streetBits).join(", ");
    const town = bits.length > streetBits ? bits[bits.length - 1]! : "";
    const district = pc ? pc.replace(/\s?\d[A-Z]{2}$/, "") : "";
    const tail = `${town ? `, ${town}` : ""}${district ? ` ${district}` : ""}`;
    const list: Variant[] = [{ match: full, sent: `${ph}${tail}` }, { match: street, sent: ph }];
    if (town) list.push({ match: `${street}, ${town}`, sent: `${ph}, ${town}` });
    if (pc) list.push({ match: pc, sent: district });
    return list;
  };
}

/** Find personal details in a contract. The result is a suggestion the user reviews, not a guarantee. */
export function detectRedactions(text: string): Redaction[] {
  const found: Found[] = [];
  const taken: [number, number][] = [];
  const free = (s: number, e: number) => !taken.some(([a, b]) => s < b && e > a);
  const claim = (s: number, e: number) => { taken.push([s, e]); };
  let cursor = 0; // where the detector currently is, so placeholders are numbered in reading order
  const add = (f: Found) => { if (f.value.trim()) found.push({ ...f, value: norm(f.value), at: f.at ?? cursor }); };
  /** Run a pattern; `group` is the capture holding the value (0 = whole match). */
  const each = (re: RegExp, group: number, fn: (value: string, m: RegExpMatchArray) => void) => {
    for (const m of text.matchAll(re)) {
      const value = m[group];
      if (!value) continue;
      const start = m.index + m[0].indexOf(value);
      if (!free(start, start + value.length)) continue;
      claim(start, start + value.length);
      cursor = start;
      fn(value, m);
    }
  };

  // Emails
  each(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, 0, (v) =>
    add({ kind: "email", label: "EMAIL", value: v, variants: (ph) => [...new Set([v, v.toLowerCase()])].map((match) => ({ match, sent: ph })) }));

  // Labelled numbers first, so a phone or postcode pattern cannot swallow part of them.
  const DATE = "\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Z][a-z]+\\s+\\d{4}";
  each(new RegExp(`(?:date\\s+of\\s+birth|d\\.?o\\.?b\\.?|born(?:\\s+on)?)\\s*[:\\-–]?\\s*(${DATE})`, "gi"), 1, (v) => add({ kind: "other", label: "DOB", value: v }));
  each(/\b(?:student|university|cis|banner)\s*(?:id|number|no\.?)\s*[:#-]?\s*([A-Za-z]{0,4}\d{4,10})\b/gi, 1, (v) => add({ kind: "other", label: "STUDENT_ID", value: v }));
  each(/\b(?:passport|national\s+id|identity\s+card|id\s+card|driving\s+licen[cs]e|brp|visa)\s*(?:number|no\.?)?\s*[:#-]?\s*((?=[A-Z0-9]*\d)[A-Z0-9]{6,16})\b/gi, 1, (v) => add({ kind: "other", label: "ID", value: v }));
  each(/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g, 0, (v) => add({ kind: "other", label: "NI", value: v }));
  each(/\bGB\d{2}\s?[A-Z]{4}(?:\s?\d{4}){3}\s?\d{2}\b/g, 0, (v) => add({ kind: "other", label: "BANK", value: v }));
  each(/\b(?:account|acc(?:ount)?|a\/c)\s*(?:number|no\.?|#)?\s*[:#-]?\s*(\d{8})\b/gi, 1, (v) => add({ kind: "other", label: "BANK", value: v }));
  each(/\bsort\s*code\s*[:#-]?\s*(\d{2}[\s-]?\d{2}[\s-]?\d{2})\b/gi, 1, (v) => add({ kind: "other", label: "BANK", value: v }));
  each(/(?<![\d-])\d{2}-\d{2}-\d{2}(?![\d-])/g, 0, (v) => add({ kind: "other", label: "BANK", value: v }));

  // Phones: UK mobiles and landlines, +44 and other international numbers. Money and dates never match (no £, no slashes).
  for (const m of text.matchAll(/(?<![\w+£.,/-])(?:\+\d{1,3}[ \t.-]?(?:\(0\)[ \t.-]?)?|\(?0)\d(?:[ \t.-]?[()]?[ \t]?\d){7,14}(?![\w/])/g)) {
    let v = m[0];
    const max = v.startsWith("+") ? 15 : 11, min = 10;
    const digits = (s: string) => s.replace(/\D/g, "").length;
    // A number glued to the next figure ("07700 900123 12 months"): drop trailing groups until it is a valid length.
    while (digits(v) > max && /[ \t.-]\d+$/.test(v)) v = v.replace(/[ \t.-]+\d+$/, "");
    if (digits(v) < min || digits(v) > max || !free(m.index, m.index + v.length)) continue;
    claim(m.index, m.index + v.length);
    add({ kind: "phone", label: "PHONE", value: v, at: m.index });
  }

  // Addresses: number + street … + postcode, then streets with no postcode, then "Address:" labels.
  const BEFORE_PROPERTY = /(?:tenancy\s+agreement\s*(?:for|of|at)?\s*[—–:-]*\s*|(?:property|premises)(?:\s+address)?\s*[:\-–]\s*|(?:property|premises|dwelling(?:-?house)?)\s+(?:is\s+)?(?:situated\s+|located\s+)?(?:at|known\s+as)\s+|relating\s+to\s+|in\s+respect\s+of\s+|letting\s+of\s+)$/i;
  let property: string | null = null;
  const addAddress = (v: string, index: number) => {
    const value = norm(v.replace(/[,\s]+$/, ""));
    if (property === null && BEFORE_PROPERTY.test(text.slice(Math.max(0, index - 70), index))) {
      property = value;
      add({ kind: "address", label: "PROPERTY_ADDRESS", value, variants: propertyVariants(value), fixed: true });
    } else if (value !== property) add({ kind: "address", label: "ADDRESS", value });
  };
  const UNIT = "(?:(?:Flat|Apartment|Apt|Room|Unit)\\s+\\w+,?\\s+)?";
  const CAP = "[A-Z][\\w'’.-]*";
  for (const m of text.matchAll(new RegExp(`(?<![\\d.£\\w])${UNIT}\\d+[A-Za-z]?(?:[-–]\\d+)?,?[ \\t]+(?:${CAP}[ \\t]+){0,4}${CAP}(?:,\\s*(?:${CAP}[ \\t]?){1,4}){0,4},?\\s+${PC}(?![A-Za-z0-9])`, "g"))) {
    if (!free(m.index, m.index + m[0].length)) continue;
    claim(m.index, m.index + m[0].length);
    cursor = m.index;
    addAddress(m[0], m.index);
  }
  const STREET = "Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Close|Drive|Terrace|Crescent|Place|Gardens|Way|Grove|Court|Square|View|Hill|Row|Walk|Mews|Park|Bank|Villas|Green|Rise|Parade|Wynd|Gate";
  for (const m of text.matchAll(new RegExp(`(?<![\\d.£\\w])${UNIT}\\d+[A-Za-z]?(?:[-–]\\d+)?,?[ \\t]+(?:${CAP}[ \\t]+){0,3}(?:${STREET})\\b(?:,[ \\t]*(?:${CAP}[ \\t]?){1,3}){0,3}`, "g"))) {
    if (!free(m.index, m.index + m[0].length)) continue;
    claim(m.index, m.index + m[0].length);
    cursor = m.index;
    addAddress(m[0], m.index);
  }
  each(/(?:^|[\n;.])[ \t]*(?:home|permanent|correspondence|current|term[- ]time|contact|forwarding)?[ \t]*address[ \t]*[:\-–][ \t]*([^\n;]{6,160})/gi, 1, (v, m) => addAddress(v.replace(/\.\s*$/, ""), (m.index ?? 0) + m[0].indexOf(v)));
  // A postcode on its own (the property's keeps its district; others go entirely).
  each(new RegExp(`(?<![A-Za-z0-9])${PC}(?![A-Za-z0-9])`, "g"), 0, (v) => { if (!property || !norm(property).endsWith(norm(v))) add({ kind: "address", label: "POSTCODE", value: v }); });

  // Names: labels, signature blocks and the parties sentence.
  const person = (name: string, label: string) => { if (isName(name)) add({ kind: "name", label, value: name.replace(/^(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof)\.?\s+/, ""), variants: nameVariants(norm(name)) }); };
  for (const m of text.matchAll(/(?:^|[\n;(])[ \t]*(?:the[ \t]+)?(lead tenant|joint tenant|tenant|guarantor|landlord|lessor|lessee|witness|occupier|occupant|student)s?[ \t]*(?:\(?\d+\)?|[A-Z]\b)?[ \t]*(?:\(?name\)?|\(s\))?[ \t]*[:\-–—][ \t]*([^\n]+)/gi))
    for (const n of leadingNames(m[2]!)) { cursor = (m.index ?? 0) + m[0].indexOf(n); person(n, ROLE[m[1]!.toLowerCase()] ?? "PERSON"); }
  for (const m of text.matchAll(/(?:^|[\n;(])[ \t]*(?:signed(?:[ \t]+by)?(?:[ \t]+the)?(?:[ \t]+(tenant|guarantor|landlord|witness)s?)?|print(?:ed)?[ \t]+name|full[ \t]+name|name)[ \t]*(?:\(\d\))?[ \t]*[:\-–—][ \t]*([^\n]+)/gi))
    for (const n of leadingNames(m[2]!)) { cursor = (m.index ?? 0) + m[0].indexOf(n); person(n, m[1] ? ROLE[m[1].toLowerCase()]! : "PERSON"); }
  const parties = text.slice(0, 4000).match(/\bbetween\b:?\s*([\s\S]{10,900}?)(?=\n\s*\n|\.\s*(?:\n|$)|$)/i);
  if (parties) {
    const body = parties[1]!;
    let from = 0;
    for (const m of body.matchAll(/\(\s*(?:hereinafter\s+)?(?:called\s+|referred\s+to\s+as\s+)?["“'‘]?(?:the\s+)?["“'‘]?(landlord|tenant|guarantor|lessor|lessee)s?["”'’]?\s*\)/gi)) {
      const chunk = body.slice(from, m.index).replace(/^\s*(?:and\b)?\s*/i, "").replace(/\(\d+\)/g, " ");
      from = m.index + m[0].length;
      const role = ROLE[m[1]!.toLowerCase()]!;
      for (const piece of chunk.split(/,|;|\band\b|&|\bof\b|\bwhose\b/)) if (isName(piece)) { cursor = text.indexOf(piece.trim()); person(norm(piece), role); }
    }
  }

  // Number the placeholders per label in order of discovery; the same value always gets the same placeholder.
  const items: Redaction[] = [];
  const counters = new Map<string, number>();
  const seen = new Map<string, Redaction>();
  // A role label ("Tenant:") beats a bare signature ("Name:") for the same person, wherever each appears.
  found.sort((a, b) => Number(a.label === "PERSON") - Number(b.label === "PERSON") || (a.at ?? 0) - (b.at ?? 0));
  for (const f of found) {
    const key = `${f.kind}:${f.value.toLowerCase()}`;
    const prior = seen.get(key) ?? (f.kind === "name" ? items.find((it) => it.kind === "name" && it.value.toLowerCase() === f.value.toLowerCase()) : undefined);
    if (prior) continue;
    const n = (counters.get(f.label) ?? 0) + 1;
    counters.set(f.label, n);
    const placeholder = f.fixed ? `[${f.label}]` : `[${f.label}_${n}]`;
    const item: Redaction = { id: placeholder.slice(1, -1).toLowerCase(), placeholder, kind: f.kind, value: f.value, variants: f.variants ? f.variants(placeholder) : [{ match: f.value, sent: placeholder }], enabled: true, hits: 0 };
    seen.set(key, item);
    items.push(item);
  }
  // A postcode that only ever appears inside a full address is covered by that address: drop the empty entry.
  return withHits(text, items).filter((it) => it.hits > 0);
}
