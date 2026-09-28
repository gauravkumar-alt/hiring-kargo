import { NextResponse } from "next/server";
import { cvSignedUrl, getCandidate } from "@/lib/supabase/candidates";
import { supabaseConfigured } from "@/lib/supabase/server";

/** Opens the original CV via a 5-minute signed link. The bucket itself is private. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase isn't configured" }, { status: 503 });
  const c = await getCandidate(id);
  if (!c?.cvPath) return NextResponse.json({ error: "No stored file for this candidate" }, { status: 404 });
  return NextResponse.redirect(await cvSignedUrl(c.cvPath));
}
