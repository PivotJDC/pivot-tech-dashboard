"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import {
  getAccount,
  reissueProvisioning,
  setAccountStatus,
  type AdminAccount,
} from "@/lib/admin-api";
import { ApiError, type ProvisioningLinks } from "@/lib/api";
import { formatDate, formatPhone } from "@/lib/format";

// Allowed forward transitions (mirrors the middleware state machine).
const TRANSITIONS: Record<string, string[]> = {
  pending: ["active", "cancelled"],
  active: ["suspended", "cancelled"],
  suspended: ["active", "cancelled"],
  cancelled: [],
};

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => getAccount(id), [id]);
  const { data, loading, error, reload } = useAdminFetch(fetcher, [id]);

  return (
    <div>
      <Link
        href="/admin/accounts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to accounts
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading account…
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : data ? (
        <AccountDetail account={data} onChanged={reload} />
      ) : null}
    </div>
  );
}

function AccountDetail({
  account,
  onChanged,
}: {
  account: AdminAccount;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{account.email}</h1>
          <p className="text-sm tabular-nums text-slate-500">
            {formatPhone(account.phone_e164)} · {account.market ?? "—"}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Account
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Account ID" value={account.id} mono />
          <Field label="Plan" value={account.plan ?? "—"} />
          <Field label="Created" value={formatDate(account.created_at)} />
          <Field label="Activated" value={formatDate(account.activated_at)} />
          <Field label="SIP username" value={account.sip_username ?? "—"} mono />
          <Field
            label="eSIM ICCID"
            value={account.esim_iccid ?? "—"}
            mono
          />
          <Field
            label="Provisioned"
            value={account.sip_endpoint_id ? "Yes" : "No"}
          />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ForceStatusCard account={account} onChanged={onChanged} />
        <ReissueCard accountId={account.id} />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function ForceStatusCard({
  account,
  onChanged,
}: {
  account: AdminAccount;
  onChanged: () => void;
}) {
  const options = TRANSITIONS[account.status] ?? [];
  const [status, setStatus] = useState(options[0] ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function apply() {
    if (!status) return;
    setBusy(true);
    setMsg(null);
    try {
      await setAccountStatus(account.id, status, reason);
      setMsg({ ok: true, text: `Status changed to ${status}.` });
      setReason("");
      onChanged();
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "Failed to change status.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Force status change
      </h2>
      {options.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No further transitions from <StatusBadge status={account.status} />.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-status" className="text-slate-700">
              New status
            </Label>
            <select
              id="new-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-slate-700">
              Reason <span className="text-slate-400">(audit log)</span>
            </Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this?"
            />
          </div>
          <Button onClick={apply} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Apply change
          </Button>
        </div>
      )}
      {msg && (
        <p
          className={`mt-3 text-sm font-medium ${msg.ok ? "text-emerald-600" : "text-red-600"}`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}

function ReissueCard({ accountId }: { accountId: string }) {
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<ProvisioningLinks | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reissue() {
    setBusy(true);
    setError(null);
    try {
      setLinks(await reissueProvisioning(accountId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reissue token.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Provisioning
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Issue a fresh single-use provisioning token and QR for this account.
      </p>
      <Button className="mt-3" variant="outline" onClick={reissue} disabled={busy}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Reissue token
      </Button>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      {links?.qr_code_url && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
          {/* qr_code_url is a self-contained data: URL from the middleware. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={links.qr_code_url}
            alt="Provisioning QR code"
            className="h-40 w-40 rounded-lg border bg-white p-2"
          />
          {links.expires_at && (
            <p className="text-xs text-slate-500">
              Expires {formatDate(links.expires_at)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
