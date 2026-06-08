/**
 * Area code → middleware market slug.
 *
 * Mirrors the middleware's configured markets (src/config/markets.js):
 *   lewiston-id → 208,  kendall-il → 630 / 331
 *
 * The middleware requires a `market` on POST /v1/accounts. For a new number the
 * customer picks an area code, so we map it here. Unknown area codes fall back
 * to a derived slug — the middleware will reject markets it doesn't serve, and
 * we surface that error to the customer rather than guessing a real market.
 */
const AREA_CODE_TO_MARKET: Record<string, string> = {
  "208": "lewiston-id",
  "630": "kendall-il",
  "331": "kendall-il",
};

export function marketForAreaCode(areacode: string): string {
  return AREA_CODE_TO_MARKET[areacode] ?? `area-${areacode}`;
}

/** Best-effort area code from an E.164 / dialed US number (+1AAANXXXXXX). */
export function areaCodeFromNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  return national.length >= 3 ? national.slice(0, 3) : null;
}
