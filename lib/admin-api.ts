/**
 * Admin API client — browser → middleware /admin/* endpoints.
 *
 * Every call sends the stored admin token as `Authorization: Bearer`. Shapes
 * mirror the middleware adminService exactly (list endpoints wrap rows +
 * pagination; metrics is grouped counts). Reuses ApiError from lib/api so
 * callers get { status, code, message } and can branch on 401/403.
 */
import {
  ApiError,
  type Account,
  type ProvisioningLinks,
  type AccountHistory,
  type UsageStats,
} from "./api";
import { getAdminToken } from "./admin-auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Couldn't reach the API.");
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "INTERNAL_ERROR",
      err.message ?? "Request failed.",
      err.field,
      err.trace_id,
    );
  }
  return body as T;
}

// `object` (not Record) so the typed filter interfaces below are accepted
// without each needing an index signature.
function qs(filters: object): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

// --- Types (mirror adminService) ----------------------------------------

export interface Pagination {
  limit: number;
  offset: number;
  total: number;
}

export interface Metrics {
  accounts: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    cancelled: number;
  };
  ports: {
    total: number;
    completed: number;
    failed: number;
    success_rate: number | null;
  };
  dids: {
    total: number;
    available: number;
    assigned: number;
    by_status: Record<string, number>;
  };
}

export interface AdminAccount extends Account {
  market?: string;
  plan?: string;
  sip_endpoint_id?: string | null;
  sip_username?: string | null;
  esim_iccid?: string | null;
  bics_iccid?: string | null;
  bics_endpoint_id?: string | null;
  esim_activation_code?: string | null;
  /** Billing provider (accounts.external_billing_provider). */
  external_billing_provider?: string | null;
  bics_provisioned?: boolean;
  created_at?: string;
  activated_at?: string | null;
  // Flat subscriber-profile fields (migration 031), editable from the detail page.
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone_alt?: string | null;
}

/** Editable subscriber-profile fields — PATCH /admin/accounts/:id/profile. */
export interface AccountProfileInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone_alt?: string;
}

export interface EsimQr {
  /** PNG data URL of the eSIM install QR. */
  qr_code_url: string;
  iccid: string | null;
  endpoint_id: string | null;
  activation_code: string;
  sm_dp_address: string | null;
}

export interface Voicemail {
  id: string;
  caller_number: string;
  caller_name?: string | null;
  duration_seconds: number;
  recording_url?: string | null;
  transcription?: string | null;
  is_read: boolean;
  created_at: string;
}

/** Account actions backed by PATCH /admin/accounts/:id { action }. */
export type AccountAction = "retry_bics" | "activate" | "suspend" | "cancel";

export interface Did {
  id: string;
  e164: string;
  area_code: string;
  market: string;
  status: string;
  account_id?: string | null;
  ported_in?: boolean;
  created_at?: string;
}

export interface PortRequest {
  id: string;
  number_e164: string;
  losing_carrier: string;
  status: string;
  submitted_at?: string | null;
  created_at?: string;
  failure_reason?: string | null;
}

export interface AccountFilters {
  status?: string;
  market?: string;
  /** Free-text search across email + phone (server-side ILIKE). */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminLoginResult {
  token: string;
  username: string;
  role: string;
}

// --- Calls --------------------------------------------------------------

/**
 * POST /admin/login — exchange username + password for a signed admin JWT.
 * Public (no token), so it uses a bare fetch rather than adminRequest.
 */
export async function adminLogin(
  username: string,
  password: string,
): Promise<AdminLoginResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Couldn't reach the API.");
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "INTERNAL_ERROR",
      err.message ?? "Login failed.",
      err.field,
      err.trace_id,
    );
  }
  return body as AdminLoginResult;
}

export function getMetrics() {
  return adminRequest<Metrics>("/admin/metrics");
}

export interface HourlyActivity {
  hour: number;
  calls: number;
  messages: number;
}

export interface UsageBucket {
  bucket: string;
  count: number;
}

/** GET /admin/analytics/hourly-activity — calls + messages by hour (0-23). */
export function getHourlyActivity() {
  return adminRequest<HourlyActivity[]>("/admin/analytics/hourly-activity");
}

/** GET /admin/analytics/usage-distribution — subscriber counts per GB bucket. */
export function getUsageDistribution() {
  return adminRequest<UsageBucket[]>("/admin/analytics/usage-distribution");
}

export interface HourlyDataVoice {
  hour: number;
  voice_minutes: number;
  call_count: number;
}

export interface HourlyMessages {
  hour: number;
  sent: number;
  received: number;
}

/** GET /admin/analytics/hourly-data-voice — voice minutes + call volume by hour. */
export function getHourlyDataVoice() {
  return adminRequest<HourlyDataVoice[]>("/admin/analytics/hourly-data-voice");
}

/** GET /admin/analytics/hourly-messages — sent/received message volume by hour. */
export function getHourlyMessages() {
  return adminRequest<HourlyMessages[]>("/admin/analytics/hourly-messages");
}

export type TrendPeriod = "day" | "week" | "month";

export interface UsageTrendPoint {
  label: string;
  total_mb: number;
}

/** GET /admin/analytics/usage-trends — total data usage over time. */
export function getUsageTrends(period: TrendPeriod = "day") {
  return adminRequest<UsageTrendPoint[]>(
    `/admin/analytics/usage-trends?period=${period}`,
  );
}

export interface BillingReconciliation {
  period: { from: string; to: string };
  telnyx: {
    voice_minutes: number;
    voice_calls: number;
    sms_count: number;
    mms_count: number;
  };
  bics: {
    data_total_mb: number;
    data_total_gb: number;
    estimated_cost: number;
  };
}

/** GET /admin/analytics/billing-reconciliation — Telnyx vs BICS for a range. */
export function getBillingReconciliation(from: string, to: string) {
  return adminRequest<BillingReconciliation>(
    `/admin/analytics/billing-reconciliation${qs({ from, to })}`,
  );
}

export function listAccounts(filters: AccountFilters = {}) {
  return adminRequest<{ accounts: AdminAccount[]; pagination: Pagination }>(
    `/admin/accounts${qs(filters)}`,
  );
}

export function getAccount(id: string) {
  return adminRequest<AdminAccount>(`/admin/accounts/${encodeURIComponent(id)}`);
}

/** GET /admin/accounts/:id/history — call + message history. */
export function getAccountHistory(
  id: string,
  filters: { limit?: number; offset?: number } = {},
) {
  return adminRequest<AccountHistory>(
    `/admin/accounts/${encodeURIComponent(id)}/history${qs(filters)}`,
  );
}

/** GET /admin/accounts/:id/usage — usage stats for this period. */
export function getAccountUsage(id: string) {
  return adminRequest<UsageStats>(`/admin/accounts/${encodeURIComponent(id)}/usage`);
}

/**
 * POST /admin/accounts/:id/esim-qr — get (or regenerate) the eSIM install QR.
 * `regenerate: true` provisions a fresh BICS endpoint; otherwise it returns the
 * QR from the stored/live activation code. super_admin + admin.
 */
export function getEsimQr(id: string, regenerate = false) {
  return adminRequest<EsimQr>(`/admin/accounts/${encodeURIComponent(id)}/esim-qr`, {
    method: "POST",
    body: JSON.stringify({ regenerate }),
  });
}

/** GET /admin/accounts/:id/voicemails — voicemails for an account. */
export function getAccountVoicemails(id: string) {
  return adminRequest<{ voicemails: Voicemail[] }>(
    `/admin/accounts/${encodeURIComponent(id)}/voicemails`,
  );
}

/**
 * GET /admin/voicemails/:id/recording?format=json — a fresh signed URL for the
 * recording. The <audio> element can't send the admin auth header, so we fetch
 * the signed S3 URL here and set it as the audio src.
 */
export function getVoicemailRecordingUrl(id: string) {
  return adminRequest<{ url: string }>(
    `/admin/voicemails/${encodeURIComponent(id)}/recording?format=json`,
  );
}

/** PATCH /admin/voicemails/:id/read — mark a voicemail read. */
export function markVoicemailRead(id: string) {
  return adminRequest<Voicemail>(`/admin/voicemails/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

/** DELETE /admin/voicemails/:id — delete a voicemail. */
export function deleteVoicemail(id: string) {
  return adminRequest<{ deleted: boolean; id: string }>(
    `/admin/voicemails/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function reissueProvisioning(id: string) {
  return adminRequest<ProvisioningLinks & { raw_token?: string }>(
    `/admin/accounts/${encodeURIComponent(id)}/provision/reissue`,
    { method: "POST" },
  );
}

export function setAccountStatus(id: string, status: string, reason: string) {
  return adminRequest<AdminAccount>(
    `/admin/accounts/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: JSON.stringify({ status, reason }) },
  );
}

/** PATCH /admin/accounts/:id/profile — update subscriber profile fields. */
export function updateAccountProfile(id: string, patch: AccountProfileInput) {
  return adminRequest<AdminAccount>(
    `/admin/accounts/${encodeURIComponent(id)}/profile`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

/** GET /admin/accounts/:id/port-pin — the subscriber's port-out PIN (CSR). */
export function getAccountPortPin(id: string) {
  return adminRequest<{ port_out_pin: string }>(
    `/admin/accounts/${encodeURIComponent(id)}/port-pin`,
  );
}

/** GET /admin/accounts/:id/provisioning-qr — the dialer setup QR (CSR). */
export function getAccountProvisioningQr(id: string) {
  return adminRequest<{ qr_url: string; provisioning_url: string }>(
    `/admin/accounts/${encodeURIComponent(id)}/provisioning-qr`,
  );
}

export interface SipCredentials {
  sip_username: string;
  /** Plaintext — returned only by the rotate response; never stored. */
  sip_password: string;
  updated: boolean;
}

/**
 * POST /admin/accounts/:id/refresh-sip-credentials — rotate the SIP credential
 * (super_admin). Returns the new username + plaintext password so the caller
 * can build a fresh provisioning QR.
 */
export function refreshSipCredentials(id: string) {
  return adminRequest<SipCredentials>(
    `/admin/accounts/${encodeURIComponent(id)}/refresh-sip-credentials`,
    { method: "POST" },
  );
}

/**
 * DELETE /admin/accounts/:id — hard-delete an account and all related records
 * (super_admin only). The middleware requires the X-Confirm-Delete header.
 */
export function deleteAccount(id: string) {
  return adminRequest<{ deleted: boolean }>(
    `/admin/accounts/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { "X-Confirm-Delete": "true" } },
  );
}

/**
 * Run an account action via PATCH /admin/accounts/:id — e.g. "retry_bics"
 * (re-run eSIM provisioning) or "cancel" (set status to cancelled). Returns the
 * updated account.
 */
export function accountAction(id: string, action: AccountAction) {
  return adminRequest<AdminAccount>(`/admin/accounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: "super_admin" | "admin" | "viewer";
  created_at?: string;
  last_login_at?: string | null;
}

/** GET /admin/users — list admin users (super_admin only). */
export function listAdminUsers() {
  return adminRequest<{ users: AdminUser[] }>("/admin/users");
}

/** POST /admin/users — create an admin user (super_admin only). */
export function createAdminUser(input: {
  username: string;
  email: string;
  password: string;
  role: string;
}) {
  return adminRequest<AdminUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** PATCH /admin/users/:id — change an admin user's role (super_admin only). */
export function updateAdminUser(id: string, input: { role: string }) {
  return adminRequest<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** DELETE /admin/users/:id — delete an admin user (super_admin only). */
export function deleteAdminUser(id: string) {
  return adminRequest<{ deleted: boolean; id: string }>(
    `/admin/users/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

// --- Tenants (MVNE, super_admin) -----------------------------------------

export type TenantStatus = "onboarding" | "active" | "suspended" | "cancelled";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain?: string | null;
  acrobits_cloud_id?: string | null;
  brand_config?: Record<string, unknown>;
  plans?: unknown[];
  bics_sim_range?: string[];
  telnyx_credential_conn_id?: string | null;
  roaming_profile_id?: string | null;
  billing_config?: Record<string, unknown>;
  status: TenantStatus;
  created_at?: string;
  updated_at?: string;
}

export interface TenantInput {
  slug: string;
  name: string;
  domain?: string;
  acrobits_cloud_id?: string;
  roaming_profile_id?: string;
  billing_config?: Record<string, unknown>;
}

/** GET /admin/tenants — list tenants (super_admin). */
export function listTenants(
  filters: { status?: string; limit?: number; offset?: number } = {},
) {
  return adminRequest<{ tenants: Tenant[]; pagination: Pagination }>(
    `/admin/tenants${qs(filters)}`,
  );
}

/** POST /admin/tenants — create a tenant. */
export function createTenant(input: TenantInput) {
  return adminRequest<Tenant>("/admin/tenants", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /admin/tenants/:id — tenant detail. */
export function getTenant(id: string) {
  return adminRequest<Tenant>(`/admin/tenants/${encodeURIComponent(id)}`);
}

/** PATCH /admin/tenants/:id — update mutable tenant fields. */
export function updateTenant(id: string, updates: Partial<Tenant>) {
  return adminRequest<Tenant>(`/admin/tenants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

/** POST /admin/tenants/:id/suspend. */
export function suspendTenant(id: string) {
  return adminRequest<Tenant>(`/admin/tenants/${encodeURIComponent(id)}/suspend`, {
    method: "POST",
  });
}

/** POST /admin/tenants/:id/activate. */
export function activateTenant(id: string) {
  return adminRequest<Tenant>(`/admin/tenants/${encodeURIComponent(id)}/activate`, {
    method: "POST",
  });
}

export function listDids(
  filters: {
    market?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  return adminRequest<{ dids: Did[]; pagination: Pagination }>(
    `/admin/dids${qs(filters)}`,
  );
}

export function listPorts(
  filters: { status?: string; limit?: number; offset?: number } = {},
) {
  return adminRequest<{ ports: PortRequest[]; pagination: Pagination }>(
    `/admin/ports${qs(filters)}`,
  );
}
