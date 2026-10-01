"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { CandidateList, ListSkeleton, type RoleFilter } from "@/components/CandidateList";
import { Pipeline } from "@/components/Pipeline";
import { Toast, type ToastData } from "@/components/Toast";
import { Uploader } from "@/components/Uploader";
import { Flip, gsap, SplitText, useGSAP } from "@/components/gsap";
import { DECISION_HEX, Icon, Magnetic } from "@/components/ui";
import { CRITERIA, CRITERION_NAME, DECISION_LABEL, type Decision } from "@/lib/rubric";
import { sampleCandidates } from "@/lib/sample";
import type { Candidate } from "@/lib/types";
import { effectiveDecision, useCandidates } from "@/lib/useCandidates";

interface Status {
  ai: boolean;
  email: boolean;
  db: boolean;
  emailTestInbox?: string | null;
  sender: string;
}

type Call = Exclude<Decision, "FLAG">;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Stat({
  label,
  value,
  color,
  sub,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color?: string;
  sub?: string;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const shown = useRef(0);
  useGSAP(
    () => {
      const el = ref.current!.querySelector(".stat-num")!;
      const changed = shown.current !== value && shown.current !== 0;
      const o = { v: shown.current };
      gsap.to(o, { v: value, duration: 0.9, ease: "power2.out", onUpdate: () => (el.textContent = String(Math.round(o.v))) });
      if (changed) gsap.fromTo(ref.current, { scale: 1.045 }, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" });
      shown.current = value;
    },
    { dependencies: [value], scope: ref }
  );
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`stat card relative overflow-hidden px-5 py-4 text-left transition-shadow hover:shadow-[0_14px_30px_-16px_rgba(23,25,30,0.35)] ${active ? "outline outline-2 outline-offset-0 outline-ink" : ""}`}
    >
      {color && <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />}
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
        {active && <Icon name="check" className="ml-auto h-3.5 w-3.5 text-ink" />}
      </div>
      <div className="stat-num num mt-1 text-3xl font-bold tracking-tight">0</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </button>
  );
}

function toCsv(cs: Candidate[]) {
  const head = ["Name", "Email", "Role", "Score", "Other role score", "Rubric call", "Your call", "Your note", "Reviewed", ...CRITERIA.map((k) => CRITERION_NAME[k]), "Reasons", "Email sent"];
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
      c.note ?? "",
      c.reviewedAt ? new Date(c.reviewedAt).toISOString() : "",
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
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [decisionFilter, setDecisionFilter] = useState<Decision | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const undo = useRef<{ id: string; prev: Pick<Candidate, "override" | "reviewedAt"> } | null>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const stages = useRef(new Map<string, string>());
  const root = useRef<HTMLDivElement>(null);
  const heroBig = useRef<HTMLDivElement>(null);
  const heroReady = useRef(false);

  // Re-checked whenever the tab regains focus, so a tab left open across a deploy doesn't keep stale settings.
  useEffect(() => {
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus((s) => s ?? { ai: false, email: false, db: false, sender: "Arjun" }));
    load();
    const onFocus = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const notify = useCallback((t: Omit<ToastData, "id">) => setToast({ ...t, id: Date.now() + Math.random() }), []);

  /* ------------------------------------------------------------ derived lists */

  const done = useMemo(() => candidates.filter((c) => c.stage === "done" && c.result), [candidates]);
  const inflight = useMemo(() => candidates.filter((c) => c.stage !== "done"), [candidates]);
  const byRole = useMemo(() => done.filter((c) => role === "ALL" || c.role === role), [done, role]);
  const shown = useMemo(
    () =>
      byRole
        .filter((c) => !decisionFilter || effectiveDecision(c) === decisionFilter)
        .sort((a, b) => b.result!.scores[b.role].total - a.result!.scores[a.role].total || b.addedAt - a.addedAt),
    [byRole, decisionFilter]
  );
  const order = shown.map((c) => c.id);
  const count = (d: Decision) => byRole.filter((c) => effectiveDecision(c) === d).length;
  const open = candidates.find((c) => c.id === openId && c.result);
  const openIndex = openId ? order.indexOf(openId) : -1;
  const hasSamples = candidates.some((c) => c.sample);
  const loading = store.mode === "loading";
  const firstUse = !loading && candidates.length === 0;
  const compact = !loading && done.length > 0;

  /** Capture row positions before a change so the list can Flip into its new order. */
  const withFlip = (fn: () => void) => {
    flipState.current = Flip.getState(".cand-row");
    fn();
  };

  /* ------------------------------------------------------------ motion */

  useGSAP(
    () => {
      const tl = gsap.timeline();
      tl.from(".nav-in", { opacity: 0, y: -12, duration: 0.6 })
        .from(".hero-kicker", { opacity: 0, y: 10, duration: 0.5 }, 0.15)
        .from(".stat", { opacity: 0, y: 24, rotateX: -12, transformOrigin: "top", duration: 0.8, stagger: 0.07 }, 0.45)
        .from(".work-in", { opacity: 0, y: 24, duration: 0.8, stagger: 0.12 }, 0.6);

      // Headline reveals line by line from behind a mask.
      SplitText.create(".hero-title", {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) => {
          gsap.set(".hero-title", { autoAlpha: 1 });
          return gsap.from(self.lines, { yPercent: 105, duration: 1.1, stagger: 0.12, ease: "expo.out", delay: 0.2 });
        },
      });
      gsap.from(".hero-copy", { opacity: 0, y: 14, duration: 0.8, delay: 0.55 });

      gsap.to(".blob-a", { x: "random(-60,60)", y: "random(-40,40)", duration: 10, ease: "sine.inOut", repeat: -1, yoyo: true, repeatRefresh: true });
      gsap.to(".blob-b", { x: "random(-50,50)", y: "random(-50,50)", duration: 12, ease: "sine.inOut", repeat: -1, yoyo: true, repeatRefresh: true });
      gsap.to(".blob-a, .blob-b", { yPercent: 40, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 1 } });
    },
    { scope: root }
  );

  // Once there's a shortlist, the big welcome folds away so the list sits near the top.
  useGSAP(
    () => {
      if (loading || !heroBig.current) return;
      const target = compact ? { height: 0, opacity: 0, marginTop: 0 } : { height: "auto", opacity: 1, marginTop: 8 };
      if (!heroReady.current) {
        heroReady.current = true;
        gsap.set(heroBig.current, target);
      } else gsap.to(heroBig.current, { ...target, duration: 0.8, ease: "power3.inOut" });
    },
    { dependencies: [compact, loading] }
  );

  /* ------------------------------------------------------------ toasts for finished CVs */

  useEffect(() => {
    for (const c of candidates) {
      const prev = stages.current.get(c.id);
      if (prev && prev !== "done" && c.stage === "done" && c.result) {
        notify({
          message: `${c.extract?.contact.name ?? "Candidate"} scored ${c.result.scores[c.role].total} · ${DECISION_LABEL[c.result.decision]}`,
          tone: "success",
          action: { label: "Open", onClick: () => setOpenId(c.id) },
        });
      }
      stages.current.set(c.id, c.stage);
    }
  }, [candidates, notify]);

  /* ------------------------------------------------------------ triage */

  const startReview = () => {
    const next = shown.find((c) => !c.reviewedAt) ?? shown[0];
    if (next) setOpenId(next.id);
  };

  const decide = (d: Call): string | null => {
    if (!open) return null;
    const ai = open.result!.decision;
    undo.current = { id: open.id, prev: { override: open.override, reviewedAt: open.reviewedAt } };
    const next = openIndex >= 0 ? (order[openIndex + 1] ?? null) : null;
    withFlip(() => store.patch(open.id, { override: d === ai ? undefined : d, reviewedAt: Date.now() }));
    notify({
      message: `${open.extract?.contact.name.split(" ")[0]} → ${DECISION_LABEL[d]}`,
      action: { label: "Undo", hint: "Z", onClick: doUndo },
    });
    return next;
  };

  function doUndo() {
    const u = undo.current;
    if (!u) return;
    undo.current = null;
    withFlip(() => store.patch(u.id, u.prev));
    setOpenId(u.id);
    notify({ message: "Call undone" });
  }

  // "R" starts a review from the dashboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (openId || e.metaKey || e.ctrlKey || t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key.toLowerCase() === "r" && shown.length) startReview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const filterBy = (d: Decision | null) => {
    withFlip(() => setDecisionFilter((cur) => (cur === d ? null : d)));
    const el = document.getElementById("ranked");
    if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) gsap.to(window, { scrollTo: { y: el, offsetY: 16 }, duration: 0.8 });
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(done)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kargo-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ------------------------------------------------------------ render */

  return (
    <div ref={root} className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="blob-a absolute -right-24 top-10 h-80 w-80 rounded-full bg-[#dfe2fb] opacity-70 blur-3xl" />
        <div className="blob-b absolute left-[-6rem] top-72 h-72 w-72 rounded-full bg-[#fde3d6] opacity-70 blur-3xl" />
      </div>

      <nav className="nav-in mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-coral text-sm font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(79,85,216,0.7)]">K</span>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">Kargo</div>
            <div className="text-[11px] font-medium text-muted">Hiring desk</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <div
              className="hidden items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs text-ink-2 ring-1 ring-line sm:flex"
              title={`Scoring ${status.ai ? "on" : "off"} · Email ${status.email ? "on" : "off"} · ${store.mode === "db" ? "Saved online" : "Saved in this browser"}`}
            >
              {store.saveError ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-pass" /> Changes not saved
                </>
              ) : !status.ai ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-pass" /> Scoring offline
                </>
              ) : !status.email ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-hold" /> Email offline
                </>
              ) : store.saving ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Saving…
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-advance" /> All set
                </>
              )}
            </div>
          )}
          {done.length > 0 && (
            <button type="button" className="btn btn-ghost !py-1.5 !text-xs" onClick={exportCsv}>
              <Icon name="download" className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
        {store.saveError && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-pass-soft px-4 py-3 text-sm text-pass">
            <Icon name="alert" className="h-4 w-4 shrink-0" />
            <span title={store.saveError}>Couldn&apos;t save your latest changes. They&apos;ll retry on your next edit.</span>
          </div>
        )}

        <section className="pb-7 pt-4 sm:pt-8">
          <p className="hero-kicker text-sm font-semibold text-accent">
            {greeting()}, {status?.sender ?? "Arjun"}
            {compact && <span className="font-medium text-muted"> · {shown.filter((c) => !c.reviewedAt).length} waiting for your call</span>}
          </p>
          <div ref={heroBig} className="overflow-hidden">
            <h1 className="hero-title invisible mt-2 max-w-3xl text-[2.1rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Every CV read against the rubric. <span className="bg-gradient-to-r from-accent to-coral bg-clip-text text-transparent">Every call still yours.</span>
            </h1>
            <p className="hero-copy mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">
              Upload PM and SPM CVs to get rubric scores backed by quotes from the CV, an interview brief and a draft email. Nothing is sent until you click send.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 [perspective:800px] sm:grid-cols-5 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
          <Stat label="Screened" value={byRole.length} sub={inflight.some((c) => c.stage !== "error") ? `${inflight.filter((c) => c.stage !== "error").length} in progress` : "All candidates"} active={!decisionFilter && byRole.length > 0} onClick={() => filterBy(null)} />
          <Stat label="Advance" value={count("ADVANCE")} color={DECISION_HEX.ADVANCE} sub="75 and above" active={decisionFilter === "ADVANCE"} onClick={() => filterBy("ADVANCE")} />
          <Stat label="Hold" value={count("HOLD")} color={DECISION_HEX.HOLD} sub="55–74 or a hold rule" active={decisionFilter === "HOLD"} onClick={() => filterBy("HOLD")} />
          <Stat label="Pass" value={count("PASS")} color={DECISION_HEX.PASS} sub="Below 55" active={decisionFilter === "PASS"} onClick={() => filterBy("PASS")} />
          <Stat label="Flagged" value={count("FLAG")} color={DECISION_HEX.FLAG} sub="Dates to check" active={decisionFilter === "FLAG"} onClick={() => filterBy("FLAG")} />
        </section>

        <section className={`mt-6 grid gap-6 ${inflight.length || firstUse ? "lg:grid-cols-[1.1fr_1fr]" : ""}`}>
          <div className="work-in">
            <Uploader onSubmit={store.addFiles} aiReady={status?.ai ?? false} />
            {status && !status.ai && (
              <p className="mt-3 rounded-2xl bg-hold-soft px-4 py-3 text-sm text-hold">
                AI scoring isn&apos;t connected right now, so new CVs can&apos;t be scored. Everything else still works.
              </p>
            )}
          </div>
          <div className="work-in space-y-6">
            <Pipeline items={inflight} onRetry={store.retry} onRemove={store.remove} />
            {firstUse && (
              <div className="card flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">How each CV is handled</h2>
                  <ol className="mt-3 space-y-2.5 text-sm text-ink-2">
                    {[
                      ["bg-lane-system", "Text is extracted. Name, contact details, address, age and education are stripped out."],
                      ["bg-lane-ai", "AI scores both PM and SPM rubrics. A score only counts if its quote is actually in the CV."],
                      ["bg-lane-email", "Hold and flag rules apply, then an interview brief and a draft email are written."],
                      ["bg-lane-founder", "You review with A / H / P, add a note if you like, and send through Resend."],
                    ].map(([lane, text], i) => (
                      <li key={i} className="flex gap-3">
                        <span className={`num grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-ink-2 ${lane}`}>{i + 1}</span>
                        <span className="leading-relaxed">{text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <button type="button" className="btn btn-ghost self-start" onClick={() => store.replaceAll([...candidates, ...sampleCandidates()])}>
                  <Icon name="eye" /> Load sample candidates
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="mt-6">
          {loading ? (
            <ListSkeleton />
          ) : done.length > 0 ? (
            <CandidateList
              items={shown}
              role={role}
              roleCounts={{ ALL: done.length, PM: done.filter((c) => c.role === "PM").length, SPM: done.filter((c) => c.role === "SPM").length }}
              onRole={(r) => withFlip(() => setRole(r))}
              activeId={openId}
              onOpen={setOpenId}
              onStartReview={startReview}
              flipState={flipState}
              filterLabel={decisionFilter ? `${DECISION_LABEL[decisionFilter]} only` : null}
              onClearFilter={() => filterBy(null)}
            />
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

        {hasSamples && (
          <div className="mt-3 flex justify-end">
            <button type="button" className="text-xs font-semibold text-muted hover:text-ink" onClick={() => withFlip(() => store.replaceAll(candidates.filter((c) => !c.sample)))}>
              Clear sample candidates
            </button>
          </div>
        )}

        {compact && shown.some((c) => !c.reviewedAt) && !openId && (
          <div className="work-in mt-4 flex justify-center">
            <Magnetic>
              <button type="button" className="btn btn-primary" onClick={startReview}>
                Start reviewing <kbd className="key !h-5 !min-w-5 !border-white/20 !bg-white/10 !text-[10px] !text-white">R</kbd>
              </button>
            </Magnetic>
          </div>
        )}
      </main>

      {open && (
        <CandidateDrawer
          c={open}
          index={openIndex}
          total={order.length}
          reviewed={shown.filter((c) => c.reviewedAt).length}
          hasPrev={openIndex > 0}
          hasNext={openIndex >= 0 && openIndex < order.length - 1}
          onNavigate={(d) => {
            const target = order[openIndex + d];
            if (target) setOpenId(target);
          }}
          onDecide={decide}
          onGoTo={setOpenId}
          onUndo={doUndo}
          onEnd={() => notify({ message: shown.every((c) => c.reviewedAt) ? "That's everyone in this list. Nice work." : "End of the list" })}
          onClose={() => setOpenId(null)}
          onPatch={(p) => store.patch(open.id, p)}
          onDraft={(kind) => store.draftEmail(open.id, kind)}
          onSend={(to, subject, body, kind) => store.send(open.id, to, subject, body, kind)}
          onRemove={() => store.remove(open.id)}
          emailReady={status?.email ?? false}
          emailTestInbox={status?.emailTestInbox ?? null}
          sender={status?.sender ?? "Arjun"}
        />
      )}

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
