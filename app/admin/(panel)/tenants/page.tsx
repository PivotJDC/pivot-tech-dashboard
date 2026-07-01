"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { TenantBadge } from "@/components/admin/tenant-badge";
import { listTenants, createTenant } from "@/lib/admin-api";
import { getAdminRole } from "@/lib/admin-auth";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function TenantsPage() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  useEffect(() => setRole(getAdminRole()), []);

  if (role === undefined) return null;
  if (role !== "super_admin") {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold">Tenants</h1>
        </header>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Only super admins can manage tenants.
        </p>
      </div>
    );
  }

  return <TenantsPanel />;
}

function TenantsPanel() {
  const router = useRouter();
  const fetcher = useCallback(() => listTenants(), []);
  const { data, loading, error, reload } = useAdminFetch(fetcher, []);
  const [showForm, setShowForm] = useState(false);

  const tenants = data?.tenants ?? [];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-slate-500">{tenants.length} total</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Add Tenant
        </Button>
      </header>

      {showForm && (
        <AddTenantForm
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Name</Th>
              <Th>Slug</Th>
              <Th>Domain</Th>
              <Th>Status</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No tenants yet.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/admin/tenants/${t.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <Td className="font-medium text-slate-900">{t.name}</Td>
                  <Td className="font-mono text-xs text-slate-600">{t.slug}</Td>
                  <Td className="text-slate-500">{t.domain ?? "—"}</Td>
                  <Td>
                    <TenantBadge status={t.status} />
                  </Td>
                  <Td className="text-slate-500">{formatDate(t.created_at)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddTenantForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [acrobitsCloudId, setAcrobitsCloudId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTenant({
        name: name.trim(),
        slug: slug.trim(),
        domain: domain.trim() || undefined,
        acrobits_cloud_id: acrobitsCloudId.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create tenant.");
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        New tenant
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={setName} placeholder="Acme Mobile" />
        <Field
          label="Slug"
          value={slug}
          onChange={(v) => setSlug(v.toLowerCase())}
          placeholder="acme"
        />
        <Field label="Domain" value={domain} onChange={setDomain} placeholder="acme.example.com" />
        <Field
          label="Acrobits Cloud ID"
          value={acrobitsCloudId}
          onChange={setAcrobitsCloudId}
          placeholder="optional"
        />
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create tenant
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
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
