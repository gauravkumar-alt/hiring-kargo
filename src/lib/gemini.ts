import "server-only";

// Full Flash (not Lite): these scores feed hiring calls, so reading nuance in a CV is worth the extra cost.
// "-latest" alias so this doesn't go stale as Google ships new versions. Override with GEMINI_MODEL.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Marker the dashboard uses to pause the rest of the queue instead of burning more requests. */
export const DAILY_LIMIT_MESSAGE =
  "Gemini's daily limit is used up. Nothing more can be scored until it resets (or billing is turned on in Google AI Studio). Use Retry then.";

// Overloads (503) are usually brief. Keep total waiting well under Vercel's 60s function limit.
const OVERLOAD_WAITS_MS = [2000, 5000, 10000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Pull quota type and suggested wait out of a Gemini 429 body. */
function parse429(body: string) {
  const daily = /PerDay/i.test(body);
  const delay = body.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return { daily, retryMs: delay ? Number(delay[1]) * 1000 : null };
}

/** Call Gemini with a JSON response schema. Retries brief overloads; stops at once on a daily quota. */
export async function generateJson<T>(prompt: string, schema: object, temperature = 0.2): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local (see .env.example).");

  let lastError = "";
  for (let attempt = 0; attempt <= OVERLOAD_WAITS_MS.length; attempt++) {
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

    const body = await res.text().catch(() => "");
    const lastTry = attempt === OVERLOAD_WAITS_MS.length;

    if (res.status === 429) {
      const { daily, retryMs } = parse429(body);
      // Retrying a daily quota just wastes requests; the per-minute one clears on its own.
      if (daily) throw new Error(DAILY_LIMIT_MESSAGE);
      if (lastTry || (retryMs !== null && retryMs > 20000)) {
        throw new Error("Gemini is rate-limiting requests right now. Wait a minute, then use Retry.");
      }
      await sleep(retryMs ?? OVERLOAD_WAITS_MS[attempt]);
      continue;
    }

    if (res.status >= 500) {
      lastError = "Gemini is overloaded right now (Google's side). Wait a minute, then use Retry.";
      if (lastTry) break;
      await sleep(OVERLOAD_WAITS_MS[attempt]);
      continue;
    }

    lastError = `Gemini request failed (${res.status}): ${body.slice(0, 300)}`;
    break;
  }
  throw new Error(lastError);
}
