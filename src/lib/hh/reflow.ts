// Browser-safe PDF/OCR line reflow; preserve labelled personal details for the privacy check.
const NUMBERED = /^(?:clause\s*)?\d+(?:\.\d+)*[.):\s-]/i;

/** PDF and OCR text is wrapped mid-sentence; rejoin wrapped lines so each clause is one line for the scanner. */
export function reflow(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const numbered = lines.some((l) => NUMBERED.test(l));
  const out: string[] = [];
  let open = false; // the previous line is still being continued
  for (const l of lines) {
    if (!l) { open = false; continue; }
    const field = /^(?:(?:lead |joint )?tenants?|landlords?|guarantors?|witness|(?:full |printed )?name|signed(?: by)?|(?:home |permanent |property |correspondence |current |contact )?address|e-?mail|tel(?:ephone)?|phone|mobile|date of birth|student (?:id|number))\b[^:—–]*[:—–]/i.test(l);
    const startsNew = NUMBERED.test(l) || field || !open;
    if (startsNew) out.push(l); else out[out.length - 1] += " " + l;
    // In numbered contracts a clause runs until the next number; otherwise until the sentence ends.
    open = !field && (numbered ? true : !/[.;:!?]$/.test(l));
  }
  return out.join("\n");
}

