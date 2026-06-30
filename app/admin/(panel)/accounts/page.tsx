"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { listAccounts } from "@/lib/admin-api";
import { planById } from "@/lib/plans";
import { formatDate, formatPhone } from "@/lib/format";

const PAGE_SIZE = 25;
const STATUSES = ["pending", "active", "suspended", "cancelled"];
const MARKETS = ["lewiston-id", "kendall-il"];

export default function AccountsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [market, setMarket] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(0);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetcher = useCallback(
    () => listAccounts({
      status, market, search, limit: PAGE_SIZE, offset,
    }),
    [status, market, search, offset],
  );
  const { data, loading, error } = useAdminFetch(fetcher, [status, market, search, offset]);

  const total = data?.pagination.total ?? 0;
  const accounts = data?.accounts ?? [];
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  function onFilter(setter: (v: string) => void, value: string) {
    setOffset(0); // reset to first page whenever a filter changes
    setter(value);
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-slate-500">{total.toLocaleString()} total</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search email or phone…"
            aria-label="Search accounts by email or phone"
            className="w-64 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <Select
          label="Status"
          value={status}
          onChange={(v) => onFilter(setStatus, v)}
          options={STATUSES}
        />
        <Select
          label="Market"
          value={market}
          onChange={(v) => onFilter(setMarket, v)}
          options={MARKETS}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Status</Th>
              <Th>Plan</Th>
              <Th>Billing</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No accounts match these filters.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`/admin/accounts/${a.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <Td className="font-medium text-slate-900">{a.email}</Td>
                  <Td className="tabular-nums">{formatPhone(a.phone_e164)}</Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                  <Td>{planById(a.plan)?.name ?? a.plan ?? "—"}</Td>
                  <Td className="capitalize">{a.external_billing_provider ?? "—"}</Td>
                  <Td className="text-slate-500">{formatDate(a.created_at)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          {from}–{to} of {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <PagerButton
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
          >
            Previous
          </PagerButton>
          <PagerButton
            disabled={to >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </PagerButton>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
