"use client";

import { useCallback } from "react";
import {
  Users, UserCheck, Clock, DollarSign, Loader2,
} from "lucide-react";

import { MetricCard } from "@/components/admin/metric-card";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { getMetrics } from "@/lib/admin-api";
import { DEFAULT_PLAN } from "@/lib/plans";

export default function DashboardPage() {
  const fetcher = useCallback(() => getMetrics(), []);
  const { data, loading, error } = useAdminFetch(fetcher, []);

  // Revenue estimate uses the active account count × the plan price.
  const revenue = data ? data.accounts.active * DEFAULT_PLAN.price : 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Operational overview</p>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading metrics…
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total accounts"
            value={data.accounts.total.toLocaleString()}
            sublabel={`${data.accounts.cancelled.toLocaleString()} cancelled`}
            icon={Users}
          />
          <MetricCard
            label="Active accounts"
            value={data.accounts.active.toLocaleString()}
            sublabel={`${data.accounts.suspended.toLocaleString()} suspended`}
            icon={UserCheck}
          />
          <MetricCard
            label="Pending accounts"
            value={data.accounts.pending.toLocaleString()}
            sublabel="awaiting activation"
            icon={Clock}
          />
          <MetricCard
            label="Revenue estimate"
            value={`$${revenue.toLocaleString()}`}
            sublabel={`${data.accounts.active.toLocaleString()} × $${DEFAULT_PLAN.price}/mo`}
            icon={DollarSign}
          />
        </div>
      ) : null}
    </div>
  );
}
