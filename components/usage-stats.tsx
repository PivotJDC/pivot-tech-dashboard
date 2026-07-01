import {
  Database, Phone, MessageSquare, Image as ImageIcon,
} from "lucide-react";

import type { UsageStats } from "@/lib/api";

/** MB -> "12.4 GB" (or "820 MB" under 1 GB). */
function formatData(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

/**
 * Usage-this-period display: a data progress bar plus voice/SMS/MMS counters.
 * Shared by the customer account page and the admin account detail page.
 */
export function UsageStatsView({ stats }: { stats: UsageStats }) {
  const cap = stats.data_cap_mb;
  const used = stats.data_used_mb;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const over = cap > 0 && used > cap;

  return (
    <div className="space-y-5">
      {/* Data */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Database className="h-4 w-4 text-muted-foreground" />
            Data
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatData(used)}
            {cap > 0 ? ` / ${formatData(cap)}` : ""}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${over ? "bg-red-500" : "bg-primary"}`}
            style={{ width: `${cap > 0 ? pct : 0}%` }}
          />
        </div>
      </div>

      {/* Voice / SMS / MMS */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat icon={<Phone className="h-4 w-4" />} value={`${stats.voice_minutes}`} label="minutes" />
        <Stat icon={<MessageSquare className="h-4 w-4" />} value={`${stats.sms_count}`} label="SMS sent" />
        <Stat icon={<ImageIcon className="h-4 w-4" />} value={`${stats.mms_count}`} label="MMS sent" />
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-3">
      <div className="mb-1 flex justify-center text-muted-foreground">{icon}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
