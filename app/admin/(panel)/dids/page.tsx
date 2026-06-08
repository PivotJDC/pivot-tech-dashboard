"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";

import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { listDids, type Did } from "@/lib/admin-api";
import { formatPhone } from "@/lib/format";

// Inventory view: pull a large page and group client-side by market.
const FETCH_LIMIT = 100;

export default function DidsPage() {
  const fetcher = useCallback(() => listDids({ limit: FETCH_LIMIT }), []);
  const { data, loading, error } = useAdminFetch(fetcher, []);

  const dids = data?.dids ?? [];
  const total = data?.pagination.total ?? 0;
  const byMarket = groupByMarket(dids);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">DID inventory</h1>
        <p className="text-sm text-slate-500">{total.toLocaleString()} numbers</p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading inventory…
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : dids.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          No DIDs in inventory yet.
        </p>
      ) : (
        <div className="space-y-8">
          {Object.entries(byMarket).map(([market, rows]) => (
            <section key={market}>
              <h2 className="mb-2 flex items-baseline gap-2">
                <span className="font-semibold text-slate-900">{market}</span>
                <span className="text-sm text-slate-500">
                  {rows.length.toLocaleString()} numbers
                </span>
              </h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Number</th>
                      <th className="px-4 py-3 font-medium">Area code</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Assigned to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-3 font-medium tabular-nums text-slate-900">
                          {formatPhone(d.e164)}
                        </td>
                        <td className="px-4 py-3">{d.area_code}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {d.account_id ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          {total > dids.length && (
            <p className="text-xs text-slate-400">
              Showing the first {FETCH_LIMIT} of {total.toLocaleString()} DIDs.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function groupByMarket(dids: Did[]): Record<string, Did[]> {
  return dids.reduce<Record<string, Did[]>>((acc, d) => {
    const key = d.market || "unknown";
    (acc[key] ??= []).push(d);
    return acc;
  }, {});
}
