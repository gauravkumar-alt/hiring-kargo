"use client";

import { useRef } from "react";
import { DECISION_LABEL, type Decision } from "@/lib/rubric";
import { gsap, useGSAP } from "./gsap";

export const DECISION_STYLE: Record<Decision, { fg: string; bg: string; dot: string }> = {
  ADVANCE: { fg: "text-advance", bg: "bg-advance-soft", dot: "bg-advance" },
  HOLD: { fg: "text-hold", bg: "bg-hold-soft", dot: "bg-hold" },
  PASS: { fg: "text-pass", bg: "bg-pass-soft", dot: "bg-pass" },
  FLAG: { fg: "text-flag", bg: "bg-flag-soft", dot: "bg-flag" },
};

export const DECISION_HEX: Record<Decision, string> = {
  ADVANCE: "#1e7a4f",
  HOLD: "#c07a14",
  PASS: "#b23b52",
  FLAG: "#6645c4",
};

export function DecisionPill({ decision, overridden }: { decision: Decision; overridden?: boolean }) {
  const s = DECISION_STYLE[decision];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.fg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {DECISION_LABEL[decision]}
      {overridden && <span className="font-medium opacity-70">· your call</span>}
    </span>
  );
}

export function ScoreRing({ value, decision, size = 48, stroke = 5, delay = 0 }: { value: number; decision: Decision; size?: number; stroke?: number; delay?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  useGSAP(
    () => {
      const arc = ref.current!.querySelector(".arc");
      const label = ref.current!.parentElement!.querySelector(".ring-num");
      const counter = { v: 0 };
      gsap.fromTo(arc, { strokeDashoffset: circ }, { strokeDashoffset: circ * (1 - value / 100), duration: 1.1, ease: "power3.out", delay });
      gsap.to(counter, {
        v: value,
        duration: 1.1,
        ease: "power3.out",
        delay,
        onUpdate: () => {
          if (label) label.textContent = String(Math.round(counter.v));
        },
      });
    },
    { dependencies: [value], scope: ref }
  );

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efece5" strokeWidth={stroke} />
        <circle
          className="arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={DECISION_HEX[decision]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ}
        />
      </svg>
      <span className="ring-num num absolute inset-0 grid place-items-center font-bold" style={{ fontSize: size * 0.3 }}>
        {value}
      </span>
    </div>
  );
}

type IconName = "lock" | "upload" | "file" | "x" | "check" | "send" | "sparkle" | "download" | "arrow" | "alert" | "quote" | "refresh" | "eye" | "mail" | "trash";

const PATHS: Record<IconName, string> = {
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  upload: "M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5",
  x: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7",
  send: "M4 12 20 4l-6 16-3-7-7-1Z",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.5 2.5m6.4 6.4 2.5 2.5m0-11.4-2.5 2.5m-6.4 6.4-2.5 2.5",
  download: "M12 4v12m0 0-4-4m4 4 4-4M4 20h16",
  arrow: "M9 6l6 6-6 6",
  alert: "M12 8v5m0 3h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  quote: "M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6",
  refresh: "M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4m-4 5a8 8 0 0 0 14.6 4.5M20 20v-4h-4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  trash: "M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
};

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Wraps a primary button: it leans toward the cursor and springs back. Pointer devices only. */
export function Magnetic({ children, strength = 0.35 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current!;
      if (!window.matchMedia("(pointer: fine)").matches) return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const move = (e: MouseEvent) => {
        const b = el.getBoundingClientRect();
        xTo((e.clientX - (b.left + b.width / 2)) * strength);
        yTo((e.clientY - (b.top + b.height / 2)) * strength);
      };
      const leave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1, 0.35)" });
      };
      el.addEventListener("mousemove", move);
      el.addEventListener("mouseleave", leave);
      return () => {
        el.removeEventListener("mousemove", move);
        el.removeEventListener("mouseleave", leave);
      };
    },
    { scope: ref }
  );
  return (
    <span ref={ref} className="inline-block will-change-transform">
      {children}
    </span>
  );
}
