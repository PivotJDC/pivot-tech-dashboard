"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { getHourlyDataVoice } from "@/lib/admin-api";

const AXIS = { stroke: "#94a3b8", fontSize: 11 };

export function DataVoiceChart() {
  const fetcher = useCallback(() => getHourlyDataVoice(), []);
  const { data, loading, error } = useAdminFetch(fetcher, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Data Usage vs Voice Activity
      </h2>
      {loading ? (
        <div className="flex h-[260px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-6 text-sm text-red-600">{error}</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data ?? []} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="hour"
              interval={1}
              tickFormatter={(h) => `${h}:00`}
              tickLine={false}
              {...AXIS}
            />
            <YAxis yAxisId="left" allowDecimals={false} tickLine={false} width={40} {...AXIS} />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tickLine={false}
              width={40}
              {...AXIS}
            />
            <Tooltip
              labelFormatter={(h) => `${h}:00`}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="left"
              dataKey="call_count"
              name="Data activity (calls)"
              fill="#38bdf8"
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="voice_minutes"
              name="Voice minutes"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
