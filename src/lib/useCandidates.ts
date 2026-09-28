"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Role } from "./rubric";
import type { Brief, Candidate, EmailDraft, EmailKind, ExtractResult, ScoreResult } from "./types";

const KEY = "kargo-hiring:v1";
const CONCURRENCY = 2; // Gemini free tier is ~15 requests/min; each CV makes 2-3 calls.

export function effectiveDecision(c: Candidate) {
  return c.override ?? c.result?.decision;
}

async function post<T>(url: string, body: BodyInit | object): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method: "POST",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

// Anything mid-flight when the page closed can't resume without its file (unless it was already read).
function markInterrupted(cs: Candidate[]): Candidate[] {
  return cs.map((c) =>
    c.stage === "done" || c.stage === "error"
      ? c
      : c.extract
        ? { ...c, stage: "error", error: "Interrupted. Retry to finish scoring." }
        : { ...c, stage: "error", error: "Interrupted. Upload the CV again." }
  );
}

function loadLocal(): Candidate[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? markInterrupted(JSON.parse(raw) as Candidate[]) : [];
  } catch {
    return [];
  }
}

export type StorageMode = "loading" | "db" | "local";

export function useCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mode, setMode] = useState<StorageMode>("loading");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const ready = mode !== "loading";
  const files = useRef(new Map<string, { file: File; role: Role }>());
  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const latest = useRef<Candidate[]>([]);
  latest.current = candidates;
  const saved = useRef(new Map<string, string>()); // id -> JSON last written to Supabase
  const pending = useRef(new Map<string, Candidate>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/candidates")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || "Couldn't load from Supabase");
        return data as { mode: "db" | "local"; candidates: Candidate[] };
      })
      .then(({ mode, candidates }) => {
        if (mode === "db") {
          for (const c of candidates) saved.current.set(c.id, JSON.stringify(c));
          setCandidates(markInterrupted(candidates));
        } else {
          setCandidates(loadLocal());
        }
        setMode(mode);
      })
      .catch((e) => {
        // Don't silently fall back to browser storage: the founder would think data is in Supabase.
        setSaveError(e instanceof Error ? e.message : "Couldn't load from Supabase");
        setMode("db");
      });
  }, []);

  const flush = useCallback(async () => {
    const batch = [...pending.current.values()];
    pending.current.clear();
    if (!batch.length) return;
    setSaving(true);
    const results = await Promise.all(
      batch.map(async (c) => {
        const json = JSON.stringify(c);
        try {
          const res = await fetch(`/api/candidates/${encodeURIComponent(c.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: json,
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Save failed (${res.status})`);
          saved.current.set(c.id, json);
          return "";
        } catch (e) {
          pending.current.set(c.id, latest.current.find((x) => x.id === c.id) ?? c); // retry on next change
          return e instanceof Error ? e.message : "Save failed";
        }
      })
    );
    setSaving(false);
    setSaveError(results.find(Boolean) ?? "");
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (mode === "local") {
      try {
        localStorage.setItem(KEY, JSON.stringify(candidates));
      } catch {
        /* storage full or blocked; the dashboard still works for this session */
      }
      return;
    }
    // Samples are demo data and never written to Supabase.
    for (const c of candidates) {
      if (!c.sample && saved.current.get(c.id) !== JSON.stringify(c)) pending.current.set(c.id, c);
    }
    if (!pending.current.size) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }, [candidates, ready, mode, flush]);

  // Don't lose the last edit if the tab closes during the debounce.
  useEffect(() => {
    const onHide = () => {
      for (const c of pending.current.values()) {
        navigator.sendBeacon?.(`/api/candidates/${encodeURIComponent(c.id)}/beacon`, new Blob([JSON.stringify(c)], { type: "application/json" }));
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const patch = useCallback((id: string, p: Partial<Candidate>) => {
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }, []);

  const run = useCallback(
    async (id: string) => {
      const get = () => latest.current.find((c) => c.id === id);
      try {
        let extract = get()?.extract;
        if (!extract) {
          const file = files.current.get(id)?.file;
          if (!file) throw new Error("File is no longer available. Upload it again.");
          patch(id, { stage: "extract", error: undefined });
          const form = new FormData();
          form.append("file", file);
          form.append("id", id);
          const { cvPath, ...rest } = await post<ExtractResult & { cvPath?: string }>("/api/extract", form);
          extract = rest;
          patch(id, { extract, cvPath });
        }

        const role = get()?.role ?? files.current.get(id)?.role ?? "PM";
        patch(id, { stage: "score", error: undefined });
        const result = await post<ScoreResult>("/api/score", { cv: extract.redactedText, role });
        patch(id, { result, override: undefined });

        patch(id, { stage: "draft" });
        const kind: EmailKind | null = result.decision === "ADVANCE" ? "invite" : result.decision === "PASS" ? "rejection" : null;
        const { brief, email } = await post<{ brief?: Brief; email?: EmailDraft }>("/api/draft", {
          cv: extract.redactedText,
          role,
          result,
          want: { brief: true, email: kind },
          firstName: extract.contact.name.split(" ")[0] ?? "",
        });
        patch(id, { brief, email, stage: "done" });
        files.current.delete(id);
      } catch (e) {
        patch(id, { stage: "error", error: e instanceof Error ? e.message : "Something went wrong" });
      }
    },
    [patch]
  );

  const pump = useCallback(() => {
    while (running.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      running.current++;
      run(id).finally(() => {
        running.current--;
        pump();
      });
    }
  }, [run]);

  const addFiles = useCallback(
    (items: { file: File; role: Role }[]) => {
      const fresh: Candidate[] = items.map(({ file, role }) => {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        files.current.set(id, { file, role });
        return { id, fileName: file.name, role, addedAt: Date.now(), stage: "queued" };
      });
      setCandidates((cs) => [...fresh, ...cs]);
      queue.current.push(...fresh.map((c) => c.id));
      // Let state commit before the runners read it.
      setTimeout(pump, 0);
    },
    [pump]
  );

  const retry = useCallback(
    (id: string) => {
      patch(id, { stage: "queued", error: undefined });
      queue.current.push(id);
      setTimeout(pump, 0);
    },
    [patch, pump]
  );

  const draftEmail = useCallback(
    async (id: string, kind: EmailKind) => {
      const c = latest.current.find((x) => x.id === id);
      if (!c?.extract || !c.result) throw new Error("Candidate isn't scored yet");
      const { email } = await post<{ email?: EmailDraft }>("/api/draft", {
        cv: c.extract.redactedText,
        role: c.role,
        result: c.result,
        want: { brief: false, email: kind },
        firstName: c.extract.contact.name.split(" ")[0] ?? "",
      });
      if (email) patch(id, { email });
      return email;
    },
    [patch]
  );

  const send = useCallback(
    async (id: string, to: string, subject: string, text: string, kind: EmailKind) => {
      await post<{ id: string }>("/api/send", { to, subject, text, candidateId: id, kind });
      patch(id, { sentAt: Date.now(), sentKind: kind });
    },
    [patch]
  );

  const remove = useCallback((id: string) => {
    const c = latest.current.find((x) => x.id === id);
    if (c && !c.sample && saved.current.has(id)) {
      fetch(`/api/candidates/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => setSaveError("Couldn't delete from Supabase"));
    }
    saved.current.delete(id);
    pending.current.delete(id);
    files.current.delete(id);
    queue.current = queue.current.filter((q) => q !== id);
    setCandidates((cs) => cs.filter((c) => c.id !== id));
  }, []);

  const replaceAll = useCallback((cs: Candidate[]) => setCandidates(cs), []);

  return { candidates, ready, mode, saving, saveError, addFiles, retry, patch, draftEmail, send, remove, replaceAll };
}
