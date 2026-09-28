import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBrief, generateEmail } from "@/lib/draft";
import type { ScoreResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const body = z.object({
  cv: z.string().min(50),
  role: z.enum(["PM", "SPM"]),
  result: z.custom<ScoreResult>((v) => typeof v === "object" && v !== null && "scores" in v),
  want: z.object({ brief: z.boolean(), email: z.enum(["invite", "rejection"]).nullable() }),
  firstName: z.string().max(60).default(""),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid draft request" }, { status: 400 });
  const { cv, role, result, want, firstName } = parsed.data;
  try {
    const [brief, email] = await Promise.all([
      want.brief ? generateBrief(cv, role, result) : Promise.resolve(undefined),
      want.email ? generateEmail(cv, role, result, want.email, firstName) : Promise.resolve(undefined),
    ]);
    return NextResponse.json({ brief, email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Drafting failed" }, { status: 502 });
  }
}
