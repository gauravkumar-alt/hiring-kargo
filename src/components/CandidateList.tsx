"use client";

import { useMemo, useRef, useState } from "react";
import { CRITERION_SHORT, WEIGHTS, type Decision, type Role } from "@/lib/rubric";
import type { Candidate } from "@/lib/types";
import { effectiveDecision } from "@/lib/useCandidates";
import { Flip, gsap, useGSAP } from "./gsap";
import { DECISION_HEX, DecisionPill, Icon, ScoreRing } from "./ui";

type RoleFilter = "ALL" | Role;
type DecisionFilter = "ALL" | Decision;

function MiniBars({ c }: { c: Candidate }) {
  const crit = c.result!.scores[c.role].criteria;
  const w = WEIGHTS[c.role];
  return (
    <div className="hidden items-end gap-[3px] md:flex" aria-hidden>
      {crit.map((x) => (
        <div key={x.key} className="group/bar relative flex h-7 w-2 items-end rounded-full bg-line-2" title={`${CRITERION_SHORT[x.key]}: ${x.score}/5${x.notEvidenced ? " (not evidenced)" : ""}`}>
          <div
            className="mini-bar w-full rounded-full"
            style={{
              height: `${(x.score / 5) * 100}%`,
              background: x.notEvidenced ? "#d8d3c8" : `rgb(79 85 216 / ${0.35 + (w[x.key] / 20) * 0.65})`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function Row({ c, rank, onOpen }: { c: Candidate; rank: number; onOpen: () => void }) {
  const r = c.result!;
  const decision = effectiveDecision(c)!;
  const other: Role = c.role === "PM" ? "SPM" : "PM";
  const otherScore = r.scores[other].total;
  const flags = r.signals.dateIssues.length + r.scores[c.role].criteria.filter((x) => x.notEvidenced).length;

  return (
    <li data-flip-id={c.id} className="cand-row">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition-all hover:border-line hover:bg-white hover:shadow-[0_8px_24px_-14px_rgba(23,25,30,0.25)] sm:gap-4 sm:px-4"
      >
        <span className="num w-6 shrink-0 text-center text-sm font-bold text-muted">{rank}</span>
        <ScoreRing value={r.scores[c.role].total} decision={decision} delay={Math.min(rank, 10) * 0.04} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{c.extract?.contact.name}</span>
            <span className="rounded-full bg-line-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">{c.role}</span>
            {c.sample && <span className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted">sample</span>}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">{r.signals.summary}</p>
        </div>
        <MiniBars c={c} />
        <div className="hidden w-20 shrink-0 text-right lg:block">
          <div className="text-[11px] text-muted">as {other}</div>
          <div className="num text-sm font-semibold text-ink-2">{otherScore}</div>
        </div>
        <div className="flex w-[118px] shrink-0 flex-col items-end gap-1">
          <DecisionPill decision={decision} overridden={!!c.override && c.override !== r.decision} />
          <span className="flex items-center gap-1 text-[11px] text-muted">
            {c.sentAt ? (
              <>
                <Icon name="check" className="h-3 w-3 text-advance" /> {c.sentKind === "invite" ? "Invite" : "Reply"} sent
              </>
            ) : c.email ? (
              <>
                <Icon name="mail" className="h-3 w-3" /> Draft ready
              </>
            ) : flags ? (
              <>{flags} to check</>
            ) : null}
          </span>
        </div>
        <Icon name="arrow" className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </button>
    </li>
  );
}

function Chip({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
        active ? "bg-ink text-white shadow-sm" : "bg-white text-ink-2 ring-1 ring-line hover:ring-ink/20"
      }`}
    >
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? "white" : color }} />}
      {children}
    </button>
  );
}

export function CandidateList({ items, onOpen }: { items: Candidate[]; onOpen: (id: string) => void }) {
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [decision, setDecision] = useState<DecisionFilter>("ALL");
  const root = useRef<HTMLDivElement>(null);
  const flipState = useRef<Flip.FlipState | null>(null);
  const entered = useRef(false);

  const byRole = useMemo(() => items.filter((c) => role === "ALL" || c.role === role), [items, role]);
  const shown = useMemo(
    () =>
      byRole
        .filter((c) => decision === "ALL" || effectiveDecision(c) === decision)
        .sort((a, b) => b.result!.scores[b.role].total - a.result!.scores[a.role].total || b.addedAt - a.addedAt),
    [byRole, decision]
  );
  const count = (d: Decision) => byRole.filter((c) => effectiveDecision(c) === d).length;

  const change = (fn: () => void) => {
    flipState.current = Flip.getState(root.current!.querySelectorAll(".cand-row"));
    fn();
  };

  useGSAP(
    () => {
      const rows = root.current!.querySelectorAll(".cand-row");
      if (!rows.length) return;
      if (!entered.current) {
        entered.current = true;
        gsap.from(rows, { opacity: 0, y: 14, duration: 0.5, stagger: 0.05, ease: "power3.out" });
        gsap.from(root.current!.querySelectorAll(".mini-bar"), { scaleY: 0, transformOrigin: "bottom", duration: 0.6, stagger: 0.008, ease: "power2.out", delay: 0.15 });
        return;
      }
      if (flipState.current) {
        Flip.from(flipState.current, {
          targets: rows,
          duration: 0.5,
          ease: "power3.inOut",
          absolute: false,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.03 }),
        });
        flipState.current = null;
      }
    },
    { dependencies: [shown.map((c) => c.id).join()], scope: root }
  );

  const roleCount = (r: RoleFilter) => (r === "ALL" ? items.length : items.filter((c) => c.role === r).length);

  return (
    <section ref={root} className="card p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 pt-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Ranked candidates</h2>
          <p className="text-sm text-muted">Sorted by score for the role applied. Click anyone to see evidence, brief and email.</p>
        </div>
        <div className="inline-flex rounded-full bg-line-2 p-0.5">
          {(["ALL", "PM", "SPM"] as RoleFilter[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => change(() => setRole(r))}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${role === r ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink-2"}`}
            >
              {r === "ALL" ? "All roles" : r} <span className="num ml-0.5 opacity-60">{roleCount(r)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-2 pb-3">
        <Chip active={decision === "ALL"} onClick={() => change(() => setDecision("ALL"))}>
          Everyone <span className="num opacity-60">{byRole.length}</span>
        </Chip>
        {(["ADVANCE", "HOLD", "PASS", "FLAG"] as Decision[]).map((d) => (
          <Chip key={d} active={decision === d} color={DECISION_HEX[d]} onClick={() => change(() => setDecision(d))}>
            {d[0] + d.slice(1).toLowerCase()} <span className="num opacity-60">{count(d)}</span>
          </Chip>
        ))}
      </div>

      <div className="hidden items-center gap-4 border-y border-line-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted md:flex">
        <span className="w-6 text-center">#</span>
        <span className="w-12">Score</span>
        <span className="flex-1">Candidate</span>
        <span className="w-[93px]">Criteria</span>
        <span className="hidden w-20 text-right lg:block">Other role</span>
        <span className="w-[118px] text-right">Call</span>
        <span className="w-4" />
      </div>

      {shown.length ? (
        <ol className="mt-1 space-y-0.5">
          {shown.map((c, i) => (
            <Row key={c.id} c={c} rank={i + 1} onOpen={() => onOpen(c.id)} />
          ))}
        </ol>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted">No candidates match these filters.</p>
      )}
    </section>
  );
}
