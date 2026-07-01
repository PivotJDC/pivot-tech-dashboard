"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { getUsageDistribution } from "@/lib/admin-api";

const AXIS = { stroke: "#94a3b8", fontSize: 11 };
// Light -> heavy usage ramp (slate/blue to amber).
const COLORS = ["#cbd5e1", "#94a3b8", "#38bdf8", "#0ea5e9", "#f59e0b", "#ef4444"];

export function UsageDistributionChart() {
  const fetcher = useCallback(() => getUsageDistribution(), []);
  const { data, loading, error } = useAdminFetch(fetcher, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Subscriber Usage Distribution
      </h2>
      {loading ? (
        <div className="flex h-[260px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-6 text-sm text-red-600">{error}</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="bucket" tickLine={false} {...AXIS} />
            <YAxis allowDecimals={false} tickLine={false} width={40} {...AXIS} />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
              formatter={(v) => [`${v}`, "Subscribers"]}
            />
            <Bar dataKey="count" name="Subscribers" radius={[4, 4, 0, 0]}>
              {(data ?? []).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
