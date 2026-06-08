"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { listPorts } from "@/lib/admin-api";
import { formatDate, formatPhone } from "@/lib/format";

const FETCH_LIMIT = 100;
const PORT_STATUSES = [
  "submitted",
  "pending",
  "approved",
  "completed",
  "failed",
  "cancelled",
];

export default function PortsPage() {
  const [status, setStatus] = useState("");

  const fetcher = useCallback(
    () => listPorts({ status, limit: FETCH_LIMIT }),
    [status],
  );
  const { data, loading, error } = useAdminFetch(fetcher, [status]);

  const ports = data?.ports ?? [];
  const total = data?.pagination.total ?? 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Port requests</h1>
        <p className="text-sm text-slate-500">{total.toLocaleString()} total</p>
      </header>

      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">All</option>
            {PORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Number</th>
              <th className="px-4 py-3 font-medium">Carrier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : ports.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No port requests match this filter.
                </td>
              </tr>
            ) : (
              ports.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                    {formatPhone(p.number_e164)}
                  </td>
                  <td className="px-4 py-3">{p.losing_carrier || "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(p.submitted_at ?? p.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > ports.length && (
        <p className="mt-3 text-xs text-slate-400">
          Showing the first {FETCH_LIMIT} of {total.toLocaleString()} ports.
        </p>
      )}
    </div>
  );
}
