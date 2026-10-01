"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { findEvidence } from "@/lib/evidence";
import { CRITERIA, CRITERION_NAME, CRITERION_SHORT, DECISION_LABEL, ROLE_LABEL, type CriterionKey, type Decision } from "@/lib/rubric";
import type { Candidate, EmailKind } from "@/lib/types";
import { effectiveDecision } from "@/lib/useCandidates";
import { Brief, Email, Scores } from "./DrawerTabs";
import { gsap, useGSAP } from "./gsap";
import { DECISION_HEX, DECISION_STYLE, DecisionPill, Icon, ScoreRing } from "./ui";

type Tab = "evidence" | "scores" | "brief" | "email";
type Call = Exclude<Decision, "FLAG">;

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: "evidence", label: "Evidence", key: "1" },
  { id: "scores", label: "Scores", key: "2" },
  { id: "brief", label: "Interview brief", key: "3" },
  { id: "email", label: "Email", key: "4" },
];

const CALLS: { d: Call; key: string }[] = [
  { d: "ADVANCE", key: "A" },
  { d: "HOLD", key: "H" },
  { d: "PASS", key: "P" },
];

interface Props {
  c: Candidate;
  index: number; // position in the current list, -1 if it left the list
  total: number;
  reviewed: number;
  hasPrev: boolean;
  hasNext: boolean;
  onNavigate: (dir: 1 | -1) => void;
  onDecide: (d: Call) => string | null; // returns the id to move to next
  onGoTo: (id: string) => void;
  onUndo: () => void;
  onEnd: () => void;
  onClose: () => void;
  onPatch: (p: Partial<Candidate>) => void;
  onDraft: (kind: EmailKind) => Promise<unknown>;
  onSend: (to: string, subject: string, body: string, kind: EmailKind) => Promise<void>;
  onRemove: () => void;
  emailReady: boolean;
  emailTestInbox?: string | null;
  sender: string;
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

/* ---------------------------------------------------------------- Evidence tab */

function Evidence({ c }: { c: Candidate }) {
  const e = c.extract!;
  const crit = c.result!.scores[c.role].criteria;
  const marks = useMemo(() => findEvidence(e.redactedText, crit), [e.redactedText, crit]);
  const [active, setActive] = useState<CriterionKey | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(".ev-chip", { opacity: 0, y: 8, duration: 0.4, stagger: 0.03 });
      gsap.to(".ev-mark", { backgroundSize: "100% 100%", duration: 0.55, stagger: 0.14, ease: "power2.inOut", delay: 0.25 });
      gsap.from(".ev-tag", { scale: 0, duration: 0.4, stagger: 0.14, ease: "back.out(3)", delay: 0.45 });
    },
    { scope: root, dependencies: [c.id] }
  );

  const focus = (key: CriterionKey) => {
    setActive(key);
    const el = scroller.current?.querySelector<HTMLElement>(`[data-keys~="${key}"]`);
    if (!el || !scroller.current) return;
    gsap.to(scroller.current, { scrollTo: { y: el, offsetY: 48 }, duration: 0.6 });
    gsap.fromTo(el, { boxShadow: "0 0 0 8px rgba(79,85,216,0.3)" }, { boxShadow: "0 0 0 1.5px rgba(79,85,216,1)", duration: 0.9, ease: "power2.out", clearProps: "boxShadow" });
  };

  // Split the CV into plain text and highlighted spans.
  const parts: React.ReactNode[] = [];
  let at = 0;
  marks.forEach((m, i) => {
    if (m.start > at) parts.push(e.redactedText.slice(at, m.start));
    parts.push(
      <mark
        key={i}
        data-keys={m.keys.join(" ")}
        className={`ev-mark ${active && m.keys.includes(active) ? "is-active" : ""}`}
        onMouseEnter={() => setActive(m.keys[0])}
        onMouseLeave={() => setActive(null)}
      >
        {e.redactedText.slice(m.start, m.end)}
        <span className="ev-tag">{m.keys.map((k) => CRITERION_SHORT[k]).join(" · ")}</span>
      </mark>
    );
    at = m.end;
  });
  parts.push(e.redactedText.slice(at));

  const located = new Set(marks.flatMap((m) => m.keys));

  return (
    <div ref={root} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CRITERIA.map((k) => {
          const x = crit.find((y) => y.key === k)!;
          const found = located.has(k);
          return (
            <button
              key={k}
              type="button"
              disabled={!found}
              onClick={() => focus(k)}
              onMouseEnter={() => found && setActive(k)}
              onMouseLeave={() => setActive(null)}
              title={found ? `Jump to the ${CRITERION_NAME[k]} quote` : x.notEvidenced ? "Not evidenced in the CV" : "Quote not located in the text"}
              className={`ev-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                found
                  ? active === k
                    ? "bg-accent text-white"
                    : "bg-accent-soft text-accent hover:bg-accent hover:text-white"
                  : "border border-dashed border-line text-muted"
              }`}
            >
              {CRITERION_SHORT[k]}
              <span className={`num rounded-full px-1.5 text-[10px] ${found ? (active === k ? "bg-white/20" : "bg-white") : "bg-line-2"}`}>{x.score}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Highlights are the exact lines the AI scored on. Dashed criteria had no quote, so they count as 1. Removed before AI:{" "}
        {e.redactions.length ? e.redactions.join(", ").toLowerCase() : "nothing detected, so check for personal details"}.
      </p>
      <div ref={scroller} className="scroll-thin relative max-h-[52vh] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-paper p-4 text-[13.5px] leading-[1.85] text-ink-2">
        {parts}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Shortcut sheet */

function Shortcuts({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current, { opacity: 0, y: 12, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "back.out(1.6)" });
    gsap.from(".sc-row", { opacity: 0, x: -8, stagger: 0.03, duration: 0.3, delay: 0.1 });
  });
  const rows: [string, string][] = [
    ["J  or  →", "Next candidate"],
    ["K  or  ←", "Previous candidate"],
    ["A / H / P", "Advance, hold or pass, then move on"],
    ["Z", "Undo the last call"],
    ["N", "Write a note on this call"],
    ["1 – 4", "Switch tabs"],
    ["Esc", "Close"],
  ];
  return (
    <div ref={ref} className="absolute bottom-16 right-5 z-20 w-72 rounded-2xl border border-line bg-white p-4 shadow-[0_20px_50px_-20px_rgba(23,25,30,0.4)] sm:right-7">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">Keyboard shortcuts</span>
        <button type="button" onClick={onClose} aria-label="Close shortcuts" className="rounded-full p-1 text-muted hover:bg-paper hover:text-ink">
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="space-y-1.5">
        {rows.map(([k, v]) => (
          <li key={k} className="sc-row flex items-center justify-between gap-3 text-xs">
            <span className="text-ink-2">{v}</span>
            <kbd className="key whitespace-pre">{k}</kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- Drawer */

export function CandidateDrawer(props: Props) {
  const { c, index, total, reviewed, hasPrev, hasNext, onNavigate, onDecide, onGoTo, onUndo, onEnd, onClose, onPatch, onRemove } = props;
  const [tab, setTab] = useState<Tab>("evidence");
  const [help, setHelp] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const dir = useRef<1 | -1>(1);
  const mounted = useRef(false);
  const r = c.result!;
  const decision = effectiveDecision(c)!;
  const ai = r.decision;

  const close = () => {
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(content.current, { x: 30, opacity: 0, duration: 0.2, ease: "power2.in" })
      .to(panel.current, { xPercent: 100, duration: 0.4, ease: "power3.in" }, 0.05)
      .to(backdrop.current, { opacity: 0, duration: 0.3 }, 0.1);
  };

  // Open: backdrop fades, panel springs in, content cascades.
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.35 })
      .fromTo(panel.current, { xPercent: 100 }, { xPercent: 0, duration: 0.7, ease: "expo.out" }, 0)
      .from(".hd-item", { opacity: 0, y: 14, stagger: 0.05, duration: 0.5 }, 0.2);
    panel.current?.focus();
  });

  // Moving between candidates: slide in from the side we travelled towards.
  useGSAP(
    () => {
      if (!mounted.current) {
        mounted.current = true;
        return;
      }
      gsap.fromTo(content.current, { x: dir.current * 48, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "expo.out" });
      gsap.from(".hd-item", { opacity: 0, x: dir.current * 16, stagger: 0.035, duration: 0.4 });
    },
    { dependencies: [c.id] }
  );

  useGSAP(() => gsap.to(".tri-bar", { scaleX: total ? reviewed / total : 0, duration: 0.7, transformOrigin: "left" }), { dependencies: [reviewed, total], scope: panel });

  useGSAP(
    () => {
      gsap.fromTo(".tab-body", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 });
      gsap.from(".fade-item", { opacity: 0, y: 10, duration: 0.4, stagger: 0.03, delay: 0.05 });
      gsap.from(".crit-bar", { width: 0, duration: 0.8, stagger: 0.04, delay: 0.1 });
    },
    { dependencies: [tab, c.id], scope: panel }
  );

  const go = (d: 1 | -1) => {
    if (busy.current) return;
    if ((d === 1 && !hasNext) || (d === -1 && !hasPrev)) {
      gsap.fromTo(content.current, { x: 0 }, { x: d * -10, duration: 0.08, repeat: 3, yoyo: true, ease: "power1.inOut", clearProps: "x" });
      if (d === 1) onEnd();
      return;
    }
    busy.current = true;
    dir.current = d;
    gsap.to(content.current, {
      x: -d * 48,
      opacity: 0,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        busy.current = false;
        onNavigate(d);
      },
    });
  };

  const decide = (d: Call) => {
    if (busy.current) return;
    busy.current = true;
    const next = onDecide(d);
    const el = stamp.current!;
    el.textContent = DECISION_LABEL[d];
    el.style.color = DECISION_HEX[d];
    el.style.borderColor = DECISION_HEX[d];
    const tl = gsap.timeline({
      onComplete: () => {
        busy.current = false;
        if (next) {
          dir.current = 1;
          onGoTo(next);
        } else onEnd();
      },
    });
    tl.fromTo(el, { opacity: 0, scale: 2.4, rotate: -22 }, { opacity: 1, scale: 1, rotate: -9, duration: 0.32, ease: "back.out(2.2)" })
      .fromTo(panel.current, { x: 0 }, { x: 3, duration: 0.05, repeat: 1, yoyo: true, clearProps: "x" }, 0.28)
      .to(el, { opacity: 0, scale: 0.9, duration: 0.2, ease: "power2.in" }, next ? 0.55 : 0.9);
    if (next) tl.to(content.current, { x: -48, opacity: 0, duration: 0.2, ease: "power2.in" }, 0.6);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (isTyping(e)) (e.target as HTMLElement).blur();
        else if (help) setHelp(false);
        else close();
        return;
      }
      if (isTyping(e)) return;
      const k = e.key.toLowerCase();
      if (k === "j" || e.key === "ArrowRight") go(1);
      else if (k === "k" || e.key === "ArrowLeft") go(-1);
      else if (k === "a") decide("ADVANCE");
      else if (k === "h") decide("HOLD");
      else if (k === "p") decide("PASS");
      else if (k === "z") onUndo();
      else if (k === "n") {
        e.preventDefault();
        note.current?.focus();
      } else if (e.key === "?") setHelp((h) => !h);
      else if (["1", "2", "3", "4"].includes(k)) setTab(TABS[Number(k) - 1].id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50">
      <div ref={backdrop} className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={close} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={c.extract?.contact.name}
        className="absolute inset-y-0 right-0 flex w-full max-w-[720px] flex-col overflow-hidden bg-surface shadow-2xl outline-none sm:rounded-l-[28px]"
      >
        <div className="h-1 w-full bg-line-2">
          <div className="tri-bar h-full w-full origin-left scale-x-0 bg-gradient-to-r from-advance to-[#5fc596]" />
        </div>

        <div ref={content} className="flex min-h-0 flex-1 flex-col">
          <header className="relative border-b border-line-2 px-5 pb-0 pt-4 sm:px-7">
            <div
              ref={stamp}
              aria-hidden
              className="pointer-events-none absolute right-24 top-6 z-10 rounded-xl border-[3px] px-4 py-1 text-2xl font-extrabold uppercase tracking-wider opacity-0"
            />
            <div className="flex items-start gap-4">
              <div className="hd-item">
                <ScoreRing value={r.scores[c.role].total} decision={decision} size={68} stroke={6} />
              </div>
              <div className="hd-item min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold tracking-tight">{c.extract?.contact.name}</h2>
                <p className="truncate text-sm text-muted">
                  {ROLE_LABEL[c.role]} ·{" "}
                  {c.cvPath ? (
                    <a href={`/api/candidates/${encodeURIComponent(c.id)}/cv`} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-2 hover:underline">
                      Open original CV
                    </a>
                  ) : (
                    c.fileName
                  )}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DecisionPill decision={decision} overridden={!!c.override && c.override !== ai} />
                  {c.override && c.override !== ai && <span className="text-xs text-muted">Rubric said {DECISION_LABEL[ai]}</span>}
                </div>
              </div>
              <div className="hd-item flex items-center gap-1">
                <button type="button" onClick={() => go(-1)} aria-label="Previous candidate" className="rounded-full p-2 text-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-30" disabled={!hasPrev}>
                  <Icon name="arrow" className="h-4 w-4 rotate-180" />
                </button>
                <span className="num min-w-[3.2rem] text-center text-xs font-semibold text-muted">{index >= 0 ? `${index + 1} / ${total}` : `– / ${total}`}</span>
                <button type="button" onClick={() => go(1)} aria-label="Next candidate" className="rounded-full p-2 text-muted transition-colors hover:bg-paper hover:text-ink">
                  <Icon name="arrow" className="h-4 w-4" />
                </button>
                <button type="button" onClick={close} aria-label="Close" className="ml-1 rounded-full p-2 text-muted hover:bg-paper hover:text-ink">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
            </div>

            {r.reasons.length > 0 && (
              <ul className={`hd-item mt-3 space-y-1 rounded-xl px-3 py-2.5 text-xs ${DECISION_STYLE[ai].bg} ${DECISION_STYLE[ai].fg}`}>
                {r.reasons.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Icon name="alert" className="mt-px h-3.5 w-3.5 shrink-0" /> {x}
                  </li>
                ))}
              </ul>
            )}

            <div className="hd-item mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-2">Your call</span>
              {CALLS.map(({ d, key }) => {
                const on = decision === d;
                const s = DECISION_STYLE[d];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => decide(d)}
                    className={`group inline-flex items-center gap-2 rounded-full py-1 pl-3 pr-1 text-xs font-bold transition-all ${on ? `${s.bg} ${s.fg} ring-1 ring-current` : "bg-paper text-ink-2 hover:bg-line-2"}`}
                  >
                    {DECISION_LABEL[d]}
                    <kbd className="key !h-5 !min-w-5 !text-[10px]">{key}</kbd>
                  </button>
                );
              })}
              <label className="ml-auto flex min-w-[180px] flex-1 items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs focus-within:ring-1 focus-within:ring-accent sm:max-w-[260px]">
                <Icon name="quote" className="h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  ref={note}
                  value={c.note ?? ""}
                  onChange={(e) => onPatch({ note: e.target.value || undefined })}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="Why this call? (N)"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
                />
              </label>
            </div>

            <nav className="hd-item mt-3 flex gap-1 overflow-x-auto" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors ${tab === t.id ? "text-ink" : "text-muted hover:text-ink-2"}`}
                >
                  {t.label}
                  <span className="text-[10px] font-bold text-muted/70">{t.key}</span>
                  {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
                </button>
              ))}
            </nav>
          </header>

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="tab-body">
              {tab === "evidence" && <Evidence key={c.id} c={c} />}
              {tab === "scores" && <Scores c={c} />}
              {tab === "brief" && <Brief c={c} />}
              {tab === "email" && <Email key={c.id} {...props} decision={decision} />}
            </div>
          </div>
        </div>

        {help && <Shortcuts onClose={() => setHelp(false)} />}

        <footer className="flex items-center justify-between gap-3 border-t border-line-2 px-5 py-3 text-xs text-muted sm:px-7">
          <button type="button" onClick={() => setHelp((h) => !h)} className="flex items-center gap-1.5 hover:text-ink">
            <kbd className="key !h-5 !min-w-5 !text-[10px]">?</kbd> Shortcuts
          </button>
          <span className="hidden sm:inline">AI scores are a starting point. Every call is yours.</span>
          <button
            type="button"
            className="flex items-center gap-1 hover:text-pass"
            onClick={() => {
              if (confirm(`Remove ${c.extract?.contact.name} from the dashboard?`)) {
                onRemove();
                onClose();
              }
            }}
          >
            <Icon name="trash" className="h-3.5 w-3.5" /> Remove
          </button>
        </footer>
      </div>
    </div>
  );
}
