"use client";

import { useRef, useState } from "react";
import { gsap, useGSAP } from "@/components/gsap";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLFormElement>(null);

  useGSAP(() => {
    gsap.from(card.current, { opacity: 0, y: 20, duration: 0.7, ease: "power3.out" });
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    setBusy(false);
    setError((await res.json().catch(() => ({})))?.error || "Couldn't sign in");
    gsap.fromTo(card.current, { x: -8 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
  };

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form ref={card} onSubmit={submit} className="card w-full max-w-sm p-7">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-coral text-sm font-extrabold text-white">K</span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Kargo hiring desk</h1>
        <p className="mt-1 text-sm text-muted">Candidate data is private. Enter the team password.</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-5 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-pass">{error}</p>}
        <button type="submit" className="btn btn-primary mt-4 w-full justify-center" disabled={busy || !password}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
