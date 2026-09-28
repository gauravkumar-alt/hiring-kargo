import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/supabase/candidates";
import { supabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** mode "local" tells the dashboard to fall back to browser storage when Supabase isn't set up. */
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ mode: "local", candidates: [] });
  try {
    return NextResponse.json({ mode: "db", candidates: await listCandidates() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load candidates" }, { status: 500 });
  }
}
