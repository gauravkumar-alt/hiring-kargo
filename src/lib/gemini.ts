import "server-only";

// Full Flash (not Lite): these scores feed hiring calls, so reading nuance in a CV is worth the extra cost.
// "-latest" alias so this doesn't go stale as Google ships new versions. Override with GEMINI_MODEL.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Call Gemini with a JSON response schema. Retries rate limits and overloads with backoff. */
export async function generateJson<T>(prompt: string, schema: object, temperature = 0.2): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).");

  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (!text) throw new Error("Gemini returned no content (the response may have been blocked).");
      return JSON.parse(text) as T;
    }

    lastError = `Gemini request failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw new Error(lastError);
}
