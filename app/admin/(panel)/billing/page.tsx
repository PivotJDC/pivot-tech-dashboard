"use client";

import { useState } from "react";
import {
  Loader2, Phone, MessageSquare, Image as ImageIcon, Database, DollarSign, Radio,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getBillingReconciliation,
  type BillingReconciliation,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

/** Today / first-of-month as YYYY-MM-DD for sensible defaults. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function BillingPage() {
  const now = new Date();
  const [from, setFrom] = useState(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(isoDate(now));
  const [report, setReport] = useState<BillingReconciliation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!from || !to) {
      setError("Choose a from and to date.");
      return;
    }
    if (from > to) {
      setError("The 'from' date must be on or before the 'to' date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReport(await getBillingReconciliation(from, to));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to generate the report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Billing Reconciliation</h1>
        <p className="text-sm text-slate-500">
          Telnyx voice/messaging volumes vs eSIM data usage for a period.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <input
              id="from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <input
              id="to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
          <Button onClick={generate} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate Report
          </Button>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      </section>

      {report && (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {report.period.from} → {report.period.to}
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Telnyx — Voice &amp; Messaging" icon={<Radio className="h-4 w-4" />}>
              <Metric icon={<Phone className="h-4 w-4" />} label="Voice minutes" value={report.telnyx.voice_minutes.toLocaleString()} />
              <Metric icon={<Phone className="h-4 w-4" />} label="Calls" value={report.telnyx.voice_calls.toLocaleString()} />
              <Metric icon={<MessageSquare className="h-4 w-4" />} label="SMS" value={report.telnyx.sms_count.toLocaleString()} />
              <Metric icon={<ImageIcon className="h-4 w-4" />} label="MMS" value={report.telnyx.mms_count.toLocaleString()} />
            </Card>

            <Card title="eSIM — Data" icon={<Database className="h-4 w-4" />}>
              <Metric
                icon={<Database className="h-4 w-4" />}
                label="Total data"
                value={`${report.bics.data_total_gb.toLocaleString()} GB`}
              />
              <Metric
                icon={<DollarSign className="h-4 w-4" />}
                label="Estimated cost"
                value={`$${report.bics.estimated_cost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </h2>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="inline-flex items-center gap-2 text-sm text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
