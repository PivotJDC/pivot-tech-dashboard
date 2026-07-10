"use client";

/**
 * Revenue & Margin analytics.
 *
 * Pulls the current month's subscriber count, MRR, and usage volumes from
 * GET /admin/analytics/margin, then applies admin-entered vendor COST rates
 * (Telnyx voice/SMS/MMS, BICS data) to compute cost, gross margin, and margin %.
 *
 * The rates are not available from any API — the admin types them in. They
 * persist to localStorage and recalculate everything on every change.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { getMarginMetrics } from "@/lib/admin-api";

const STORAGE_KEY = "pivot.admin.costRates";
const AXIS = { stroke: "#94a3b8", fontSize: 11 };

// Default vendor cost rates (USD).
const DEFAULT_RATES = {
  voice: "0.005", // $ per minute (Telnyx)
  data: "1.05", // $ per GB (BICS)
  sms: "0.004", // $ per message (Telnyx)
  mms: "0.01", // $ per message (Telnyx)
};
type Rates = typeof DEFAULT_RATES;
type RateKey = keyof Rates;

const RATE_FIELDS: { key: RateKey; label: string; unit: string; step: string }[] = [
  { key: "voice", label: "Voice rate", unit: "$ / min", step: "0.001" },
  { key: "data", label: "Data rate", unit: "$ / GB", step: "0.01" },
  { key: "sms", label: "SMS rate", unit: "$ / msg", step: "0.001" },
  { key: "mms", label: "MMS rate", unit: "$ / msg", step: "0.001" },
];

const COLORS = {
  revenue: "#22c55e",
  voice: "#3b82f6",
  data: "#f59e0b",
  sms: "#a855f7",
  mms: "#ec4899",
  margin: "#0ea5e9",
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const rate = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export function RevenueMarginCard() {
  const fetcher = useCallback(() => getMarginMetrics(), []);
  const { data, loading, error } = useAdminFetch(fetcher, []);

  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);

  // Load persisted rates on mount (client-only, to avoid a hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRates({ ...DEFAULT_RATES, ...JSON.parse(raw) });
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const updateRate = useCallback((key: RateKey, value: string) => {
    setRates((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable (private mode) — calc still works */
      }
      return next;
    });
  }, []);

  // Real-time cost / margin calculation (recomputes on rate or data change).
  const calc = useMemo(() => {
    const m = data ?? {
      subscribers: 0, mrr: 0, voice_minutes: 0, data_gb: 0, sms_count: 0, mms_count: 0,
    };
    const voiceCost = m.voice_minutes * rate(rates.voice);
    const dataCost = m.data_gb * rate(rates.data);
    const smsCost = m.sms_count * rate(rates.sms);
    const mmsCost = m.mms_count * rate(rates.mms);
    const totalCost = voiceCost + dataCost + smsCost + mmsCost;
    const revenue = m.mrr;
    const grossMargin = revenue - totalCost;
    const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
    const perSubMargin = m.subscribers > 0 ? grossMargin / m.subscribers : 0;
    return {
      voiceCost, dataCost, smsCost, mmsCost, totalCost,
      revenue, grossMargin, marginPct, perSubMargin,
    };
  }, [data, rates]);

  const rows = data
    ? [
      { key: "voice", label: "Voice", usage: `${num(data.voice_minutes)} min`, rateStr: `${usd(rate(rates.voice))}/min`, cost: calc.voiceCost },
      { key: "data", label: "Data", usage: `${num(data.data_gb)} GB`, rateStr: `${usd(rate(rates.data))}/GB`, cost: calc.dataCost },
      { key: "sms", label: "SMS", usage: `${num(data.sms_count)} msgs`, rateStr: `${usd(rate(rates.sms))}/msg`, cost: calc.smsCost },
      { key: "mms", label: "MMS", usage: `${num(data.mms_count)} msgs`, rateStr: `${usd(rate(rates.mms))}/msg`, cost: calc.mmsCost },
    ]
    : [];

  const chartData = [
    {
      name: "This month",
      revenue: calc.revenue,
      voice: calc.voiceCost,
      data: calc.dataCost,
      sms: calc.smsCost,
      mms: calc.mmsCost,
      margin: calc.grossMargin,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Revenue &amp; Margin
        </h2>
        {data && (
          <span className="text-xs text-slate-400">
            {data.subscribers.toLocaleString()} active subscribers · current month
          </span>
        )}
      </div>

      {/* Cost-rate inputs (vendor rates, entered manually, persisted locally). */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RATE_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">{f.label}</span>
            <div className="flex items-center rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-slate-400">
              <span className="pl-2.5 text-sm text-slate-400">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={f.step}
                value={rates[f.key]}
                onChange={(e) => updateRate(f.key, e.target.value)}
                className="w-full bg-transparent px-1.5 py-1.5 text-sm tabular-nums focus:outline-none"
              />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-slate-400">{f.unit}</span>
          </label>
        ))}
      </div>

      {loading ? (
        <div className="flex h-[220px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-6 text-sm text-red-600">{error}</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Summary label="Plan revenue" value={usd(calc.revenue)} tone="neutral" />
            <Summary label="Total cost" value={usd(calc.totalCost)} tone="neutral" />
            <Summary label="Gross margin" value={usd(calc.grossMargin)} tone={calc.grossMargin >= 0 ? "good" : "bad"} />
            <Summary label="Margin" value={`${calc.marginPct.toFixed(1)}%`} tone={calc.marginPct >= 0 ? "good" : "bad"} />
            <Summary label="Per-sub margin" value={`${usd(calc.perSubMargin)}/mo`} tone={calc.perSubMargin >= 0 ? "good" : "bad"} />
          </div>

          {/* Revenue vs stacked cost, with a gross-margin marker */}
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tickLine={false} {...AXIS} />
              <YAxis tickFormatter={(v) => `$${num(v)}`} tickLine={false} width={64} {...AXIS} />
              <Tooltip
                formatter={(value) => usd(Number(value))}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[3, 3, 0, 0]} maxBarSize={70} />
              <Bar dataKey="voice" name="Voice cost" stackId="cost" fill={COLORS.voice} maxBarSize={70} />
              <Bar dataKey="data" name="Data cost" stackId="cost" fill={COLORS.data} maxBarSize={70} />
              <Bar dataKey="sms" name="SMS cost" stackId="cost" fill={COLORS.sms} maxBarSize={70} />
              <Bar dataKey="mms" name="MMS cost" stackId="cost" fill={COLORS.mms} radius={[3, 3, 0, 0]} maxBarSize={70} />
              <Line
                type="monotone"
                dataKey="margin"
                name="Gross margin"
                stroke={COLORS.margin}
                strokeWidth={2}
                dot={{ r: 5, fill: COLORS.margin }}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Cost breakdown table */}
          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Usage</th>
                  <th className="px-4 py-2.5 font-medium">Rate</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: COLORS[r.key as keyof typeof COLORS] }}
                        />
                        {r.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.usage}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.rateStr}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{usd(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td className="px-4 py-2.5 font-semibold" colSpan={3}>
                    Total cost
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {usd(calc.totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "good" | "bad";
}) {
  const toneClass =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
    </div>
  );
}
