"use client";

import { useRef, useState } from "react";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/rubric";
import { gsap, useGSAP } from "./gsap";
import { Icon, Magnetic } from "./ui";

interface Staged {
  key: string;
  file: File;
  role: Role;
}

const ACCEPT = ".pdf,.docx,.txt";

// Letters-only boundaries, because CV files are usually named like "Rahul_SPM_CV.pdf" and "_" counts as a word
// character for \b. Checked SPM-first so "spm" isn't read as "pm".
function guessRole(name: string, fallback: Role): Role {
  if (/(^|[^a-z])spm([^a-z]|$)|senior[\s_.-]*p(roduct)?[\s_.-]*m/i.test(name)) return "SPM";
  if (/(^|[^a-z])pm([^a-z]|$)|product[\s_.-]*manager/i.test(name)) return "PM";
  return fallback;
}

export function RoleToggle({ value, onChange, size = "sm" }: { value: Role; onChange: (r: Role) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-full bg-line-2 p-0.5" role="radiogroup" aria-label="Applied role">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          title={ROLE_LABEL[r]}
          onClick={() => onChange(r)}
          className={`rounded-full font-semibold transition-colors ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${
            value === r ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink-2"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export function Uploader({ onSubmit, aiReady }: { onSubmit: (items: { file: File; role: Role }[]) => void; aiReady: boolean }) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [defaultRole, setDefaultRole] = useState<Role>("PM");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  useGSAP(
    () => {
      const zone = root.current!.querySelector<HTMLElement>(".dropzone");
      if (!zone || !window.matchMedia("(pointer: fine)").matches) return;
      const mx = gsap.quickTo(zone, "--mx", { duration: 0.45, ease: "power3.out" });
      const my = gsap.quickTo(zone, "--my", { duration: 0.45, ease: "power3.out" });
      const move = (e: MouseEvent) => {
        const b = zone.getBoundingClientRect();
        mx(e.clientX - b.left);
        my(e.clientY - b.top);
      };
      // Spotlight fades in on hover and out on leave, rather than sitting in a corner.
      const enter = () => gsap.to(zone, { "--ma": 1, duration: 0.3 });
      const leave = () => gsap.to(zone, { "--ma": 0, duration: 0.4 });
      zone.addEventListener("mousemove", move);
      zone.addEventListener("mouseenter", enter);
      zone.addEventListener("mouseleave", leave);
      return () => {
        zone.removeEventListener("mousemove", move);
        zone.removeEventListener("mouseenter", enter);
        zone.removeEventListener("mouseleave", leave);
      };
    },
    { scope: root }
  );

  useGSAP(
    () => {
      const rows = gsap.utils.toArray<HTMLElement>(".staged-row");
      const fresh = rows.slice(0, Math.max(0, rows.length - prevCount.current));
      if (fresh.length) gsap.from(fresh, { opacity: 0, y: -8, duration: 0.35, stagger: 0.04, ease: "power2.out" });
      prevCount.current = rows.length;
    },
    { dependencies: [staged.length], scope: root }
  );

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...list]
      .filter((f) => /\.(pdf|docx|txt)$/i.test(f.name))
      .map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, role: guessRole(file.name, defaultRole) }));
    setStaged((s) => [...next, ...s]);
  };

  const submit = () => {
    if (!staged.length) return;
    const rows = root.current?.querySelectorAll(".staged-row");
    gsap.to(rows ?? [], {
      opacity: 0,
      x: 24,
      duration: 0.25,
      stagger: 0.03,
      ease: "power2.in",
      onComplete: () => {
        onSubmit(staged.map(({ file, role }) => ({ file, role })));
        prevCount.current = 0;
        setStaged([]);
      },
    });
  };

  return (
    <div ref={root} className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Add CVs</h2>
          <p className="text-sm text-muted">PDF, DOCX or TXT. Pick the role each person applied for.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-2">
          New files default to <RoleToggle value={defaultRole} onChange={setDefaultRole} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        style={{ ["--mx" as string]: 0, ["--my" as string]: 0, ["--ma" as string]: 0, backgroundImage: "radial-gradient(260px circle at calc(var(--mx) * 1px) calc(var(--my) * 1px), rgba(79,85,216,calc(0.16 * var(--ma))), transparent 70%)" }}
        className={`dropzone group relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all ${
          over ? "border-accent bg-accent-soft" : "border-line bg-lane-founder/40 hover:border-accent/50 hover:bg-lane-founder/70"
        }`}
      >
        <span className={`grid h-11 w-11 place-items-center rounded-full bg-white text-accent shadow-sm transition-transform ${over ? "scale-110" : "group-hover:-translate-y-0.5"}`}>
          <Icon name="upload" className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold">Drop CVs here, or click to browse</span>
        <span className="text-xs text-muted">Names, contact details and education are removed before AI reads anything</span>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      </button>

      {staged.length > 0 && (
        <>
          <ul className="scroll-thin mt-4 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {staged.map((s) => (
              <li key={s.key} className="staged-row flex items-center gap-3 rounded-xl border border-line-2 bg-paper/60 px-3 py-2">
                <Icon name="file" className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm">{s.file.name}</span>
                <RoleToggle value={s.role} onChange={(role) => setStaged((all) => all.map((x) => (x.key === s.key ? { ...x, role } : x)))} />
                <button
                  type="button"
                  aria-label={`Remove ${s.file.name}`}
                  onClick={() => setStaged((all) => all.filter((x) => x.key !== s.key))}
                  className="rounded-full p-1 text-muted hover:bg-white hover:text-ink"
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {staged.filter((s) => s.role === "PM").length} PM · {staged.filter((s) => s.role === "SPM").length} SPM
            </span>
            <Magnetic>
              <button type="button" className="btn btn-accent" onClick={submit} disabled={!aiReady} title={aiReady ? "" : "Add GEMINI_API_KEY to enable scoring"}>
                <Icon name="sparkle" />
                Screen {staged.length} CV{staged.length > 1 ? "s" : ""}
              </button>
            </Magnetic>
          </div>
        </>
      )}
    </div>
  );
}
