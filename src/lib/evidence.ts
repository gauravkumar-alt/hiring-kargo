import type { CriterionKey } from "./rubric";
import type { CriterionScore } from "./types";

export interface EvidenceMark {
  start: number;
  end: number;
  keys: CriterionKey[];
}

const TOKEN = /[a-z0-9%₹$]+/gi;

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find where each criterion's quote sits in the CV text. Quotes were verified with punctuation and
 * whitespace ignored, so match the same way: same words in order, anything non-alphanumeric between.
 * Criteria that share a quote are merged into one mark.
 */
export function findEvidence(text: string, criteria: CriterionScore[]): EvidenceMark[] {
  const marks: EvidenceMark[] = [];
  for (const c of criteria) {
    if (!c.evidence || c.quoteUnverified) continue;
    for (const part of c.evidence.split(/\.\.\.|…/)) {
      const tokens = part.match(TOKEN);
      if (!tokens?.length) continue;
      const m = new RegExp(tokens.map(esc).join("[^a-z0-9%₹$]+"), "i").exec(text);
      if (m) marks.push({ start: m.index, end: m.index + m[0].length, keys: [c.key] });
    }
  }
  marks.sort((a, b) => a.start - b.start);
  const merged: EvidenceMark[] = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end);
      for (const k of m.keys) if (!last.keys.includes(k)) last.keys.push(k);
    } else merged.push({ ...m, keys: [...m.keys] });
  }
  return merged;
}
