import "server-only";
import type { Role } from "../rubric";
import type { Candidate } from "../types";
import { CV_BUCKET, supabaseAdmin } from "./server";

const TABLE = "kargo_candidates";

function toRow(c: Candidate) {
  const other: Role = c.role === "PM" ? "SPM" : "PM";
  return {
    id: c.id,
    name: c.extract?.contact.name ?? null,
    email: c.extract?.contact.email || null,
    role: c.role,
    stage: c.stage,
    score: c.result?.scores[c.role].total ?? null,
    other_score: c.result?.scores[other].total ?? null,
    rubric_decision: c.result?.decision ?? null,
    final_decision: c.override ?? c.result?.decision ?? null,
    file_name: c.fileName,
    cv_path: c.cvPath ?? null,
    sent_at: c.sentAt ? new Date(c.sentAt).toISOString() : null,
    sent_kind: c.sentKind ?? null,
    data: c,
    created_at: new Date(c.addedAt).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function listCandidates(): Promise<Candidate[]> {
  const { data, error } = await supabaseAdmin().from(TABLE).select("data").order("created_at", { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.data as Candidate);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const { data, error } = await supabaseAdmin().from(TABLE).select("data").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.data as Candidate) ?? null;
}

export async function saveCandidate(c: Candidate) {
  const { error } = await supabaseAdmin().from(TABLE).upsert(toRow(c));
  if (error) throw new Error(error.message);
}

export async function deleteCandidate(id: string) {
  const db = supabaseAdmin();
  const c = await getCandidate(id);
  if (c?.cvPath) await db.storage.from(CV_BUCKET).remove([c.cvPath]);
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadCv(id: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const path = `${id}/${safe}`;
  const { error } = await supabaseAdmin()
    .storage.from(CV_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
  if (error) throw new Error(`Couldn't store the CV file: ${error.message}`);
  return path;
}

export async function cvSignedUrl(path: string) {
  const { data, error } = await supabaseAdmin().storage.from(CV_BUCKET).createSignedUrl(path, 60 * 5);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Record a sent email on the server, so it's logged even if the browser closes right after. */
export async function recordSend(
  id: string,
  log: { to: string; kind: string; subject: string; body: string; resendId?: string }
) {
  const db = supabaseAdmin();
  const now = Date.now();
  const c = await getCandidate(id);
  if (c) await saveCandidate({ ...c, sentAt: now, sentKind: log.kind as Candidate["sentKind"] });
  const { error } = await db.from("kargo_email_log").insert({
    candidate_id: c ? id : null,
    to_email: log.to,
    kind: log.kind,
    subject: log.subject,
    body: log.body,
    resend_id: log.resendId ?? null,
  });
  if (error) console.error("email log insert failed:", error.message);
}
