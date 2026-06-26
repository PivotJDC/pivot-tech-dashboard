/**
 * Area code → middleware market slug.
 *
 * Mirrors the middleware's launched markets (src/config/markets.js):
 *   lewiston-id → 208,  kendall-il → 630 / 331
 *
 * `market` is OPTIONAL on POST /v1/accounts — any US area code is allowed. For a
 * launched area code we send its slug; for anything else we return undefined and
 * omit `market`, and the middleware defaults to "direct" and searches the chosen
 * number's area code.
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

export function marketForAreaCode(areacode: string): string | undefined {
  return AREA_CODE_TO_MARKET[areacode];
}

/** Best-effort area code from an E.164 / dialed US number (+1AAANXXXXXX). */
export function areaCodeFromNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  return national.length >= 3 ? national.slice(0, 3) : null;
}
