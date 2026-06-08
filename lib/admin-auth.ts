/**
 * Admin auth — MVP password gate.
 *
 * SECURITY NOTE: NEXT_PUBLIC_ADMIN_TOKEN is inlined into the client bundle, so
 * it is NOT secret from anyone who loads the admin page. This is an explicitly
 * accepted MVP tradeoff (no OAuth yet) for an internal-only tool. The token
 * doubles as the Bearer credential sent to the middleware admin API, so its
 * value must be a credential the middleware's adminAuth accepts (an admin JWT).
 * Replace with real auth before exposing /admin beyond the ops team.
 */
const TOKEN_KEY = "pivot.admin.token";

/**
 * The configured admin token, read directly from NEXT_PUBLIC_ADMIN_TOKEN.
 * Next.js statically inlines this reference into the client bundle at build
 * time, so the env var MUST be present in the build environment (netlify.toml
 * [build.environment] or the Netlify UI) — at runtime there is no process.env
 * on the client, only the baked-in literal.
 */
export function getConfiguredToken(): string {
  return process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "";
}

/** True when the entered password matches the configured admin token. */
export function verifyAdminPassword(input: string): boolean {
  const token = getConfiguredToken();
  return token.length > 0 && input === token;
}

export function saveAdminToken(token: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function clearAdminToken() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(TOKEN_KEY);
  }
}
