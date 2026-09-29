"use client";

import { useEffect, useState } from "react";
import { CRITERION_NAME, DECISION_LABEL, ROLE_LABEL, WEIGHTS, type Decision, type Role } from "@/lib/rubric";
import { templateEmail } from "@/lib/templates";
import type { Candidate, EmailKind } from "@/lib/types";
import { Icon } from "./ui";

export interface EmailProps {
  c: Candidate;
  decision: Decision;
  onPatch: (p: Partial<Candidate>) => void;
  onDraft: (kind: EmailKind) => Promise<unknown>;
  onSend: (to: string, subject: string, body: string, kind: EmailKind) => Promise<void>;
  emailReady: boolean;
  sender: string;
}

function Dots({ score, muted }: { score: number; muted?: boolean }) {
  return (
    <span className="flex gap-1" aria-label={`${score} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`dot h-2 w-2 rounded-full ${i <= score ? (muted ? "bg-muted/50" : "bg-accent") : "bg-line"}`} />
      ))}
    </span>
  );
}

export function Scores({ c }: { c: Candidate }) {
  const r = c.result!;
  const role = c.role;
  const other: Role = role === "PM" ? "SPM" : "PM";
  const s = r.signals;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["PM experience", s.pmYears === null ? "Unclear" : `${s.pmYears} yrs`],
          ["Mumbai / relocation", s.relocationStated ? "Stated" : "Not stated"],
          ["Short stints", s.shortStints ? `${s.shortStints} unexplained` : "None"],
        ].map(([k, v]) => (
          <div key={k} className="fade-item rounded-xl bg-paper px-3 py-2.5">
            <div className="text-[11px] text-muted">{k}</div>
            <div className="text-sm font-semibold">{v}</div>
          </div>
        ))}
      </div>

      <ul className="space-y-2.5">
        {r.scores[role].criteria.map((x) => {
          const w = WEIGHTS[role][x.key];
          const pts = (x.score / 5) * w;
          return (
            <li key={x.key} className="fade-item rounded-2xl border border-line-2 p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{CRITERION_NAME[x.key]}</span>
                    <span className="rounded-md bg-line-2 px-1.5 py-0.5 text-[10px] font-bold text-muted">weight {w}</span>
                    {x.notEvidenced && (
                      <span className="rounded-md bg-hold-soft px-1.5 py-0.5 text-[10px] font-bold text-hold">
                        {x.quoteUnverified ? `Quote not found in CV · AI said ${x.aiScore}` : "Not evidenced"}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Dots score={x.score} muted={x.notEvidenced} />
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-2">
                      <div className="crit-bar h-full rounded-full bg-gradient-to-r from-accent to-[#8b8ff0]" style={{ width: `${(pts / w) * 100}%` }} />
                    </div>
                    <span className="num w-12 text-right text-xs font-semibold text-ink-2">
                      {Number.isInteger(pts) ? pts : pts.toFixed(1)}/{w}
                    </span>
                  </div>
                </div>
              </div>
              {x.evidence && !x.quoteUnverified && (
                <blockquote className="mt-3 flex gap-2 rounded-xl bg-lane-founder/60 px-3 py-2 text-sm italic text-ink">
                  <Icon name="quote" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  {x.evidence}
                </blockquote>
              )}
              {x.rationale && <p className="mt-2 text-xs leading-relaxed text-muted">{x.rationale}</p>}
            </li>
          );
        })}
      </ul>

      <div className="fade-item flex items-center justify-between rounded-2xl bg-paper px-4 py-3 text-sm">
        <span className="text-ink-2">
          Same CV scored as <b>{ROLE_LABEL[other]}</b>
        </span>
        <span className="num font-bold">{r.scores[other].total}/100</span>
      </div>
    </div>
  );
}

export function Brief({ c }: { c: Candidate }) {
  const b = c.brief;
  const [copied, setCopied] = useState(false);
  if (!b) return <p className="py-10 text-center text-sm text-muted">No brief yet.</p>;

  const copy = () => {
    const text = [
      b.headline,
      "",
      "Strengths",
      ...b.strengths.map((s) => `- ${s}`),
      "",
      "Risks",
      ...b.risks.map((s) => `- ${s}`),
      "",
      "Questions",
      ...b.questions.map((q, i) => `${i + 1}. [${q.criterion}] ${q.question}\n   Listen for: ${q.listenFor}`),
      "",
      "Verify",
      ...b.verify.map((s) => `- ${s}`),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-5">
      <div className="fade-item rounded-2xl bg-gradient-to-br from-lane-founder to-lane-ai/60 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent">In one line</span>
          <button type="button" onClick={copy} className="text-xs font-semibold text-ink-2 hover:text-ink">
            {copied ? "Copied" : "Copy brief"}
          </button>
        </div>
        <p className="text-[15px] font-medium leading-relaxed">{b.headline}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="fade-item rounded-2xl border border-line-2 p-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-advance">Strengths</h4>
          <ul className="space-y-2 text-sm leading-relaxed text-ink-2">
            {b.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-advance" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="fade-item rounded-2xl border border-line-2 p-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-pass">Risks & unknowns</h4>
          <ul className="space-y-2 text-sm leading-relaxed text-ink-2">
            {b.risks.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pass" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h4 className="fade-item mb-2 text-xs font-bold uppercase tracking-wider text-muted">Questions to ask</h4>
        <ol className="space-y-2">
          {b.questions.map((q, i) => (
            <li key={i} className="fade-item rounded-2xl border border-line-2 p-4">
              <div className="flex gap-3">
                <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-accent">{q.criterion}</span>
                  <p className="mt-0.5 text-sm font-medium leading-relaxed">{q.question}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    <b className="text-ink-2">Listen for:</b> {q.listenFor}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {b.verify.length > 0 && (
        <div className="fade-item rounded-2xl bg-hold-soft/70 p-4">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-hold">Verify</h4>
          <ul className="space-y-1.5 text-sm text-ink-2">
            {b.verify.map((v) => (
              <li key={v}>· {v}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Email({ c, decision, onPatch, onDraft, onSend, emailReady, sender }: EmailProps) {
  const suggested: EmailKind = decision === "PASS" ? "rejection" : "invite";
  const [kind, setKind] = useState<EmailKind>(c.email?.kind ?? suggested);
  const [to, setTo] = useState(c.extract?.contact.email ?? "");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const draft = c.email?.kind === kind ? c.email : undefined;
  const mismatch = (kind === "invite" && decision === "PASS") || (kind === "rejection" && decision === "ADVANCE");

  useEffect(() => setConfirming(false), [kind]);

  const generate = async () => {
    setError("");
    if (c.sample) {
      onPatch({ email: templateEmail(c, kind, sender) });
      return;
    }
    setBusy("draft");
    try {
      await onDraft(kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draft the email");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!draft) return;
    setBusy("send");
    setError("");
    try {
      await onSend(to.trim(), draft.subject, draft.body, kind);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send");
    } finally {
      setBusy(null);
    }
  };

  const edit = (p: { subject?: string; body?: string }) => draft && onPatch({ email: { ...draft, ...p } });

  return (
    <div className="space-y-4">
      {c.sentAt && (
        <div className="fade-item flex items-center gap-2 rounded-2xl bg-advance-soft px-4 py-3 text-sm font-medium text-advance">
          <Icon name="check" />
          {c.sentKind === "invite" ? "Invite" : "Rejection"} sent {new Date(c.sentAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </div>
      )}

      <div className="fade-item flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-line-2 p-0.5">
          {(["invite", "rejection"] as EmailKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${kind === k ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink-2"}`}
            >
              {k === "invite" ? "Interview invite" : "Rejection"}
            </button>
          ))}
        </div>
        {draft && (
          <button type="button" className="btn btn-ghost !py-1.5 !text-xs" onClick={generate} disabled={!!busy}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> {busy === "draft" ? "Drafting…" : "Redraft"}
          </button>
        )}
      </div>

      {mismatch && (
        <p className="fade-item rounded-xl bg-hold-soft px-3 py-2 text-xs text-hold">
          Heads up: the current call is <b>{DECISION_LABEL[decision]}</b>, but this is a{kind === "invite" ? "n invite" : " rejection"}.
        </p>
      )}

      {!draft ? (
        <div className="fade-item rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="mb-3 text-sm text-muted">
            {decision === "HOLD" || decision === "FLAG" ? "This one's on hold, so nothing was drafted automatically. Make your call first." : "No draft yet."}
          </p>
          <button type="button" className="btn btn-accent" onClick={generate} disabled={!!busy}>
            <Icon name="sparkle" /> {busy === "draft" ? "Drafting…" : `Draft ${kind === "invite" ? "invite" : "rejection"}`}
          </button>
        </div>
      ) : (
        <div className="fade-item overflow-hidden rounded-2xl border border-line">
          <label className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 text-sm">
            <span className="w-14 text-muted">To</span>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="candidate@email.com" className="flex-1 bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-3 border-b border-line-2 px-4 py-2.5 text-sm">
            <span className="w-14 text-muted">Subject</span>
            <input value={draft.subject} onChange={(e) => edit({ subject: e.target.value })} className="flex-1 bg-transparent font-medium outline-none" />
          </label>
          <textarea
            value={draft.body}
            onChange={(e) => edit({ body: e.target.value })}
            rows={13}
            className="scroll-thin block w-full resize-y bg-white px-4 py-3 text-sm leading-relaxed outline-none"
          />
        </div>
      )}

      {error && <p className="rounded-xl bg-pass-soft px-3 py-2 text-sm text-pass">{error}</p>}

      {draft && (
        <div className="fade-item flex flex-wrap items-center justify-end gap-2">
          {!emailReady && <span className="mr-auto text-xs text-muted">Add RESEND_API_KEY and FROM_EMAIL to send.</span>}
          {confirming ? (
            <>
              <span className="mr-auto text-sm text-ink-2">
                Send to <b>{to}</b>? This can't be unsent.
              </span>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={busy === "send"}>
                <Icon name="send" /> {busy === "send" ? "Sending…" : "Yes, send"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirming(true)}
              disabled={!emailReady || !/^\S+@\S+\.\S+$/.test(to.trim()) || c.sample}
              title={c.sample ? "Sample candidates can't be emailed" : ""}
            >
              <Icon name="send" /> {c.sentAt ? "Send again" : "Send via Resend"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
