import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Lets the UI tell the founder which keys are missing, without exposing them. */
export async function GET() {
  return NextResponse.json({
    ai: Boolean(process.env.GEMINI_API_KEY),
    email: Boolean(process.env.RESEND_API_KEY && process.env.FROM_EMAIL),
    db: supabaseConfigured(),
    sender: process.env.SENDER_NAME || "Arjun",
  });
}
