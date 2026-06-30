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
  /** Billing provider (accounts.external_billing_provider). */
  external_billing_provider?: string | null;
  bics_provisioned?: boolean;
  created_at?: string;
  activated_at?: string | null;
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

export function listDids(
  filters: { market?: string; status?: string; limit?: number; offset?: number } = {},
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
