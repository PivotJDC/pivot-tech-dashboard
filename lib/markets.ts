/**
 * Area code → middleware market slug.
 *
 * Mirrors the middleware's launched markets (src/config/markets.js):
 *   lewiston-id → 208,  kendall-il → 630 / 331
 *
 * Any US area code is allowed (new number or port-in). For a launched area code
 * we send its slug; for anything else we return "national" (the middleware
 * searches the number's area code and never rejects on market).
 */
const AREA_CODE_TO_MARKET: Record<string, string> = {
  "208": "lewiston-id",
  "630": "kendall-il",
  "331": "kendall-il",
};

/** Suggested (launched) area codes shown as chips in the number picker. */
export const SUGGESTED_AREA_CODES: { code: string; label: string }[] = [
  { code: "208", label: "Lewiston, ID" },
  { code: "630", label: "Kendall, IL" },
  { code: "331", label: "Kendall, IL" },
];

/** Launched-market slug for an area code, or "national" for anything else. */
export function marketForAreaCode(areacode: string): string {
  return AREA_CODE_TO_MARKET[areacode] ?? "national";
}

/** Best-effort area code from an E.164 / dialed US number (+1AAANXXXXXX). */
export function areaCodeFromNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  return national.length >= 3 ? national.slice(0, 3) : null;
}

/**
 * Normalize any 10-digit US number (formatted or not, with/without a leading 1)
 * to E.164 (+1AAANXXXXXX), or null if it isn't a 10-digit US number. Used so a
 * port-in from any US area code reaches the middleware in E.164.
 */
export function toUsE164(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  return national.length === 10 ? `+1${national}` : null;
}
