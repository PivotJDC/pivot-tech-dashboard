import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      {sublabel && <p className="mt-1 text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}
