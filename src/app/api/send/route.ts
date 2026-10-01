import { NextResponse } from "next/server";
import { z } from "zod";
import { recordSend } from "@/lib/supabase/candidates";
import { supabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

// While EMAIL_TEST_REDIRECT is set, every email goes to that inbox instead of the candidate.
// Resend's test sender can only deliver to the account owner anyway, so this keeps sending usable for demos.
const DEFAULT_FROM = "Kargo Hiring <onboarding@resend.dev>";

const TEST_INBOX = () => process.env.EMAIL_TEST_REDIRECT?.trim() || "";

const body = z.object({
  to: z.string().trim().max(200),
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
  // Resend's shared test sender works without verifying a domain. Set FROM_EMAIL once a domain is verified.
  const from = process.env.FROM_EMAIL?.trim() || DEFAULT_FROM;
  if (!key) {
    return NextResponse.json({ error: "Email isn't set up yet: RESEND_API_KEY is missing on the server." }, { status: 500 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the recipient email, subject and body." }, { status: 400 });
  const { to, candidateId, kind } = parsed.data;
  let { subject, text } = parsed.data;
  const testInbox = TEST_INBOX();
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (!testInbox && !isEmail(to)) {
    return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
  }
  const deliverTo = testInbox || to;
  if (testInbox) {
    subject = `[Test · for ${to || "candidate"}] ${subject}`;
    text = `Test mode: this email was written for ${to || "the candidate"} and sent to you instead.\n\n${text}`;
  }

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1b1d22">${text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [deliverTo], subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: data?.message || `Resend returned ${res.status}` }, { status: 502 });
  }
  if (supabaseConfigured() && candidateId) {
    await recordSend(candidateId, { to: testInbox ? `${deliverTo} (test, for ${to})` : to, kind: kind ?? "invite", subject, body: text, resendId: data.id }).catch((e) =>
      console.error("recordSend failed:", e)
    );
  }
  return NextResponse.json({ id: data.id, deliveredTo: testInbox ? "test inbox" : to });
}
