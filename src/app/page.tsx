"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { CandidateList } from "@/components/CandidateList";
import { Pipeline } from "@/components/Pipeline";
import { Uploader } from "@/components/Uploader";
import { gsap, useGSAP } from "@/components/gsap";
import { DECISION_HEX, Icon } from "@/components/ui";
import { CRITERIA, CRITERION_NAME, type Decision } from "@/lib/rubric";
import { sampleCandidates } from "@/lib/sample";
import type { Candidate } from "@/lib/types";
import { effectiveDecision, useCandidates } from "@/lib/useCandidates";

interface Status {
  ai: boolean;
  email: boolean;
  db: boolean;
  sender: string;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Stat({ label, value, color, sub }: { label: string; value: number; color?: string; sub?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  useGSAP(
    () => {
      const el = ref.current!.querySelector(".stat-num")!;
      const o = { v: shown.current };
      gsap.to(o, {
        v: value,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = String(Math.round(o.v));
        },
      });
      shown.current = value;
    },
    { dependencies: [value], scope: ref }
  );
  return (
    <div ref={ref} className="stat card relative overflow-hidden px-5 py-4">
      {color && <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />}
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </div>
      <div className="stat-num num mt-1 text-3xl font-bold tracking-tight">0</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function toCsv(cs: Candidate[]) {
  const head = ["Name", "Email", "Role", "Score", "Other role score", "Rubric call", "Your call", ...CRITERIA.map((k) => CRITERION_NAME[k]), "Reasons", "Email sent"];
  const rows = cs.map((c) => {
    const r = c.result!;
    const other = c.role === "PM" ? "SPM" : "PM";
    return [
      c.extract?.contact.name,
      c.extract?.contact.email,
      c.role,
      r.scores[c.role].total,
      r.scores[other].total,
      r.decision,
      effectiveDecision(c),
      ...r.scores[c.role].criteria.map((x) => `${x.score}${x.notEvidenced ? " (not evidenced)" : ""}`),
      r.reasons.join("; "),
      c.sentAt ? new Date(c.sentAt).toISOString() : "",
    ];
  });
  return [head, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

export default function Home() {
  const store = useCandidates();
  const { candidates } = store;
  const [status, setStatus] = useState<Status | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ai: false, email: false, db: false, sender: "Arjun" }));
  }, []);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".nav-in", { opacity: 0, y: -10, duration: 0.5 })
        .from(".hero-line", { opacity: 0, y: 24, duration: 0.8, stagger: 0.08 }, "-=0.2")
        .from(".stat", { opacity: 0, y: 18, duration: 0.6, stagger: 0.07 }, "-=0.5")
        .from(".work-in", { opacity: 0, y: 18, duration: 0.6, stagger: 0.1 }, "-=0.4");
      gsap.to(".blob", { x: "random(-40,40)", y: "random(-30,30)", duration: 9, ease: "sine.inOut", repeat: -1, yoyo: true, repeatRefresh: true });
    },
    { scope: root }
  );

  const done = useMemo(() => candidates.filter((c) => c.stage === "done" && c.result), [candidates]);
  const inflight = useMemo(() => candidates.filter((c) => c.stage !== "done"), [candidates]);
  const count = (d: Decision) => done.filter((c) => effectiveDecision(c) === d).length;
  const sent = done.filter((c) => c.sentAt).length;
  const open = candidates.find((c) => c.id === openId && c.result);
  const hasSamples = candidates.some((c) => c.sample);

  const exportCsv = () => {
    const blob = new Blob([toCsv(done)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kargo-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div ref={root} className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="blob absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#dfe2fb] opacity-60 blur-3xl" />
        <div className="blob absolute left-[-6rem] top-64 h-64 w-64 rounded-full bg-[#fde3d6] opacity-60 blur-3xl" />
      </div>

      <nav className="nav-in mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-coral text-sm font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(79,85,216,0.7)]">
            K
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">Kargo</div>
            <div className="text-[11px] font-medium text-muted">Hiring desk</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <div className="hidden items-center gap-3 rounded-full bg-white/70 px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line sm:flex">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${status.ai ? "bg-advance" : "bg-pass"}`} /> AI {status.ai ? "on" : "key missing"}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${status.email ? "bg-advance" : "bg-hold"}`} /> Email {status.email ? "on" : "not set up"}
              </span>
              <span className="flex items-center gap-1.5" title={store.mode === "db" ? "Candidates are stored in Supabase" : "Candidates are stored in this browser only"}>
                <span className={`h-1.5 w-1.5 rounded-full ${store.saveError ? "bg-pass" : store.mode === "db" ? "bg-advance" : "bg-hold"}`} />
                {store.mode === "db" ? (store.saveError ? "Not saved" : store.saving ? "Saving…" : "Saved to Supabase") : "Browser only"}
              </span>
            </div>
          )}
          {done.length > 0 && (
            <button type="button" className="btn btn-ghost !py-1.5 !text-xs" onClick={exportCsv}>
              <Icon name="download" className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        {store.saveError && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-pass-soft px-4 py-3 text-sm text-pass">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            Supabase: {store.saveError}. Your latest changes will retry on the next edit.
          </div>
        )}
        <section className="pb-8 pt-6 sm:pt-10">
          <p className="hero-line text-sm font-semibold text-accent">
            {greeting()}, {status?.sender ?? "Arjun"}
          </p>
          <h1 className="hero-line mt-2 max-w-3xl text-[2.1rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Every CV read against the rubric.{" "}
            <span className="bg-gradient-to-r from-accent to-coral bg-clip-text text-transparent">Every call still yours.</span>
          </h1>
          <p className="hero-line mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Upload PM and SPM CVs. Each one is scored on the eight Kargo criteria, and every score is backed by a quote from the CV. You also get an
            interview brief and a draft email. Nothing is sent until you click send.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          <Stat label="Screened" value={done.length} sub={`${inflight.filter((c) => c.stage !== "error").length} in progress`} />
          <Stat label="Advance" value={count("ADVANCE")} color={DECISION_HEX.ADVANCE} sub="75 and above" />
          <Stat label="Hold" value={count("HOLD")} color={DECISION_HEX.HOLD} sub="55–74 or a hold rule" />
          <Stat label="Pass" value={count("PASS")} color={DECISION_HEX.PASS} sub="Below 55" />
          <Stat label="Flagged" value={count("FLAG")} color={DECISION_HEX.FLAG} sub={`${sent} email${sent === 1 ? "" : "s"} sent`} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="work-in">
            <Uploader onSubmit={store.addFiles} aiReady={status?.ai ?? false} />
            {status && !status.ai && (
              <p className="mt-3 rounded-2xl bg-hold-soft px-4 py-3 text-sm text-hold">
                Add <code className="font-semibold">GEMINI_API_KEY</code> to <code className="font-semibold">.env.local</code> and restart to score real CVs. You can
                still explore with sample candidates.
              </p>
            )}
          </div>
          <div className="work-in space-y-6">
            <Pipeline items={inflight} onRetry={store.retry} onRemove={store.remove} />
            {!inflight.length && (
              <div className="card flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">How each CV is handled</h2>
                  <ol className="mt-3 space-y-2.5 text-sm text-ink-2">
                    {[
                      ["bg-lane-system", "Text is extracted. Name, contact details, address, age and education are stripped out."],
                      ["bg-lane-ai", "AI scores both PM and SPM rubrics. A score only counts if its quote is actually in the CV."],
                      ["bg-lane-email", "Hold and flag rules apply, then an interview brief and a draft email are written."],
                      ["bg-lane-founder", "You review, change the call if needed, and send through Resend."],
                    ].map(([lane, text], i) => (
                      <li key={i} className="flex gap-3">
                        <span className={`num grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-ink-2 ${lane}`}>{i + 1}</span>
                        <span className="leading-relaxed">{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                {!hasSamples && (
                  <button
                    type="button"
                    className="btn btn-ghost self-start"
                    onClick={() => store.replaceAll([...candidates, ...sampleCandidates()])}
                  >
                    <Icon name="eye" /> Load sample candidates
                  </button>
                )}
                {hasSamples && (
                  <button type="button" className="btn btn-ghost self-start" onClick={() => store.replaceAll(candidates.filter((c) => !c.sample))}>
                    <Icon name="x" /> Clear samples
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="mt-6">
          {done.length > 0 ? (
            <CandidateList items={done} onOpen={setOpenId} />
          ) : (
            <div className="card grid place-items-center px-6 py-16 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-lane-founder text-accent">
                <Icon name="sparkle" className="h-5 w-5" />
              </div>
              <h3 className="font-bold">Your ranked shortlist will appear here</h3>
              <p className="mt-1 max-w-sm text-sm text-muted">Add a few CVs above, or load the sample candidates to see how it works.</p>
            </div>
          )}
        </div>
      </main>

      {open && (
        <CandidateDrawer
          key={open.id}
          c={open}
          onClose={() => setOpenId(null)}
          onPatch={(p) => store.patch(open.id, p)}
          onDraft={(kind) => store.draftEmail(open.id, kind)}
          onSend={(to, subject, body, kind) => store.send(open.id, to, subject, body, kind)}
          onRemove={() => store.remove(open.id)}
          emailReady={status?.email ?? false}
          sender={status?.sender ?? "Arjun"}
        />
      )}
    </div>
  );
}
