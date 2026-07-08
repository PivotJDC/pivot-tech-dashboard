"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, RefreshCw, RotateCcw, Ban, Check, KeyRound, QrCode, Trash2,
  Voicemail as VoicemailIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/status-badge";
import { HistoryTable } from "@/components/history-table";
import { UsageStatsView } from "@/components/usage-stats";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { ApnSetup } from "@/components/apn-setup";
import {
  getAccount,
  getAccountHistory,
  getAccountUsage,
  getEsimQr,
  getAccountVoicemails,
  getVoicemailRecordingUrl,
  markVoicemailRead,
  deleteVoicemail,
  reissueProvisioning,
  setAccountStatus,
  accountAction,
  updateAccountProfile,
  getAccountPortPin,
  getAccountProvisioningQr,
  deleteAccount,
  type AdminAccount,
  type AccountProfileInput,
  type EsimQr,
  type Voicemail,
} from "@/lib/admin-api";
import { ApiError, type ProvisioningLinks } from "@/lib/api";
import { getAdminRole } from "@/lib/admin-auth";
import { planById } from "@/lib/plans";
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
  // The middleware is the real gate (super_admin-only); this just hides the
  // destructive controls for non-super-admins.
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => setRole(getAdminRole()), []);

  // Surfaced by a failed eSIM retry so the status badge can turn red; cleared on
  // a successful (re)provision.
  const [esimError, setEsimError] = useState<string | null>(null);

  const fullName = [account.first_name, account.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {fullName || account.email}
          </h1>
          <p className="text-sm tabular-nums text-slate-500">
            {account.email} · {formatPhone(account.phone_e164)} · {account.market ?? "—"}
          </p>
        </div>
        <StatusBadge status={account.status} />
      </header>

      <ProfileSection account={account} onChanged={onChanged} />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Account
        </h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="Account name" value={fullName || "—"} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Status
            </dt>
            <dd className="mt-0.5">
              <StatusBadge status={account.status} />
            </dd>
          </div>
          <Field label="Phone number" value={formatPhone(account.phone_e164)} />
          <Field label="Account ID" value={account.id} mono />
          <Field
            label="Plan"
            value={planById(account.plan)?.name ?? account.plan ?? "—"}
          />
          <Field
            label="Billing provider"
            value={account.external_billing_provider ?? "—"}
          />
          <Field label="Created" value={formatDate(account.created_at)} />
          <Field label="Activated" value={formatDate(account.activated_at)} />
          <Field label="SIP username" value={account.sip_username ?? "—"} mono />
          <Field
            label="eSIM ICCID"
            value={account.esim_iccid ?? account.bics_iccid ?? "—"}
            mono
          />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              eSIM status
            </dt>
            <dd className="mt-0.5">
              <EsimStatusBadge account={account} error={esimError} />
            </dd>
          </div>
        </dl>
      </section>

      <EsimQrSection account={account} />

      <PortPinCard accountId={account.id} />

      <DialerSetupCard accountId={account.id} />

      {/* APN quick-reference for CSRs. */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          APN Setup
        </h2>
        <ApnSetup />
      </section>

      <ActionsCard
        account={account}
        onChanged={onChanged}
        onEsimError={setEsimError}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ForceStatusCard account={account} onChanged={onChanged} />
        <ReissueCard accountId={account.id} />
      </div>

      <UsageSection accountId={account.id} />
      <VoicemailsSection accountId={account.id} />
      <HistorySection accountId={account.id} />

      {role === "super_admin" && (
        <DangerZone account={account} onChanged={onChanged} />
      )}
    </div>
  );
}

/**
 * Super-admin-only destructive actions: cancel (type CANCEL) and hard-delete
 * (type the phone number). Kept separate from ActionsCard so non-super-admins
 * never see them; the middleware enforces the real gate.
 */
function DangerZone({
  account,
  onChanged,
}: {
  account: AdminAccount;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [cancelText, setCancelText] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState<"cancel" | "delete" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cancelled = account.status === "cancelled";
  const phone = account.phone_e164 ?? "";
  const digits = (v: string) => v.replace(/\D/g, "");
  const phoneConfirmed = Boolean(phone) && digits(deleteText) === digits(phone);

  async function cancelAccount() {
    setBusy("cancel");
    setMsg(null);
    try {
      await accountAction(account.id, "cancel");
      setMsg({ ok: true, text: "Account cancelled." });
      setCancelText("");
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Cancel failed." });
    } finally {
      setBusy(null);
    }
  }

  async function removeAccount() {
    setBusy("delete");
    setMsg(null);
    try {
      await deleteAccount(account.id);
      // The account no longer exists — leave the detail page.
      router.push("/admin/accounts");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError ? err.message : "Delete failed." });
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-700">
        Danger Zone
      </h2>
      <p className="text-sm text-slate-600">
        Super-admin only. These actions affect live service and can’t be undone.
      </p>

      {/* Cancel */}
      <div className="mt-5 border-t border-red-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Cancel account</h3>
        <p className="mt-1 text-sm text-slate-600">
          Suspends service (status → cancelled). Type{" "}
          <span className="font-mono font-semibold">CANCEL</span> to confirm.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input
            value={cancelText}
            onChange={(e) => setCancelText(e.target.value)}
            placeholder="CANCEL"
            className="max-w-[180px]"
            disabled={cancelled || busy !== null}
          />
          <Button
            onClick={cancelAccount}
            disabled={cancelled || busy !== null || cancelText !== "CANCEL"}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy === "cancel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {cancelled ? "Cancelled" : "Cancel account"}
          </Button>
        </div>
      </div>

      {/* Delete */}
      <div className="mt-5 border-t border-red-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Delete account</h3>
        <p className="mt-1 text-sm text-slate-600">
          Permanently removes the account and all related records (messages,
          calls, voicemails, usage, DID). Releases the number back to Telnyx.
          Type the phone number{" "}
          <span className="font-mono font-semibold">{phone || "—"}</span> to
          confirm.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input
            value={deleteText}
            onChange={(e) => setDeleteText(e.target.value)}
            placeholder={phone}
            className="max-w-[220px]"
            disabled={busy !== null}
          />
          <Button
            onClick={removeAccount}
            disabled={busy !== null || !phoneConfirmed}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete account
          </Button>
        </div>
      </div>

      {msg && (
        <p
          className={`mt-4 text-sm font-medium ${msg.ok ? "text-emerald-600" : "text-red-600"}`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  phone_alt: string;
};

function toForm(account: AdminAccount): ProfileForm {
  return {
    first_name: account.first_name ?? "",
    last_name: account.last_name ?? "",
    email: account.email ?? "",
    address_line1: account.address_line1 ?? "",
    address_line2: account.address_line2 ?? "",
    city: account.city ?? "",
    state: account.state ?? "",
    zip: account.zip ?? "",
    phone_alt: account.phone_alt ?? "",
  };
}

/** Editable subscriber-profile card. Saves via PATCH /admin/accounts/:id/profile. */
function ProfileSection({
  account,
  onChanged,
}: {
  account: AdminAccount;
  onChanged: () => void;
}) {
  const [form, setForm] = useState<ProfileForm>(() => toForm(account));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Re-seed when the account reloads (e.g. after a successful save).
  const initial = useMemo(() => toForm(account), [account]);
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  const dirty = useMemo(
    () => (Object.keys(form) as (keyof ProfileForm)[]).some((k) => form[k] !== initial[k]),
    [form, initial],
  );

  function set(field: keyof ProfileForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      // Send the whole form; the middleware trims and treats empty as clear.
      await updateAccountProfile(account.id, form as AccountProfileInput);
      setMsg({ ok: true, text: "Profile saved." });
      onChanged();
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "Save failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Subscriber Profile
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ProfileField id="first_name" label="First name" value={form.first_name} onChange={(v) => set("first_name", v)} autoComplete="given-name" />
        <ProfileField id="last_name" label="Last name" value={form.last_name} onChange={(v) => set("last_name", v)} autoComplete="family-name" />
        <div className="sm:col-span-2">
          <ProfileField id="email" label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} autoComplete="email" />
        </div>
        <div className="sm:col-span-2">
          <ProfileField id="address_line1" label="Address line 1" value={form.address_line1} onChange={(v) => set("address_line1", v)} autoComplete="address-line1" />
        </div>
        <div className="sm:col-span-2">
          <ProfileField id="address_line2" label="Address line 2" value={form.address_line2} onChange={(v) => set("address_line2", v)} autoComplete="address-line2" />
        </div>
        <ProfileField id="city" label="City" value={form.city} onChange={(v) => set("city", v)} autoComplete="address-level2" />
        <div className="grid grid-cols-2 gap-4">
          <ProfileField id="state" label="State" value={form.state} onChange={(v) => set("state", v.toUpperCase())} maxLength={2} autoComplete="address-level1" />
          <ProfileField id="zip" label="ZIP" value={form.zip} onChange={(v) => set("zip", v)} maxLength={10} autoComplete="postal-code" />
        </div>
        <ProfileField id="phone_alt" label="Alternate phone" type="tel" value={form.phone_alt} onChange={(v) => set("phone_alt", v)} autoComplete="tel" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {msg ? (
          <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function ProfileField({
  id,
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// Read-only port-out PIN for CSR support. Fetched on demand (not in the general
// account payload) so it isn't shown until a CSR needs it.
function PortPinCard({ accountId }: { accountId: string }) {
  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const r = await getAccountPortPin(accountId);
      setPin(r.port_out_pin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Port-out PIN
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        The transfer PIN the subscriber gives a new carrier. Read-only — the
        customer resets it from their portal.
      </p>
      <div className="mt-3 flex items-center gap-3">
        {pin ? (
          <code className="rounded bg-slate-100 px-3 py-1.5 font-mono text-sm tracking-widest text-slate-900">
            {pin}
          </code>
        ) : (
          <Button variant="outline" onClick={reveal} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Show PIN
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

// Dialer provisioning QR for CSR-assisted setup — generated on demand (it
// carries the live SIP credentials, so it isn't fetched until requested).
function DialerSetupCard({ accountId }: { accountId: string }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setLoading(true);
    setError(null);
    try {
      const r = await getAccountProvisioningQr(accountId);
      setQrUrl(r.qr_url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate the QR.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Dialer Setup
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Provisioning QR for Cloud Softphone — scan it in the app to load the
        subscriber&apos;s SIP credentials.
      </p>
      <div className="mt-3">
        {qrUrl ? (
          // qr_url is a self-contained data: URL from the middleware.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrUrl}
            alt="Dialer provisioning QR code"
            className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
          />
        ) : (
          <Button variant="outline" onClick={show} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            Show QR
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function EsimQrSection({ account }: { account: AdminAccount }) {
  const [qr, setQr] = useState<EsimQr | null>(null);
  const [busy, setBusy] = useState<null | "show" | "regen">(null);
  const [error, setError] = useState<string | null>(null);

  async function load(regenerate: boolean) {
    setBusy(regenerate ? "regen" : "show");
    setError(null);
    try {
      setQr(await getEsimQr(account.id, regenerate));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load eSIM QR.");
    } finally {
      setBusy(null);
    }
  }

  const iccid = qr?.iccid ?? account.bics_iccid ?? account.esim_iccid ?? "—";
  const endpointId = qr?.endpoint_id ?? account.bics_endpoint_id ?? "—";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        eSIM QR Code
      </h2>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr.qr_code_url} alt="eSIM installation QR code" className="h-44 w-44" />
          ) : (
            <span className="px-4 text-center text-xs text-slate-400">
              Click “Show QR” to render the eSIM install code.
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="ICCID" value={iccid} mono />
            <Field label="eSIM Endpoint ID" value={endpointId} mono />
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => load(false)} disabled={busy !== null}>
              {busy === "show" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Show QR
            </Button>
            <Button
              variant="outline"
              onClick={() => load(true)}
              disabled={busy !== null}
            >
              {busy === "regen" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate eSIM
            </Button>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <p className="text-xs text-slate-400">
            “Regenerate eSIM” provisions a brand-new eSIM (new ICCID). The
            customer must reinstall the profile.
          </p>
        </div>
      </div>
    </section>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function VoicemailsSection({ accountId }: { accountId: string }) {
  const fetcher = useCallback(() => getAccountVoicemails(accountId), [accountId]);
  const { data, loading, error, reload } = useAdminFetch(fetcher, [accountId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({});

  const voicemails = useMemo(() => data?.voicemails ?? [], [data]);
  const unread = voicemails.filter((v) => !v.is_read).length;

  // recording_url is an S3 reference — fetch a fresh signed URL per voicemail
  // for the <audio> src (the element can't send the admin auth header).
  useEffect(() => {
    voicemails
      .filter((v) => v.recording_url && !recordingUrls[v.id])
      .forEach((v) => {
        getVoicemailRecordingUrl(v.id)
          .then(({ url }) => setRecordingUrls((m) => ({ ...m, [v.id]: url })))
          .catch(() => {});
      });
  }, [voicemails, recordingUrls]);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  function remove(id: string) {
    if (!window.confirm("Delete this voicemail? This cannot be undone.")) return;
    run(id, () => deleteVoicemail(id));
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Voicemails
        </h2>
        {unread > 0 && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {unread} unread
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading voicemails…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : voicemails.length === 0 ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
          <VoicemailIcon className="h-4 w-4" />
          No voicemails.
        </div>
      ) : (
        <ul className="space-y-3">
          {voicemails.map((vm) => (
            <VoicemailRow
              key={vm.id}
              vm={vm}
              recordingUrl={recordingUrls[vm.id]}
              busy={busyId === vm.id}
              onMarkRead={() => run(vm.id, () => markVoicemailRead(vm.id))}
              onDelete={() => remove(vm.id)}
            />
          ))}
        </ul>
      )}

      {actionError && <p className="mt-3 text-sm font-medium text-red-600">{actionError}</p>}
    </section>
  );
}

function VoicemailRow({
  vm,
  recordingUrl,
  busy,
  onMarkRead,
  onDelete,
}: {
  vm: Voicemail;
  recordingUrl?: string;
  busy: boolean;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const preview = vm.transcription && vm.transcription.length > 160
    ? `${vm.transcription.slice(0, 160)}…`
    : vm.transcription;

  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">
              {vm.caller_name || formatPhone(vm.caller_number)}
            </span>
            {vm.is_read ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                Read
              </span>
            ) : (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Unread
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
            {formatDate(vm.created_at)} · {formatDuration(vm.duration_seconds)}
          </p>
          {preview && (
            <p className="mt-2 text-sm italic text-slate-600">&ldquo;{preview}&rdquo;</p>
          )}
          {recordingUrl && (
            <audio
              controls
              preload="none"
              src={recordingUrl}
              className="mt-3 h-9 w-full max-w-md"
            >
              <track kind="captions" />
            </audio>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {!vm.is_read && (
            <Button size="sm" variant="outline" onClick={onMarkRead} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Mark read
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-700 hover:bg-red-50"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}

function UsageSection({ accountId }: { accountId: string }) {
  const fetcher = useCallback(() => getAccountUsage(accountId), [accountId]);
  const { data, loading, error } = useAdminFetch(fetcher, [accountId]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Usage This Period
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading usage…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : data ? (
        <UsageStatsView stats={data} />
      ) : null}
    </section>
  );
}

function HistorySection({ accountId }: { accountId: string }) {
  const fetcher = useCallback(() => getAccountHistory(accountId, { limit: 100 }), [accountId]);
  const { data, loading, error } = useAdminFetch(fetcher, [accountId]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Call &amp; Message History
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <HistoryTable calls={data?.calls ?? []} messages={data?.messages ?? []} />
      )}
    </section>
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

// eSIM status derived from the account (+ a transient retry error). The vendor
// (BICS) name is intentionally hidden — this is CSR-facing.
function esimStatusFor(account: AdminAccount, error?: string | null) {
  const iccid = account.esim_iccid ?? account.bics_iccid ?? null;
  const provisioned = Boolean(account.bics_provisioned)
    || (Boolean(account.bics_endpoint_id) && Boolean(iccid));
  if (provisioned) {
    return { label: "eSIM Active", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }
  if (error) {
    return { label: "eSIM Failed", cls: "bg-red-100 text-red-700 border-red-200" };
  }
  // A live account still missing its eSIM is awaiting provisioning; a pending
  // account simply hasn't provisioned one yet.
  if (account.status === "active" || account.status === "suspended") {
    return { label: "eSIM Pending", cls: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  return { label: "No eSIM", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

function EsimStatusBadge({
  account,
  error,
}: {
  account: AdminAccount;
  error?: string | null;
}) {
  const { label, cls } = esimStatusFor(account, error);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function ActionsCard({
  account,
  onChanged,
  onEsimError,
}: {
  account: AdminAccount;
  onChanged: () => void;
  onEsimError: (error: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  // Success result carries the ICCID for the green banner; failure carries the
  // error text for the red banner (and lifts it so the status badge turns red).
  const [result, setResult] = useState<
    | { ok: true; iccid: string }
    | { ok: false; text: string }
    | null
  >(null);

  async function retryEsim() {
    setBusy(true);
    setResult(null);
    onEsimError(null);
    try {
      const updated = await accountAction(account.id, "retry_bics");
      const iccid = updated.esim_iccid ?? updated.bics_iccid ?? "—";
      setResult({ ok: true, iccid });
      onEsimError(null);
      onChanged(); // reload the account so the eSIM status badge updates
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "unknown error";
      setResult({ ok: false, text });
      onEsimError(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Actions
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Re-run eSIM provisioning. Cancel / delete live in the Danger Zone below.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={retryEsim} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {busy ? "Provisioning eSIM…" : "Retry eSIM Provisioning"}
        </Button>
        {busy && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Provisioning eSIM…
          </span>
        )}
      </div>
      {result?.ok && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          eSIM provisioned successfully.{" "}
          <span className="font-mono">ICCID: {result.iccid}</span>
        </div>
      )}
      {result && !result.ok && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          eSIM provisioning failed: {result.text}
        </div>
      )}
    </section>
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
