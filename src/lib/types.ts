import type { CriterionKey, Decision, Role } from "./rubric";

export interface Contact {
  name: string;
  email: string;
  phone: string;
}

/** Output of the extract step: the contact details stay with the system, only `redactedText` goes to AI. */
export interface ExtractResult {
  contact: Contact;
  redactedText: string;
  redactions: string[]; // human-readable list of what was removed, e.g. "Email", "Education section"
  wordCount: number;
}

export interface CriterionScore {
  key: CriterionKey;
  score: number; // 1-5, after verification
  aiScore: number; // what the model proposed, before verification
  evidence: string; // verbatim CV quote, under 15 words
  rationale: string;
  notEvidenced: boolean; // no evidence -> score 1, kept distinct from "disproven"
  quoteUnverified: boolean; // model gave a quote that isn't in the CV -> treated as not evidenced
}

export interface RoleScore {
  role: Role;
  total: number; // 0-100
  criteria: CriterionScore[];
  band: Exclude<Decision, "FLAG">;
}

export interface Signals {
  pmYears: number | null;
  relocationStated: boolean;
  relocationEvidence: string;
  readable: boolean;
  dateIssues: string[];
  shortStints: number;
  summary: string;
}

export interface ScoreResult {
  scores: Record<Role, RoleScore>;
  signals: Signals;
  decision: Decision; // recommendation for the applied role
  reasons: string[]; // why the decision differs from the plain band, if it does
}

export interface Brief {
  headline: string;
  strengths: string[];
  risks: string[];
  questions: { criterion: string; question: string; listenFor: string }[];
  verify: string[];
}

export type EmailKind = "invite" | "rejection";

export interface EmailDraft {
  kind: EmailKind;
  subject: string;
  body: string;
}

export type Stage = "queued" | "extract" | "score" | "draft" | "done" | "error";

export interface Candidate {
  id: string;
  fileName: string;
  cvPath?: string; // original file in Supabase Storage
  role: Role;
  addedAt: number;
  stage: Stage;
  error?: string;
  extract?: ExtractResult;
  result?: ScoreResult;
  brief?: Brief;
  email?: EmailDraft; // most recently drafted email (kept for older records)
  drafts?: Partial<Record<EmailKind, EmailDraft>>; // invite and rejection kept separately
  override?: Exclude<Decision, "FLAG">; // founder's final call
  note?: string; // founder's reason for the call
  reviewedAt?: number; // when the founder made a call in triage
  sentAt?: number;
  sentKind?: EmailKind;
  sample?: boolean;
}
