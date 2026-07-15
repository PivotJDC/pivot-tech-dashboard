"use client";

/**
 * Revenue & Margin — vendor-specific cost breakdown with per-vendor billing
 * periods.
 *
 * Each vendor bills on its own cycle, so each tab (BICS / Telnyx / Acrobits) has
 * its own From/To date range (with This Month / Last Month presets), and its
 * usage is fetched for that range. Rates are admin-entered and persisted to
 * localStorage; the summary + chart apply them to compute cost and margin. The
 * plan revenue is approximated over the widest of the three periods.
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
import { getVendorCosts, type VendorCosts, type DateRange } from "@/lib/admin-api";

const RATES_KEY = "pivot.admin.vendorRates";
const RANGES_KEY = "pivot.admin.vendorRanges";

const VENDORS = ["bics", "telnyx", "acrobits"] as const;
type Vendor = (typeof VENDORS)[number];
type RateMap = Record<string, string>;
type AllRates = Record<Vendor, RateMap>;
type Range = { from: string; to: string };
type AllRanges = Record<Vendor, Range>;

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

const DEFAULT_RATES: AllRates = {
  bics: {
    simOrder: "420.00",
    simActivation: "0.30",
    simMgmt: "0.10",
    data1: "0.0012",
    data2: "0.0017",
  },
  telnyx: {
    voiceIn: "0.0035",
    voiceOut: "0.0135",
    did: "1.00",
    cnam: "0.40",
    e911: "1.50",
    smsIn: "0.004",
    smsOut: "0.004",
    mmsIn: "0.005",
    mmsOut: "0.015",
  },
  acrobits: {
    perSeat: "0.30",
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
    { key: "voiceIn", label: "Inbound voice", unit: "$ / min", step: "0.0001" },
    { key: "voiceOut", label: "Outbound voice", unit: "$ / min", step: "0.0001" },
    { key: "did", label: "DID", unit: "$ / number·mo", step: "0.01" },
    { key: "cnam", label: "CNAM", unit: "$ / number·mo", step: "0.01" },
    { key: "e911", label: "E911", unit: "$ / number·mo", step: "0.01" },
    { key: "smsIn", label: "SMS inbound", unit: "$ / msg", step: "0.001" },
    { key: "smsOut", label: "SMS outbound", unit: "$ / msg", step: "0.001" },
    { key: "mmsIn", label: "MMS inbound", unit: "$ / msg", step: "0.001" },
    { key: "mmsOut", label: "MMS outbound", unit: "$ / msg", step: "0.001" },
  ],
  acrobits: [
    { key: "perSeat", label: "Per active user", unit: "$ / user·mo", step: "0.01" },
  ],
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const parseRate = (v: string) => {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// --- date helpers (client-side) ---
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function thisMonthRange(): Range {
  const now = new Date();
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
}
function lastMonthRange(): Range {
  const now = new Date();
  return {
    from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)), // last day of prev month
  };
}
function defaultRanges(): AllRanges {
  const tm = thisMonthRange();
  return { bics: { ...tm }, telnyx: { ...tm }, acrobits: { ...tm } };
}
function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 30;
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}
function sameRange(a: Range, b: Range): boolean {
  return a.from === b.from && a.to === b.to;
}
function presetOf(r: Range): "this" | "last" | "custom" {
  if (sameRange(r, thisMonthRange())) return "this";
  if (sameRange(r, lastMonthRange())) return "last";
  return "custom";
}

interface Row {
  label: string;
  units: string;
  rate: number;
  cost: number;
}

const EMPTY: VendorCosts = {
  bics: { active_sims: 0, new_sims_this_month: 0, data_mb: 0 },
  telnyx: {
    inbound_voice_minutes: 0,
    outbound_voice_minutes: 0,
    sms_inbound_count: 0,
    sms_outbound_count: 0,
    mms_inbound_count: 0,
    mms_outbound_count: 0,
    active_dids: 0,
  },
  acrobits: { active_users: 0 },
  subscribers: 0,
  mrr: 0,
};

export function RevenueMarginCard() {
  const [rates, setRates] = useState<AllRates>(DEFAULT_RATES);
  const [ranges, setRanges] = useState<AllRanges | null>(null);
  const [tab, setTab] = useState<Vendor>("bics");

  // Load persisted rates + ranges on mount (client-only, avoids hydration drift).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RATES_KEY);
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
    try {
      const raw = window.localStorage.getItem(RANGES_KEY);
      const d = defaultRanges();
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AllRanges>;
        setRanges({
          bics: { ...d.bics, ...saved.bics },
          telnyx: { ...d.telnyx, ...saved.telnyx },
          acrobits: { ...d.acrobits, ...saved.acrobits },
        });
        return;
      }
      setRanges(d);
    } catch {
      setRanges(defaultRanges());
    }
  }, []);

  const updateRate = useCallback((vendor: Vendor, key: string, value: string) => {
    setRates((prev) => {
      const next = { ...prev, [vendor]: { ...prev[vendor], [key]: value } };
      try {
        window.localStorage.setItem(RATES_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
  }, []);

  const updateRange = useCallback((vendor: Vendor, patch: Partial<Range>) => {
    setRanges((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [vendor]: { ...prev[vendor], ...patch } };
      try {
        window.localStorage.setItem(RANGES_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable */
      }
      return next;
    });
  }, []);

  const rangesKey = ranges ? JSON.stringify(ranges) : "";
  const fetcher = useCallback(
    () => getVendorCosts(ranges ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangesKey],
  );
  const { data, loading, error } = useAdminFetch(fetcher, [rangesKey]);

  // Per-vendor cost line items + totals (each from its own period's volumes).
  const calc = useMemo(() => {
    const d = data ?? EMPTY;
    const r = {
      bics: Object.fromEntries(Object.entries(rates.bics).map(([k, v]) => [k, parseRate(v)])),
      telnyx: Object.fromEntries(Object.entries(rates.telnyx).map(([k, v]) => [k, parseRate(v)])),
      acrobits: Object.fromEntries(Object.entries(rates.acrobits).map(([k, v]) => [k, parseRate(v)])),
    } as Record<Vendor, Record<string, number>>;

    const bicsRows: Row[] = [
      {
        label: "SIM orders (new this period)",
        units: `${num(d.bics.new_sims_this_month)}`,
        rate: r.bics.simOrder,
        cost: d.bics.new_sims_this_month * r.bics.simOrder,
      },
      {
        label: "SIM activations",
        units: `${num(d.bics.new_sims_this_month)}`,
        rate: r.bics.simActivation,
        cost: d.bics.new_sims_this_month * r.bics.simActivation,
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
        label: "Inbound voice minutes",
        units: `${num(d.telnyx.inbound_voice_minutes)}`,
        rate: r.telnyx.voiceIn,
        cost: d.telnyx.inbound_voice_minutes * r.telnyx.voiceIn,
      },
      {
        label: "Outbound voice minutes",
        units: `${num(d.telnyx.outbound_voice_minutes)}`,
        rate: r.telnyx.voiceOut,
        cost: d.telnyx.outbound_voice_minutes * r.telnyx.voiceOut,
      },
      {
        label: "SMS inbound",
        units: `${num(d.telnyx.sms_inbound_count)}`,
        rate: r.telnyx.smsIn,
        cost: d.telnyx.sms_inbound_count * r.telnyx.smsIn,
      },
      {
        label: "SMS outbound",
        units: `${num(d.telnyx.sms_outbound_count)}`,
        rate: r.telnyx.smsOut,
        cost: d.telnyx.sms_outbound_count * r.telnyx.smsOut,
      },
      {
        label: "MMS inbound",
        units: `${num(d.telnyx.mms_inbound_count)}`,
        rate: r.telnyx.mmsIn,
        cost: d.telnyx.mms_inbound_count * r.telnyx.mmsIn,
      },
      {
        label: "MMS outbound",
        units: `${num(d.telnyx.mms_outbound_count)}`,
        rate: r.telnyx.mmsOut,
        cost: d.telnyx.mms_outbound_count * r.telnyx.mmsOut,
      },
      {
        label: "DID rental",
        units: `${num(d.telnyx.active_dids)}`,
        rate: r.telnyx.did,
        cost: d.telnyx.active_dids * r.telnyx.did,
      },
      {
        label: "CNAM",
        units: `${num(d.telnyx.active_dids)}`,
        rate: r.telnyx.cnam,
        cost: d.telnyx.active_dids * r.telnyx.cnam,
      },
      {
        label: "E911",
        units: `${num(d.telnyx.active_dids)}`,
        rate: r.telnyx.e911,
        cost: d.telnyx.active_dids * r.telnyx.e911,
      },
    ];

    const acrobitsRows: Row[] = [
      {
        label: "Active users (with traffic)",
        units: `${num(d.acrobits.active_users)}`,
        rate: r.acrobits.perSeat,
        cost: d.acrobits.active_users * r.acrobits.perSeat,
      },
    ];

    const total = (rows: Row[]) => rows.reduce((s, x) => s + x.cost, 0);
    const totalByVendor = {
      bics: total(bicsRows),
      telnyx: total(telnyxRows),
      acrobits: total(acrobitsRows),
    };
    return {
      rowsByVendor: { bics: bicsRows, telnyx: telnyxRows, acrobits: acrobitsRows },
      totalByVendor,
      totalCost: totalByVendor.bics + totalByVendor.telnyx + totalByVendor.acrobits,
      subscribers: d.subscribers,
      mrr: d.mrr,
    };
  }, [data, rates]);

  // Revenue is approximated over the widest of the three vendor periods.
  const widestDays = ranges
    ? daysInclusive(
      [ranges.bics.from, ranges.telnyx.from, ranges.acrobits.from].sort()[0],
      [ranges.bics.to, ranges.telnyx.to, ranges.acrobits.to].sort().slice(-1)[0],
    )
    : 30;
  const revenue = calc.mrr * (widestDays / 30);
  const grossMargin = revenue - calc.totalCost;
  const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
  const perSubMargin = calc.subscribers > 0 ? grossMargin / calc.subscribers : 0;
  const aligned = ranges
    ? sameRange(ranges.bics, ranges.telnyx) && sameRange(ranges.telnyx, ranges.acrobits)
    : true;

  const chartData = [
    {
      name: "Period",
      bics: calc.totalByVendor.bics,
      telnyx: calc.totalByVendor.telnyx,
      acrobits: calc.totalByVendor.acrobits,
      revenue,
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
            {data.subscribers.toLocaleString()} active subscribers
          </span>
        )}
      </div>

      {loading || !ranges ? (
        <div className="flex h-[220px] items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-6 text-sm text-red-600">{error}</p>
      ) : (
        <>
          {!aligned && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Note: vendor billing periods differ. Costs may not represent the same
              calendar period.
            </p>
          )}

          {/* Summary — always visible */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Summary label="BICS" value={usd(calc.totalByVendor.bics)} tone="neutral" />
            <Summary label="Telnyx" value={usd(calc.totalByVendor.telnyx)} tone="neutral" />
            <Summary label="Acrobits" value={usd(calc.totalByVendor.acrobits)} tone="neutral" />
            <Summary label="Total cost" value={usd(calc.totalCost)} tone="neutral" />
            <Summary
              label="Plan revenue"
              value={usd(revenue)}
              sub={`≈ ${widestDays}-day period`}
              tone="neutral"
            />
            <Summary
              label="Gross margin"
              value={usd(grossMargin)}
              tone={grossMargin >= 0 ? "good" : "bad"}
            />
            <Summary
              label="Margin"
              value={`${marginPct.toFixed(1)}%`}
              tone={marginPct >= 0 ? "good" : "bad"}
            />
            <Summary
              label="Per-sub margin"
              value={`${usd(perSubMargin)}/mo`}
              tone={perSubMargin >= 0 ? "good" : "bad"}
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

          <div className="pt-4">
            {/* Per-vendor billing period */}
            <DateRangeControls
              range={ranges[tab]}
              onChange={(patch) => updateRange(tab, patch)}
              onPreset={(r) => updateRange(tab, r)}
            />

            {/* Editable rates */}
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

function DateRangeControls({
  range,
  onChange,
  onPreset,
}: {
  range: Range;
  onChange: (patch: Partial<Range>) => void;
  onPreset: (r: Range) => void;
}) {
  const preset = presetOf(range);
  const presetBtn = (key: "this" | "last" | "custom", label: string, apply?: () => void) => (
    <button
      type="button"
      onClick={apply}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
        preset === key
          ? "bg-slate-800 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex gap-1.5">
        {presetBtn("this", "This Month", () => onPreset(thisMonthRange()))}
        {presetBtn("last", "Last Month", () => onPreset(lastMonthRange()))}
        {presetBtn("custom", "Custom Range")}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">From</span>
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => onChange({ from: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">To</span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          onChange={(e) => onChange({ to: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
    </div>
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
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
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
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}
