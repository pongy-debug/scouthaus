export type Severity = "red" | "amber";
export interface Flag { id: string; clause: string; label: string; severity: Severity; text: string; statute: string; explain: string; fee: number; ask: string }
export interface ScanResult { clauses: number; flags: Flag[]; score: number; illegalFees: number; unenforceable: number }

interface Rule { id: string; label: string; severity: Severity; test: RegExp; statute: string; explain: string; ask: string; fee?: boolean; unenforceable?: boolean }

const RULES: Rule[] = [
  { id: "cleaning", label: "ILLEGAL FEE", severity: "red", fee: true, unenforceable: true,
    test: /(professional|mandatory)[^.]*clean|clean[^.]*(fee|charge|£)/i,
    statute: "Tenant Fees Act 2019, Schedule 1 — Mandatory end-of-tenancy cleaning fees are banned in England.",
    explain: "A landlord can only ask you to return the property as clean as it was. They can't charge a fixed professional cleaning fee.",
    ask: "remove the mandatory cleaning charge, as it is a prohibited payment under the Tenant Fees Act 2019" },
  { id: "admin", label: "ILLEGAL FEE", severity: "red", fee: true, unenforceable: true,
    test: /(admin(istration)?|reference|referencing|check-?out|inventory|renewal|signing)[^.]*(fee|charge)/i,
    statute: "Tenant Fees Act 2019, s.1 & Schedule 1 — Admin, referencing, inventory and renewal fees are prohibited payments.",
    explain: "Since June 2019 the only payments allowed are rent, a capped deposit, holding deposit and a few defaults. Admin-style fees are banned.",
    ask: "remove this fee, which is a prohibited payment under the Tenant Fees Act 2019" },
  { id: "entry", label: "UNFAIR ENTRY", severity: "red", unenforceable: true,
    test: /enter[^.]*(any time|anytime|without (prior )?notice)|without (prior )?notice[^.]*enter/i,
    statute: "Housing Act 1988 & Implied Covenant of Quiet Enjoyment; Landlord and Tenant Act 1985 s.11(6) — Requires at least 24 hours' written notice.",
    explain: "You have the right to live without interruption. Except in an emergency, the landlord must give at least 24 hours' written notice and visit at a reasonable time.",
    ask: "amend this clause so entry requires at least 24 hours' written notice except in a genuine emergency" },
  { id: "repairs", label: "LIABILITY SHIFT", severity: "amber", unenforceable: true,
    test: /tenant[^.]*(liable|responsible)[^.]*(damp|mould|boiler|structur|roof|heating)/i,
    statute: "Landlord and Tenant Act 1985, Section 11 — Structural repairs, damp caused by building fabric, and heating/water installations are strictly the landlord's legal duty.",
    explain: "This duty can't be passed to you by contract. You're only responsible for damage you cause.",
    ask: "remove this clause, since repairs to the structure, heating and water are the landlord's duty under s.11 of the Landlord and Tenant Act 1985" },
  { id: "deposit", label: "DEPOSIT TRAP", severity: "amber",
    test: /deposit[^.]*(personal|business account|60 days|not be protected|held by the landlord)/i,
    statute: "Housing Act 2004, ss.213–214 — Deposits must be protected in a government-approved TDP scheme within 30 days.",
    explain: "If your deposit isn't protected you could claim 1–3× the deposit back, and the landlord can't easily serve a Section 21 notice.",
    ask: "confirm the deposit will be protected in a government-approved scheme (DPS, TDS or mydeposits) within 30 days and that prescribed information will be provided" },
  { id: "depcap", label: "DEPOSIT CAP", severity: "amber", fee: false,
    test: /deposit[^.]*(six|6|eight|8|ten|10) weeks/i,
    statute: "Tenant Fees Act 2019, Schedule 1 para 2 — Deposits are capped at 5 weeks' rent (annual rent under £50,000).",
    explain: "A deposit above 5 weeks' rent is a prohibited payment and the excess must be refunded.",
    ask: "reduce the deposit to no more than five weeks' rent, as required by the Tenant Fees Act 2019" },
  { id: "late", label: "EXCESS PENALTY", severity: "amber", fee: true,
    test: /late[^.]*(fee|charge|penalty)[^.]*£\s?\d+|£\s?\d+[^.]*late/i,
    statute: "Tenant Fees Act 2019, Schedule 1 para 4 — Late rent charges are only allowed after 14 days and capped at 3% above Bank of England base rate.",
    explain: "Fixed late-payment penalties are not allowed. Only interest at a capped rate can be charged.",
    ask: "replace the fixed late fee with interest capped at 3% above the Bank of England base rate after 14 days, as the law allows" },
];

export function splitClauses(text: string): { num: string; text: string }[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: { num: string; text: string }[] = [];
  lines.forEach((l, i) => {
    const m = l.match(/^(?:clause\s*)?(\d+(?:\.\d+)?)[.):\s-]+(.*)$/i);
    if (m) out.push({ num: m[1]!, text: m[2]! });
    else if (l.length > 25) out.push({ num: String(i + 1), text: l });
  });
  return out;
}

export function scan(text: string): ScanResult {
  const clauses = splitClauses(text);
  const flags: Flag[] = [];
  let illegalFees = 0, unenforceable = 0;
  for (const c of clauses) {
    for (const r of RULES) {
      if (!r.test.test(c.text)) continue;
      const fee = r.fee ? Number(c.text.match(/£\s?(\d+)/)?.[1] ?? 0) : 0;
      illegalFees += fee;
      if (r.unenforceable) unenforceable++;
      flags.push({ id: `${r.id}-${c.num}`, clause: c.num, label: r.label, severity: r.severity, text: c.text, statute: r.statute, explain: r.explain, fee, ask: r.ask });
      break;
    }
  }
  const raw = flags.reduce((s, f) => s + (f.severity === "red" ? 22 : 13), 0) + Math.min(15, illegalFees / 25);
  const score = flags.length ? Math.min(99, Math.round(raw + 8)) : 6;
  return { clauses: clauses.length, flags, score, illegalFees, unenforceable };
}

export function buildEmail(flags: Flag[], address = "the property"): string {
  const items = flags.map((f) => `• Clause ${f.clause}: I'd ask that you ${f.ask}.\n  (${f.statute.split(" — ")[0]})`).join("\n\n");
  return `Subject: Requested amendments to tenancy agreement — ${address}

Dear Letting Agent,

Thank you for sending the draft assured shorthold tenancy agreement for ${address}. Before signing, I have reviewed it and would like to raise ${flags.length === 1 ? "one clause" : `${flags.length} clauses`} that appear to conflict with English housing law:

${items}

I'm keen to go ahead with the tenancy and would be grateful if you could send an amended agreement reflecting these points. Please let me know if you'd like to discuss any of them.

Kind regards,
[Your name]
[Phone number]`;
}
