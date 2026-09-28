// Single shared password for the founder (APP_PASSWORD). The session cookie holds a hash of it,
// so changing the password logs everyone out. No password set = gate is off (local dev).
export const SESSION_COOKIE = "kargo_session";

export async function sessionToken(password: string) {
  const bytes = new TextEncoder().encode(`kargo-hiring:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
