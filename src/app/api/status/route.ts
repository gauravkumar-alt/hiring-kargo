import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** The site is public, so only show enough of the test inbox to recognise it: "ga•••@pg27.mesaschool.co". */
function maskEmail(e: string) {
  if (!e.includes("@")) return null;
  const [user, domain] = e.split("@");
  return `${user.slice(0, 2)}•••@${domain}`;
}

/** Lets the UI tell the founder which keys are missing, without exposing them. */
export async function GET() {
  return NextResponse.json({
    ai: Boolean(process.env.GEMINI_API_KEY),
    email: Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL),
    db: supabaseConfigured(),
    emailTestInbox: maskEmail(process.env.EMAIL_TEST_REDIRECT?.trim() || ""),
    sender: process.env.SENDER_NAME || "Arjun",
  });
}
