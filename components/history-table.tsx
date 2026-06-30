import { Phone, MessageSquare, ArrowDownLeft, ArrowUpRight } from "lucide-react";

import type { CallRecord, MessageRecord } from "@/lib/api";
import { formatPhone } from "@/lib/format";

type Row =
  | ({ kind: "call" } & CallRecord)
  | ({ kind: "message" } & MessageRecord);

/** ISO -> "Jun 8, 2026, 3:04 PM" (or "—"). */
function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Seconds -> "m:ss". */
function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Combined, newest-first table of an account's calls + messages. Shared by the
 * customer account page and the admin account detail page.
 */
export function HistoryTable({
  calls,
  messages,
  emptyLabel = "No calls or messages yet.",
}: {
  calls: CallRecord[];
  messages: MessageRecord[];
  emptyLabel?: string;
}) {
  const rows: Row[] = [
    ...calls.map((c) => ({ kind: "call" as const, ...c })),
    ...messages.map((m) => ({ kind: "message" as const, ...m })),
  ].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Direction</th>
            <th className="px-3 py-2 font-medium">From / To</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.id}`} className="align-top">
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {formatWhen(r.created_at)}
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  {r.kind === "call" ? (
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {r.kind === "call" ? "Call" : (r.message_type || "sms").toUpperCase()}
                </span>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1 capitalize">
                  {r.direction === "inbound" ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-sky-600" />
                  )}
                  {r.direction}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                {formatPhone(r.from_number)}
                <span className="px-1 text-muted-foreground">→</span>
                {formatPhone(r.to_number)}
              </td>
              <td className="px-3 py-2 capitalize text-muted-foreground">
                {r.status?.replace(/_/g, " ")}
              </td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                {r.kind === "call" ? formatDuration(r.duration_seconds) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
