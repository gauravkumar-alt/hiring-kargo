"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "./gsap";
import { Icon } from "./ui";

export interface ToastData {
  id: number;
  message: string;
  tone?: "neutral" | "success" | "warning";
  action?: { label: string; onClick: () => void; hint?: string };
}

const TONE = {
  neutral: "bg-ink text-white",
  success: "bg-ink text-white",
  warning: "bg-hold text-white",
};

/** One toast at a time, bottom centre. A new one replaces the old; each dismisses itself. */
export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!toast || !ref.current) return;
      const bar = ref.current.querySelector(".toast-timer");
      const tl = gsap.timeline({ onComplete: onDone });
      tl.fromTo(ref.current, { y: 28, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.8)" })
        .fromTo(bar, { scaleX: 1 }, { scaleX: 0, duration: 4.2, ease: "none", transformOrigin: "left" }, 0)
        .to(ref.current, { y: 16, opacity: 0, duration: 0.3, ease: "power2.in" });
      return () => tl.kill();
    },
    { dependencies: [toast?.id] }
  );

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        ref={ref}
        role="status"
        className={`pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-full py-2.5 pl-4 pr-2.5 text-sm font-medium shadow-[0_12px_32px_-12px_rgba(23,25,30,0.5)] ${TONE[toast.tone ?? "neutral"]}`}
      >
        {toast.tone === "success" && <Icon name="check" className="h-4 w-4 text-[#7ee2b0]" />}
        <span>{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick();
              onDone();
            }}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25"
          >
            {toast.action.label}
            {toast.action.hint && <kbd className="ml-1.5 font-mono opacity-60">{toast.action.hint}</kbd>}
          </button>
        )}
        <span className="toast-timer absolute inset-x-0 bottom-0 h-0.5 bg-white/30" />
      </div>
    </div>
  );
}
