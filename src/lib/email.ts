import type { Decision } from "./rubric";
import type { Candidate, EmailDraft, EmailKind } from "./types";

/** Advance gets an interview invite; hold, pass and flag get a rejection draft. Nothing is sent without a click. */
export function emailKindFor(decision: Decision): EmailKind {
  return decision === "ADVANCE" ? "invite" : "rejection";
}

/** The saved draft of a given kind. `email` is the older single-draft field, still read for existing records. */
export function draftFor(c: Candidate, kind: EmailKind): EmailDraft | undefined {
  return c.drafts?.[kind] ?? (c.email?.kind === kind ? c.email : undefined);
}

/** Patch that stores a draft under its kind without discarding the other one. */
export function withDraft(c: Pick<Candidate, "drafts" | "email">, draft: EmailDraft): Pick<Candidate, "email" | "drafts"> {
  // Older records only have `email`; carry it into `drafts` so drafting the other kind doesn't replace it.
  const legacy = c.email && !c.drafts?.[c.email.kind] ? { [c.email.kind]: c.email } : {};
  return { email: draft, drafts: { ...legacy, ...c.drafts, [draft.kind]: draft } };
}
