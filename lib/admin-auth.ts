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
 *
 * Trimmed: a value pasted into the Netlify UI (or a here-doc/CI export) can
 * carry a trailing newline or spaces that would otherwise never match the
 * typed/pasted password.
 */
export function getConfiguredToken(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "").trim();
}

/**
 * True when the entered password matches the configured admin token.
 *
 * Both sides are trimmed before comparison — the usual cause of "correct token
 * still fails" is invisible whitespace (a trailing \n from pasting a JWT, or a
 * stray space in the env var). The debug logging below reports lengths and the
 * first character that differs (by char code, so whitespace is visible) without
 * printing the full token; remove it once login is confirmed working.
 */
export function verifyAdminPassword(input: string): boolean {
  const rawConfigured = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "";
  const configured = rawConfigured.trim();
  const candidate = input.trim();
  const match = configured.length > 0 && candidate === configured;

  // eslint-disable-next-line no-console
  console.log("[admin-auth] verifyAdminPassword", {
    inputLength: input.length,
    inputTrimmedLength: candidate.length,
    configuredLength: rawConfigured.length,
    configuredTrimmedLength: configured.length,
    match,
  });

  if (!match && configured.length > 0) {
    const max = Math.max(candidate.length, configured.length);
    let i = 0;
    while (i < max && candidate[i] === configured[i]) i += 1;
    // eslint-disable-next-line no-console
    console.log("[admin-auth] first mismatch", {
      index: i,
      inputCharCode: i < candidate.length ? candidate.charCodeAt(i) : null,
      configuredCharCode: i < configured.length ? configured.charCodeAt(i) : null,
    });
  }

  return match;
}

/** Persist the token (trimmed) so the Bearer sent to the API is clean. */
export function saveAdminToken(token: string) {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(TOKEN_KEY, token.trim());
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
