import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteCandidate, saveCandidate } from "@/lib/supabase/candidates";
import { supabaseConfigured } from "@/lib/supabase/server";
import type { Candidate } from "@/lib/types";

const candidate = z
  .object({
    id: z.string().regex(/^[\w-]{4,64}$/),
    fileName: z.string().max(300),
    role: z.enum(["PM", "SPM"]),
    addedAt: z.number(),
    stage: z.enum(["queued", "extract", "score", "draft", "done", "error"]),
  })
  .passthrough();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase isn't configured" }, { status: 503 });
  const parsed = candidate.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.id !== id) return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
  try {
    await saveCandidate(parsed.data as unknown as Candidate);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseConfigured()) return NextResponse.json({ ok: true });
  try {
    await deleteCandidate(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 500 });
  }
}
