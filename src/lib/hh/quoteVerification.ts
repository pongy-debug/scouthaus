export interface QuoteMatch { start: number; end: number; clause: string | null }
export interface QuoteCheck { status: "verified" | "clause-review" | "quote-review"; matches: QuoteMatch[] }

// Keep an index back to the input. Only whitespace and typographic quote variants
// are normalised: amounts, dates, case and negative words remain significant.
function normalise(text: string) {
  let value = "";
  const starts: number[] = [], ends: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      if (value.endsWith(" ")) { ends[ends.length - 1] = i + 1; continue; }
      value += " ";
    } else value += /[‘’]/.test(c) ? "'" : /[“”]/.test(c) ? '"' : c;
    starts.push(i); ends.push(i + 1);
  }
  return { value, starts, ends };
}

export function verifyQuote(text: string, quote: string, reference: string): QuoteCheck {
  const input = normalise(text);
  let needle = normalise(quote).value.trim();
  if ((needle.startsWith('"') && needle.endsWith('"')) || (needle.startsWith("'") && needle.endsWith("'"))) needle = needle.slice(1, -1).trim();
  if (!needle) return { status: "quote-review", matches: [] };
  const clauses = [...text.matchAll(/^[ \t]*(?:clause[ \t]+)?(\d+(?:\.\d+)*)(?:[.):][ \t]+|[ \t]+)(?=\S)/gim)];
  const matches: QuoteMatch[] = [];
  for (let at = input.value.indexOf(needle); at >= 0; at = input.value.indexOf(needle, at + 1)) {
    // A partial word or amount is not an exact quotation (e.g. £18 inside £180).
    const before = input.value[at - 1] ?? "", after = input.value[at + needle.length] ?? "";
    if ((/[\p{L}\p{N}]/u.test(needle[0]!) && /[\p{L}\p{N}]/u.test(before)) || (/[\p{L}\p{N}]/u.test(needle.at(-1)!) && /[\p{L}\p{N}]/u.test(after))) continue;
    const start = input.starts[at]!, end = input.ends[at + needle.length - 1]!;
    const header = [...clauses].reverse().find((c) => c.index <= start);
    const next = header && clauses[clauses.indexOf(header) + 1];
    const clause = header && (!next || end <= next.index) ? header[1]! : null;
    matches.push({ start, end, clause });
  }
  const ref = reference.trim().replace(/^(?:clauses?|cl\.)\s*/i, "").replace(/[.:]$/, "");
  const verified = matches.length > 0 && matches.every((m) => m.clause === ref);
  return { status: verified ? "verified" : matches.length ? "clause-review" : "quote-review", matches };
}
