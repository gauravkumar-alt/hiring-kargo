"use client";

import { useRef } from "react";
import type { Candidate, Stage } from "@/lib/types";
import { gsap, useGSAP } from "./gsap";
import { Icon } from "./ui";

// The processing lanes from the components map: System (read + strip), AI (score, brief, email), then Output.
const STEPS: { stage: Stage; label: string; lane: string }[] = [
  { stage: "extract", label: "Read & strip personal details", lane: "bg-lane-system" },
  { stage: "score", label: "Score on PM + SPM rubrics", lane: "bg-lane-ai" },
  { stage: "draft", label: "Interview brief & email", lane: "bg-lane-email" },
];

const ORDER: Stage[] = ["queued", "extract", "score", "draft", "done"];

function Row({ c, onRetry, onRemove }: { c: Candidate; onRetry: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const idx = ORDER.indexOf(c.stage);

  useGSAP(() => {
    gsap.from(ref.current, { opacity: 0, y: 10, duration: 0.4, ease: "power2.out" });
  }, { scope: ref });

  useGSAP(
    () => {
      if (c.stage === "error") return;
      const pct = Math.max(0.04, (idx - 1 + 0.5) / STEPS.length);
      gsap.to(".bar", { width: `${Math.min(1, pct) * 100}%`, duration: 0.8, ease: "power3.out" });
      gsap.killTweensOf(".pulse");
      gsap.set(".pulse", { scale: 1, opacity: 1 });
      gsap.to(".step-active .pulse", { scale: 1.6, opacity: 0, duration: 1.1, repeat: -1, ease: "power1.out" });
    },
    { dependencies: [c.stage], scope: ref }
  );

  return (
    <li ref={ref} className="rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon name="file" className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.extract?.contact.name || c.fileName}</span>
        <span className="rounded-full bg-line-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">{c.role}</span>
      </div>

      {c.stage === "error" ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-pass-soft px-3 py-2 text-sm text-pass">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{c.error}</span>
          <button className="btn btn-ghost !bg-white !py-1 !text-xs" onClick={onRetry}>
            <Icon name="refresh" className="h-3.5 w-3.5" /> Retry
          </button>
          <button className="btn btn-ghost !bg-white !py-1 !text-xs" onClick={onRemove}>
            Remove
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line-2">
            <div className="bar h-full w-0 rounded-full bg-gradient-to-r from-accent to-coral" />
          </div>
          <ol className="mt-2.5 grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => {
              const state = idx > i + 1 ? "done" : idx === i + 1 ? "active" : "todo";
              return (
                <li key={s.stage} className={`flex items-center gap-2 text-xs ${state === "todo" ? "text-muted" : "text-ink-2"} ${state === "active" ? "step-active" : ""}`}>
                  <span className={`relative grid h-4 w-4 shrink-0 place-items-center rounded-full ${state === "todo" ? "bg-line-2" : s.lane}`}>
                    {state === "done" ? (
                      <Icon name="check" className="h-3 w-3 text-advance" />
                    ) : (
                      <>
                        <span className={`pulse absolute inset-0 rounded-full ${state === "active" ? "bg-accent/30" : ""}`} />
                        <span className={`h-1.5 w-1.5 rounded-full ${state === "active" ? "bg-accent" : "bg-muted/40"}`} />
                      </>
                    )}
                  </span>
                  <span className="truncate">{s.label}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </li>
  );
}

export function Pipeline({ items, onRetry, onRemove }: { items: Candidate[]; onRetry: (id: string) => void; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  const active = items.filter((c) => c.stage !== "error").length;
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold tracking-tight">In progress</h2>
        <span className="text-sm text-muted">{active ? `${active} screening` : "Needs attention"}</span>
      </div>
      <ul className="scroll-thin max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {items.map((c) => (
          <Row key={c.id} c={c} onRetry={() => onRetry(c.id)} onRemove={() => onRemove(c.id)} />
        ))}
      </ul>
    </section>
  );
}
