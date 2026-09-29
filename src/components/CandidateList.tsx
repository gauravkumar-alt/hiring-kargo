"use client";

import { useRef } from "react";
import { CRITERIA, CRITERION_NAME, CRITERION_SHORT, WEIGHTS, type Role } from "@/lib/rubric";
import type { Candidate } from "@/lib/types";
import { effectiveDecision } from "@/lib/useCandidates";
import { Flip, gsap, ScrollTrigger, useGSAP } from "./gsap";
import { DECISION_HEX, DecisionPill, Icon, ScoreRing } from "./ui";

export type RoleFilter = "ALL" | Role;

const LETTER: Record<string, string> = {
  domain: "D",
  ownership: "O",
  built: "B",
  acts: "A",
  craft: "C",
  impact: "I",
  complexity: "X",
  trajectory: "T",
};

function MiniBars({ c }: { c: Candidate }) {
  const crit = c.result!.scores[c.role].criteria;
  const w = WEIGHTS[c.role];
  return (
    <div className="hidden items-end gap-[3px] md:flex" aria-hidden>
      {crit.map((x) => (
        <div
          key={x.key}
          className="relative flex h-7 w-2.5 items-end overflow-hidden rounded-full bg-line-2"
          title={`${CRITERION_NAME[x.key]}: ${x.score}/5 (weight ${w[x.key]})${x.notEvidenced ? " · not evidenced" : ""}`}
        >
          <div
            className="mini-bar w-full rounded-full"
            style={{
              height: `${(x.score / 5) * 100}%`,
              background: x.notEvidenced ? "#d8d3c8" : x.score >= 4 ? "#4f55d8" : x.score === 3 ? "#9ea2ec" : "#c9cbf3",
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** First sentence of the first hold/flag reason, e.g. "Relocation to Mumbai not stated". */
function reasonLine(c: Candidate) {
  const reasons = c.result!.reasons;
  if (!reasons.length) return "";
  const first = reasons[0].split(/\.\s/)[0].replace(/\.$/, "");
  return reasons.length > 1 ? `${first} · +${reasons.length - 1} more` : first;
}

function Row({ c, rank, active, onOpen }: { c: Candidate; rank: number; active: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const r = c.result!;
  const decision = effectiveDecision(c)!;
  const other: Role = c.role === "PM" ? "SPM" : "PM";
  const reason = reasonLine(c);
  const overridden = !!c.override && c.override !== r.decision;
  const first = useRef(true);

  // A decision change gets a small "stamp": pill pops, row washes with the decision colour.
  useGSAP(
    () => {
      if (first.current) {
        first.current = false;
        return;
      }
      gsap.fromTo(".row-pill", { scale: 1.35, rotate: -6 }, { scale: 1, rotate: 0, duration: 0.55, ease: "back.out(3)" });
      gsap.fromTo(".row-wash", { opacity: 0.35 }, { opacity: 0, duration: 1.1, ease: "power2.out" });
    },
    { dependencies: [decision], scope: ref }
  );

  let sub: React.ReactNode;
  if (c.note) {
    sub = <span className="italic text-ink-2">“{c.note}”</span>;
  } else if (reason && !overridden) {
    sub = (
      <span className="flex items-center gap-1 font-medium" style={{ color: DECISION_HEX[r.decision] }}>
        <Icon name="alert" className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{reason}</span>
      </span>
    );
  } else {
    sub = <span className="truncate">{r.signals.summary}</span>;
  }

  return (
    <li ref={ref} data-flip-id={c.id} data-id={c.id} className="cand-row relative">
      <span className="row-wash pointer-events-none absolute inset-0 rounded-2xl opacity-0" style={{ background: DECISION_HEX[decision] }} />
      <button
        type="button"
        onClick={onOpen}
        className={`group relative flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all sm:gap-4 sm:px-4 ${
          active ? "border-accent/40 bg-white shadow-[0_8px_24px_-14px_rgba(79,85,216,0.45)]" : "border-transparent hover:border-line hover:bg-white hover:shadow-[0_8px_24px_-14px_rgba(23,25,30,0.25)]"
        }`}
      >
        <span className="relative w-6 shrink-0 text-center">
          <span className="num text-sm font-bold text-muted">{rank}</span>
          {c.reviewedAt && (
            <span className="absolute -right-1.5 -top-2 grid h-4 w-4 place-items-center rounded-full bg-advance text-white" title="Reviewed">
              <Icon name="check" className="h-2.5 w-2.5" />
            </span>
          )}
        </span>
        <ScoreRing value={r.scores[c.role].total} decision={decision} delay={Math.min(rank, 10) * 0.04} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{c.extract?.contact.name}</span>
            <span className="rounded-full bg-line-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">{c.role}</span>
            {c.sample && <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted">sample</span>}
          </div>
          <p className="mt-0.5 flex min-w-0 text-sm text-muted">{sub}</p>
        </div>
        <MiniBars c={c} />
        <div className="hidden w-16 shrink-0 text-right lg:block">
          <div className="text-[11px] text-muted">as {other}</div>
          <div className="num text-sm font-semibold text-ink-2">{r.scores[other].total}</div>
        </div>
        <div className="flex w-[118px] shrink-0 flex-col items-end gap-1">
          <span className="row-pill inline-block">
            <DecisionPill decision={decision} overridden={overridden} />
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted">
            {c.sentAt ? (
              <>
                <Icon name="check" className="h-3 w-3 text-advance" /> {c.sentKind === "invite" ? "Invite" : "Reply"} sent
              </>
            ) : c.email ? (
              <>
                <Icon name="mail" className="h-3 w-3" /> Draft ready
              </>
            ) : null}
          </span>
        </div>
        <Icon name="arrow" className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </button>
    </li>
  );
}

interface Props {
  items: Candidate[];
  role: RoleFilter;
  roleCounts: Record<RoleFilter, number>;
  onRole: (r: RoleFilter) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  onStartReview: () => void;
  flipState: React.MutableRefObject<Flip.FlipState | null>;
  filterLabel: string | null;
  onClearFilter: () => void;
}

export function CandidateList({ items, role, roleCounts, onRole, activeId, onOpen, onStartReview, flipState, filterLabel, onClearFilter }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const reviewed = items.filter((c) => c.reviewedAt).length;
  const pct = items.length ? reviewed / items.length : 0;

  // First paint: rows rise in as they scroll into view. Later changes (filters, new CVs) use Flip.
  useGSAP(
    () => {
      const rows = root.current!.querySelectorAll(".cand-row");
      if (!rows.length) return;
      if (!entered.current) {
        entered.current = true;
        ScrollTrigger.batch(rows, {
          once: true,
          start: "top 92%",
          onEnter: (batch) => {
            gsap.from(batch, { opacity: 0, y: 22, duration: 0.7, stagger: 0.06 });
            batch.forEach((row, i) =>
              gsap.from(row.querySelectorAll(".mini-bar"), { scaleY: 0, transformOrigin: "bottom", duration: 0.7, stagger: 0.025, delay: 0.15 + i * 0.06 })
            );
          },
        });
        return;
      }
      if (flipState.current) {
        Flip.from(flipState.current, {
          targets: rows,
          duration: 0.6,
          ease: "power3.inOut",
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 14, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.04 }),
        });
        flipState.current = null;
      }
    },
    { dependencies: [items.map((c) => c.id).join()], scope: root }
  );

  useGSAP(() => gsap.to(".review-bar", { scaleX: pct, duration: 0.8, transformOrigin: "left" }), { dependencies: [pct], scope: root });

  // Keep the candidate being triaged in view behind the drawer.
  useGSAP(
    () => {
      if (!activeId) return;
      const el = root.current!.querySelector(`[data-id="${activeId}"]`);
      if (el) gsap.to(window, { scrollTo: { y: el, offsetY: 160, autoKill: true }, duration: 0.6 });
    },
    { dependencies: [activeId], scope: root }
  );

  return (
    <section id="ranked" ref={root} className="card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 pt-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            Ranked candidates
            {filterLabel && (
              <button type="button" onClick={onClearFilter} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">
                {filterLabel} <Icon name="x" className="h-3 w-3" />
              </button>
            )}
          </h2>
          <div className="mt-1.5 flex items-center gap-2.5 text-sm text-muted">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line-2">
              <div className="review-bar h-full w-full origin-left scale-x-0 rounded-full bg-advance" />
            </div>
            <span className="num">
              {reviewed} of {items.length} reviewed
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-line-2 p-0.5">
            {(["ALL", "PM", "SPM"] as RoleFilter[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onRole(r)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${role === r ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink-2"}`}
              >
                {r === "ALL" ? "All roles" : r} <span className="num ml-0.5 opacity-60">{roleCounts[r]}</span>
              </button>
            ))}
          </div>
          {items.length > 0 && (
            <button type="button" className="btn btn-accent !py-1.5" onClick={onStartReview}>
              <Icon name="eye" className="h-4 w-4" />
              {reviewed === items.length ? "Review again" : `Review ${items.length - reviewed} left`}
            </button>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-4 border-y border-line-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted md:flex">
        <span className="w-6 text-center">#</span>
        <span className="w-12">Score</span>
        <span className="flex-1">Candidate · why</span>
        <span className="flex w-[101px] gap-[3px] normal-case tracking-normal">
          {CRITERIA.map((k) => (
            <span key={k} className="w-2.5 text-center text-[10px] font-bold" title={CRITERION_SHORT[k]}>
              {LETTER[k]}
            </span>
          ))}
        </span>
        <span className="hidden w-16 text-right lg:block">Other</span>
        <span className="w-[118px] text-right">Call</span>
        <span className="w-4" />
      </div>

      {items.length ? (
        <ol className="mt-1 space-y-0.5">
          {items.map((c, i) => (
            <Row key={c.id} c={c} rank={i + 1} active={c.id === activeId} onOpen={() => onOpen(c.id)} />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted">No one matches these filters.</p>
      )}

      <p className="hidden px-4 pt-3 text-[11px] text-muted md:block">
        D Domain · O Ownership · B Built it · A Acts fast · C Craft · I Impact · X Complexity · T Trajectory. Darker bars are stronger scores; grey means not evidenced.
      </p>
    </section>
  );
}

export function ListSkeleton() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.to(".skeleton", { backgroundPosition: "-200% 0", duration: 1.4, ease: "none", repeat: -1 });
    },
    { scope: ref }
  );
  return (
    <div ref={ref} className="card p-4" aria-busy="true" aria-label="Loading candidates">
      <div className="skeleton mb-4 h-6 w-48" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-4 px-2 py-3" style={{ opacity: 1 - i * 0.15 }}>
          <div className="skeleton h-4 w-5" />
          <div className="skeleton h-12 w-12 !rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-72 max-w-full" />
          </div>
          <div className="skeleton hidden h-7 w-24 md:block" />
          <div className="skeleton h-6 w-20 !rounded-full" />
        </div>
      ))}
    </div>
  );
}
