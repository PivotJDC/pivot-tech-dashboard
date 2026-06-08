import { cn } from "@/lib/utils";

// Tone per known account / port / DID status. Unknown values fall back to slate.
const TONES: Record<string, string> = {
  // accounts
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  suspended: "bg-orange-100 text-orange-800",
  cancelled: "bg-slate-200 text-slate-600",
  // dids
  available: "bg-sky-100 text-sky-800",
  assigned: "bg-emerald-100 text-emerald-800",
  porting_in: "bg-amber-100 text-amber-800",
  porting_out: "bg-amber-100 text-amber-800",
  reserved: "bg-violet-100 text-violet-800",
  // ports
  submitted: "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const value = status ?? "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONES[value] ?? "bg-slate-200 text-slate-600",
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
