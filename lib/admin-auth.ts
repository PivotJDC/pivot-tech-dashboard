/**
 * Admin auth — MVP.
 *
 * The frontend is NOT the auth gate. Any non-empty token the user enters is
 * stored and sent as `Authorization: Bearer` to the middleware admin API, which
 * validates it (an admin JWT) and rejects invalid ones with 401/403 — at which
 * point useAdminFetch clears it and bounces back to /admin. There is no
 * NEXT_PUBLIC_ADMIN_TOKEN comparison; the middleware is the source of truth.
 *
 * SECURITY NOTE: this stores a bearer credential in sessionStorage for an
 * internal tool. Acceptable for MVP; move to an httpOnly cookie / real session
 * before wider exposure.
 */
const TOKEN_KEY = "pivot.admin.token";

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
