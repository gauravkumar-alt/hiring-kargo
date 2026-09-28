import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreCv } from "@/lib/score";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({ cv: z.string().min(50), role: z.enum(["PM", "SPM"]) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected { cv, role }" }, { status: 400 });
  try {
    return NextResponse.json(await scoreCv(parsed.data.cv, parsed.data.role));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scoring failed" }, { status: 502 });
  }
}
