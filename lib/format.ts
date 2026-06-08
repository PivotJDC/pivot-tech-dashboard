/** Shared display formatters. */

/** +12085550100 → (208) 555-0100; returns input unchanged if not 10-digit NANP. */
export function formatPhone(e164?: string | null): string {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length !== 10) return e164;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}

/** ISO timestamp → "Jun 8, 2026". Returns "—" for missing values. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
