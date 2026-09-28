import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD;
  const { password: given } = await req.json().catch(() => ({ password: "" }));
  if (!password) return NextResponse.json({ ok: true });
  // Small fixed delay to blunt password guessing.
  await new Promise((r) => setTimeout(r, 400));
  if (typeof given !== "string" || given !== password) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
