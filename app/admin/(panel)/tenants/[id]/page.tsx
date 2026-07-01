"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Save, Ban, Play,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import {
  getTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  type Tenant,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { TenantBadge } from "@/components/admin/tenant-badge";

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetcher = useCallback(() => getTenant(id), [id]);
  const { data, loading, error, reload } = useAdminFetch(fetcher, [id]);

  return (
    <div>
      <Link
        href="/admin/tenants"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Link>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading tenant…
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      ) : data ? (
        <TenantDetail tenant={data} onChanged={reload} />
      ) : null}
    </div>
  );
}

function TenantDetail({ tenant, onChanged }: { tenant: Tenant; onChanged: () => void }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{tenant.name}</h1>
          <p className="font-mono text-sm text-slate-500">{tenant.slug}</p>
        </div>
        <TenantBadge status={tenant.status} />
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Details
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <ReadField label="Tenant ID" value={tenant.id} mono />
          <ReadField label="Subscribers" value="—" hint="per-tenant count not wired yet" />
          <ReadField label="Telnyx connection" value={tenant.telnyx_credential_conn_id ?? "—"} mono />
          <ReadField
            label="BICS SIM ranges"
            value={(tenant.bics_sim_range ?? []).length ? (tenant.bics_sim_range ?? []).join(", ") : "—"}
          />
          <ReadField label="Created" value={formatDate(tenant.created_at)} />
          <ReadField label="Updated" value={formatDate(tenant.updated_at)} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <EditCard tenant={tenant} onChanged={onChanged} />
        <LifecycleCard tenant={tenant} onChanged={onChanged} />
      </div>
    </div>
  );
}

function EditCard({ tenant, onChanged }: { tenant: Tenant; onChanged: () => void }) {
  const [name, setName] = useState(tenant.name);
  const [domain, setDomain] = useState(tenant.domain ?? "");
  const [acrobitsCloudId, setAcrobitsCloudId] = useState(tenant.acrobits_cloud_id ?? "");
  const [roamingProfileId, setRoamingProfileId] = useState(tenant.roaming_profile_id ?? "");
  const [billingConfig, setBillingConfig] = useState(
    JSON.stringify(tenant.billing_config ?? {}, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    let parsedBilling: Record<string, unknown>;
    try {
      parsedBilling = JSON.parse(billingConfig || "{}");
    } catch {
      setMsg({ ok: false, text: "Billing config must be valid JSON." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await updateTenant(tenant.id, {
        name: name.trim(),
        domain: domain.trim() || null,
        acrobits_cloud_id: acrobitsCloudId.trim() || null,
        roaming_profile_id: roamingProfileId.trim() || null,
        billing_config: parsedBilling,
      });
      setMsg({ ok: true, text: "Tenant updated." });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Update failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Edit
      </h2>
      <div className="space-y-3">
        <EditField label="Name" value={name} onChange={setName} />
        <EditField label="Domain" value={domain} onChange={setDomain} />
        <EditField label="Acrobits Cloud ID" value={acrobitsCloudId} onChange={setAcrobitsCloudId} />
        <EditField label="Roaming profile ID" value={roamingProfileId} onChange={setRoamingProfileId} />
        <div className="space-y-1.5">
          <Label htmlFor="billing">Billing config (JSON)</Label>
          <textarea
            id="billing"
            value={billingConfig}
            onChange={(e) => setBillingConfig(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
        {msg && (
          <p className={`text-sm font-medium ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}

function LifecycleCard({ tenant, onChanged }: { tenant: Tenant; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: "suspend" | "activate") {
    setBusy(true);
    setMsg(null);
    try {
      if (action === "suspend") await suspendTenant(tenant.id);
      else await activateTenant(tenant.id);
      setMsg({ ok: true, text: `Tenant ${action === "suspend" ? "suspended" : "activated"}.` });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Action failed." });
    } finally {
      setBusy(false);
    }
  }

  const suspended = tenant.status === "suspended";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Lifecycle
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Suspending a tenant marks it inactive; activating restores it.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => run("suspend")}
          disabled={busy || suspended}
          className="border-red-200 text-red-700 hover:bg-red-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          {suspended ? "Suspended" : "Suspend"}
        </Button>
        <Button
          variant="outline"
          onClick={() => run("activate")}
          disabled={busy || tenant.status === "active"}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Activate
        </Button>
      </div>
      {msg && (
        <p className={`mt-3 text-sm font-medium ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

function ReadField({
  label,
  value,
  mono,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
