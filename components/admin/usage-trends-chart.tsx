"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { getUsageTrends, type TrendPeriod } from "@/lib/admin-api";

const AXIS = { stroke: "#94a3b8", fontSize: 11 };
const PERIODS: { key: TrendPeriod; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

/** MB -> GB (number), for the Y axis + tooltip. */
const toGb = (mb: number) => mb / 1024;

export function UsageTrendsChart() {
  const [period, setPeriod] = useState<TrendPeriod>("day");
  const fetcher = useCallback(() => getUsageTrends(period), [period]);
  const { data, loading, error } = useAdminFetch(fetcher, [period]);

  const points = (data ?? []).map((p) => ({ label: p.label, gb: toGb(p.total_mb) }));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Data Usage Trends
        </h2>
        <div className="inline-flex rounded-md border border-slate-200 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                period === p.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[280px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-6 text-sm text-red-600">{error}</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={points} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="usageTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="label" tickLine={false} minTickGap={24} {...AXIS} />
            <YAxis
              tickLine={false}
              width={48}
              tickFormatter={(v) => `${Math.round(v)} GB`}
              {...AXIS}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
              formatter={(v) => [`${Number(v).toFixed(1)} GB`, "Data used"]}
            />
            <Area
              type="monotone"
              dataKey="gb"
              name="Data used"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#usageTrendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
