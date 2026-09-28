import { NextResponse } from "next/server";
import { z } from "zod";
import { recordSend } from "@/lib/supabase/candidates";
import { supabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const body = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(10000),
  candidateId: z.string().max(64).optional(),
  kind: z.enum(["invite", "rejection"]).optional(),
});

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Only ever called when the founder clicks Send and confirms. Nothing is sent automatically. */
export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!key || !from) {
    return NextResponse.json({ error: "Email isn't set up yet. Add RESEND_API_KEY and FROM_EMAIL to .env.local." }, { status: 500 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the recipient email, subject and body." }, { status: 400 });
  const { to, subject, text, candidateId, kind } = parsed.data;

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b1d22">${text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data?.message || `Resend returned ${res.status}` }, { status: 502 });
  }
  if (supabaseConfigured() && candidateId) {
    await recordSend(candidateId, { to, kind: kind ?? "invite", subject, body: text, resendId: data.id }).catch((e) =>
      console.error("recordSend failed:", e)
    );
  }
  return NextResponse.json({ id: data.id });
}
