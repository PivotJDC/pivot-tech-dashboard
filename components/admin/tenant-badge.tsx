import { cn } from "@/lib/utils";

// Tenant lifecycle tones: active=green, onboarding=yellow, suspended=red.
const TENANT_TONES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  onboarding: "bg-amber-100 text-amber-800",
  suspended: "bg-red-100 text-red-800",
  cancelled: "bg-slate-200 text-slate-600",
};

export function TenantBadge({ status }: { status?: string | null }) {
  const value = status ?? "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TENANT_TONES[value] ?? "bg-slate-200 text-slate-600",
      )}
    >
      {value}
    </span>
  );
}
