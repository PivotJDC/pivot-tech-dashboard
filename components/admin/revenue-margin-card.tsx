"use client";

/**
 * Revenue & Margin — vendor-specific cost breakdown.
 *
 * Pulls current-month per-vendor usage volumes from GET /admin/analytics/
 * vendor-costs, then applies each vendor's own COST rates (BICS, Telnyx,
 * Acrobits) — admin-entered and persisted to localStorage — to compute cost,
 * gross margin, and margin %. A tab per vendor shows its editable rates and a
 * line-item cost breakdown; the summary + chart are always visible.
 */
import {
  useCallback, useEffect, useMemo, useState,
} from "react";
import { Loader2 } from "lucide-react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { getVendorCosts, type VendorCosts } from "@/lib/admin-api";

const STORAGE_KEY = "pivot.admin.vendorRates";

const VENDORS = ["bics", "telnyx", "acrobits"] as const;
type Vendor = (typeof VENDORS)[number];
type RateMap = Record<string, string>;
type AllRates = Record<Vendor, RateMap>;

const VENDOR_LABEL: Record<Vendor, string> = {
  bics: "BICS",
  telnyx: "Telnyx",
  acrobits: "Acrobits",
};

const COLORS = {
  bics: "#f59e0b", // orange
  telnyx: "#3b82f6", // blue
  acrobits: "#a855f7", // purple
  revenue: "#22c55e", // green
};

// Default vendor cost rates (USD).
const DEFAULT_RATES: AllRates = {
  bics: {
    simOrder: "420.00", // $ per SIM (one-time, new this month)
    simActivation: "0.30", // $ per SIM
    simMgmt: "0.10", // $ per SIM / month
    data1: "0.0012", // $ per MB (carrier 1)
    data2: "0.0017", // $ per MB (carrier 2)
  },
  telnyx: {
    voice: "0.005", // $ per minute
    sms: "0.004", // $ per message
    mms: "0.01", // $ per message
    did: "1.00", // $ per number / month
    e911: "1.50", // $ per address / month
  },
  acrobits: {
    license: "0", // $ per month (TBC with Acrobits)
    perSeat: "0", // $ per subscriber
  },
};

const RATE_FIELDS: Record<Vendor, { key: string; label: string; unit: string; step: string }[]> = {
  bics: [
    { key: "simOrder", label: "SIM card order", unit: "$ / SIM", step: "0.01" },
    { key: "simActivation", label: "SIM activation", unit: "$ / SIM", step: "0.01" },
    { key: "simMgmt", label: "SIM management", unit: "$ / SIM·mo", step: "0.01" },
    { key: "data1", label: "Data rate (carrier 1)", unit: "$ / MB", step: "0.0001" },
    { key: "data2", label: "Data rate (carrier 2)", unit: "$ / MB", step: "0.0001" },
  ],
  telnyx: [
    { key: "voice", label: "Voice", unit: "$ / min", step: "0.001" },
    { key: "sms", label: "SMS", unit: "$ / msg", step: "0.001" },
    { key: "mms", label: "MMS", unit: "$ / msg", step: "0.001" },
    { key: "did", label: "DID", unit: "$ / number·mo", step: "0.01" },
    { key: "e911", label: "E911", unit: "$ / address·mo", step: "0.01" },
  ],
  acrobits: [
    { key: "license", label: "License fee", unit: "$ / month", step: "0.01" },
    { key: "perSeat", label: "Per-seat fee", unit: "$ / subscriber", step: "0.01" },
  ],
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const parseRate = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

interface Row {
  label: string;
  units: string;
  rate: number;
  cost: number;
}

const EMPTY: VendorCosts = {
  bics: { active_sims: 0, new_sims: 0, data_mb: 0 },
  telnyx: {
    voice_minutes: 0, sms_count: 0, mms_count: 0, active_dids: 0,
  },
  subscribers: 0,
  mrr: 0,
};

export function RevenueMarginCard() {
  const fetcher = useCallback(() => getVendorCosts(), []);
  const { data, loading, error } = useAdminFetch(fetcher, []);

  const [rates, setRates] = useState<AllRates>(DEFAULT_RATES);
  const [tab, setTab] = useState<Vendor>("bics");

  // Load persisted rates on mount (client-only, to avoid a hydration mismatch).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AllRates>;
        setRates({
          bics: { ...DEFAULT_RATES.bics, ...saved.bics },
          telnyx: { ...DEFAULT_RATES.telnyx, ...saved.telnyx },
          acrobits: { ...DEFAULT_RATES.acrobits, ...saved.acrobits },
        });
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const updateRate = useCallback((vendor: Vendor, key: string, value: string) => {
    setRates((prev) => {
      const next = { ...prev, [vendor]: { ...prev[vendor], [key]: value } };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable (private mode) — calc still works */
      }
      return next;
    });
  }, []);

  // Real-time cost calculation (recomputes on rate or data change).
  const calc = useMemo(() => {
    const d = data ?? EMPTY;
    const r = {
      bics: Object.fromEntries(
        Object.entries(rates.bics).map(([k, v]) => [k, parseRate(v)]),
      ) as Record<string, number>,
      telnyx: Object.fromEntries(
        Object.entries(rates.telnyx).map(([k, v]) => [k, parseRate(v)]),
      ) as Record<string, number>,
      acrobits: Object.fromEntries(
        Object.entries(rates.acrobits).map(([k, v]) => [k, parseRate(v)]),
      ) as Record<string, number>,
    };

    const bicsRows: Row[] = [
      {
        label: "SIM orders (new this month)",
        units: `${num(d.bics.new_sims)}`,
        rate: r.bics.simOrder,
        cost: d.bics.new_sims * r.bics.simOrder,
      },
      {
        label: "SIM activations",
        units: `${num(d.bics.new_sims)}`,
        rate: r.bics.simActivation,
        cost: d.bics.new_sims * r.bics.simActivation,
      },
      {
        label: "SIM management (active SIMs)",
        units: `${num(d.bics.active_sims)}`,
        rate: r.bics.simMgmt,
        cost: d.bics.active_sims * r.bics.simMgmt,
      },
      {
        // Costed at the carrier-2 rate (worst case) pending carrier-split usage.
        label: "Data usage",
        units: `${num(d.bics.data_mb)} MB`,
        rate: r.bics.data2,
        cost: d.bics.data_mb * r.bics.data2,
      },
    ];

    const telnyxRows: Row[] = [
      {
        label: "Voice minutes",
        units: `${num(d.telnyx.voice_minutes)}`,
        rate: r.telnyx.voice,
        cost: d.telnyx.voice_minutes * r.telnyx.voice,
      },
      {
        label: "SMS",
        units: `${num(d.telnyx.sms_count)}`,
        rate: r.telnyx.sms,
        cost: d.telnyx.sms_count * r.telnyx.sms,
      },
      {
        label: "MMS",
        units: `${num(d.telnyx.mms_count)}`,
        rate: r.telnyx.mms,
        cost: d.telnyx.mms_count * r.telnyx.mms,
      },
      {
        label: "DID rental",
        units: `${num(d.telnyx.active_dids)}`,
        rate: r.telnyx.did,
        cost: d.telnyx.active_dids * r.telnyx.did,
      },
      {
        // One E911 address per active number (no separate DB count yet).
        label: "E911",
        units: `${num(d.telnyx.active_dids)}`,
        rate: r.telnyx.e911,
        cost: d.telnyx.active_dids * r.telnyx.e911,
      },
    ];

    const acrobitsRows: Row[] = [
      {
        label: "Monthly license",
        units: "1",
        rate: r.acrobits.license,
        cost: r.acrobits.license,
      },
      {
        label: "Per-seat",
        units: `${num(d.subscribers)} subscribers`,
        rate: r.acrobits.perSeat,
        cost: d.subscribers * r.acrobits.perSeat,
      },
    ];

    const total = (rows: Row[]) => rows.reduce((s, x) => s + x.cost, 0);
    const bicsTotal = total(bicsRows);
    const telnyxTotal = total(telnyxRows);
    const acrobitsTotal = total(acrobitsRows);
    const totalCost = bicsTotal + telnyxTotal + acrobitsTotal;
    const revenue = d.mrr;
    const grossMargin = revenue - totalCost;
    const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
    const perSubMargin = d.subscribers > 0 ? grossMargin / d.subscribers : 0;

    return {
      rowsByVendor: { bics: bicsRows, telnyx: telnyxRows, acrobits: acrobitsRows },
      totalByVendor: { bics: bicsTotal, telnyx: telnyxTotal, acrobits: acrobitsTotal },
      totalCost,
      revenue,
      grossMargin,
      marginPct,
      perSubMargin,
      subscribers: d.subscribers,
    };
  }, [data, rates]);

  const chartData = [
    {
      name: "This month",
      bics: calc.totalByVendor.bics,
      telnyx: calc.totalByVendor.telnyx,
      acrobits: calc.totalByVendor.acrobits,
      revenue: calc.revenue,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Revenue &amp; Margin — vendor costs
        </h2>
        {data && (
          <span className="text-xs text-slate-400">
            {data.subscribers.toLocaleString()} active subscribers · current month
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex h-[220px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-6 text-sm text-red-600">{error}</p>
      ) : (
        <>
          {/* Summary — always visible */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Summary label="BICS" value={usd(calc.totalByVendor.bics)} tone="neutral" />
            <Summary label="Telnyx" value={usd(calc.totalByVendor.telnyx)} tone="neutral" />
            <Summary label="Acrobits" value={usd(calc.totalByVendor.acrobits)} tone="neutral" />
            <Summary label="Total vendor cost" value={usd(calc.totalCost)} tone="neutral" />
            <Summary label="Plan revenue" value={usd(calc.revenue)} tone="neutral" />
            <Summary
              label="Gross margin"
              value={usd(calc.grossMargin)}
              tone={calc.grossMargin >= 0 ? "good" : "bad"}
            />
            <Summary
              label="Margin"
              value={`${calc.marginPct.toFixed(1)}%`}
              tone={calc.marginPct >= 0 ? "good" : "bad"}
            />
            <Summary
              label="Per-sub margin"
              value={`${usd(calc.perSubMargin)}/mo`}
              tone={calc.perSubMargin >= 0 ? "good" : "bad"}
            />
          </div>

          {/* Vendor cost vs revenue */}
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tickLine={false} stroke="#94a3b8" fontSize={11} />
              <YAxis
                tickFormatter={(v) => `$${num(v)}`}
                tickLine={false}
                width={64}
                stroke="#94a3b8"
                fontSize={11}
              />
              <Tooltip
                formatter={(value) => usd(Number(value))}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e2e8f0" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="bics" name="BICS" stackId="cost" fill={COLORS.bics} maxBarSize={70} />
              <Bar dataKey="telnyx" name="Telnyx" stackId="cost" fill={COLORS.telnyx} maxBarSize={70} />
              <Bar
                dataKey="acrobits"
                name="Acrobits"
                stackId="cost"
                fill={COLORS.acrobits}
                radius={[3, 3, 0, 0]}
                maxBarSize={70}
              />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill={COLORS.revenue}
                radius={[3, 3, 0, 0]}
                maxBarSize={70}
              />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Vendor tabs */}
          <div className="mt-6 flex gap-1 border-b border-slate-200">
            {VENDORS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTab(v)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  tab === v
                    ? "border-slate-800 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                  style={{ backgroundColor: COLORS[v] }}
                />
                {VENDOR_LABEL[v]}
              </button>
            ))}
          </div>

          {/* Active tab: editable rates + breakdown table */}
          <div className="pt-4">
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {RATE_FIELDS[tab].map((f) => (
                <label key={f.key} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">{f.label}</span>
                  <div className="flex items-center rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-slate-400">
                    <span className="pl-2.5 text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={f.step}
                      value={rates[tab][f.key]}
                      onChange={(e) => updateRate(tab, f.key, e.target.value)}
                      className="w-full bg-transparent px-1.5 py-1.5 text-sm tabular-nums focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{f.unit}</span>
                </label>
              ))}
            </div>

            <BreakdownTable
              rows={calc.rowsByVendor[tab]}
              total={calc.totalByVendor[tab]}
              totalLabel={`${VENDOR_LABEL[tab]} total`}
            />
          </div>
        </>
      )}
    </section>
  );
}

function BreakdownTable({
  rows,
  total,
  totalLabel,
}: {
  rows: Row[];
  total: number;
  totalLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Line item</th>
            <th className="px-4 py-2.5 font-medium">Units</th>
            <th className="px-4 py-2.5 font-medium">Rate</th>
            <th className="px-4 py-2.5 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-2.5">{r.label}</td>
              <td className="px-4 py-2.5 tabular-nums text-slate-600">{r.units}</td>
              <td className="px-4 py-2.5 tabular-nums text-slate-600">{usd(r.rate)}</td>
              <td className="px-4 py-2.5 text-right font-medium tabular-nums">{usd(r.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-slate-200 bg-slate-50">
          <tr>
            <td className="px-4 py-2.5 font-semibold" colSpan={3}>
              {totalLabel}
            </td>
            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{usd(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
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
