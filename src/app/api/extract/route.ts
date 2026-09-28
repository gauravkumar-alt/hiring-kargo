import { NextResponse } from "next/server";
import { fileToText, redact } from "@/lib/extract";
import { uploadCv } from "@/lib/supabase/candidates";
import { supabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "File is over 8 MB" }, { status: 400 });

    const text = await fileToText(file);
    if (text.trim().length < 80) {
      return NextResponse.json(
        { error: "Couldn't read any text from this file. If it's a scanned PDF, export it as a text PDF or DOCX." },
        { status: 422 }
      );
    }
    const id = String(form.get("id") ?? "");
    const cvPath = supabaseConfigured() && /^[\w-]{4,64}$/.test(id) ? await uploadCv(id, file) : undefined;
    return NextResponse.json({ ...redact(text, file.name), cvPath });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't read this file" }, { status: 500 });
  }
}
