/**
 * Browser → middleware API client.
 *
 * All calls go DIRECTLY from the browser to the Pivot-Tech middleware
 * (NEXT_PUBLIC_API_URL) — there are no Next.js API routes in this app. Keep
 * every fetch in this one module so the base URL, error shape, and response
 * typing live in a single place.
 *
 * The middleware returns the standard error envelope on failure:
 *   { error: { code, message, field?, trace_id } }
 * ApiError surfaces `code` so callers can branch (e.g. DID_UNAVAILABLE) and
 * `message` for display.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  // Surfaced at module load in the browser console if the env var is missing
  // from the Netlify build — a fast signal that the deploy is misconfigured.
  // eslint-disable-next-line no-console
  console.error("NEXT_PUBLIC_API_URL is not set; API calls will fail.");
}

export class ApiError extends Error {
  code: string;
  field?: string;
  traceId?: string;
  status: number;

  constructor(
    status: number,
    code: string,
    message: string,
    field?: string,
    traceId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.traceId = traceId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (networkErr) {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "We couldn't reach the network. Check your connection and try again.",
    );
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = body?.error ?? {};
    throw new ApiError(
      res.status,
      err.code ?? "INTERNAL_ERROR",
      err.message ?? "Something went wrong. Please try again.",
      err.field,
      err.trace_id,
    );
  }

  return body as T;
}

// --- Types ---------------------------------------------------------------

export type ServiceChoice = "new" | "port";

export interface ProvisioningLinks {
  provisioning_url: string;
  qr_code_url: string;
  deep_link: string;
  expires_at?: string;
}

/** BICS eSIM details returned by POST /v1/accounts (null if provisioning failed). */
export interface Esim {
  iccid: string;
  /** LPA activation string, e.g. "LPA:1$thales3.prod...$..." — the QR payload. */
  activationCode: string;
  smDpAddress: string;
  endpointId: string;
}

export interface Account {
  id: string;
  email: string;
  status: string;
  phone_e164?: string;
  market?: string;
  /** Plan slug (see lib/plans.ts), e.g. "unlimited_25". */
  plan?: string;
  provisioning?: ProvisioningLinks;
  /** Present on success; null when BICS provisioning failed (see esim_error). */
  esim?: Esim | null;
  /** Set when esim is null — a customer-facing reason. */
  esim_error?: string;
  // Enrollment / family fields (present on the serialized account).
  first_name?: string;
  last_name?: string;
  service_address?: AddressInput | null;
  billing_address?: AddressInput | null;
  /** Null for a primary account; set for a child (family) line. */
  parent_account_id?: string | null;
  /** Count of child lines under this primary (0 when none). */
  line_count?: number;
  created_at?: string;
  activated_at?: string | null;
}

export interface AvailableNumber {
  /** E.164, e.g. +12085550100 — the value to submit when reserving. */
  e164: string;
  /** Display form from the middleware, e.g. "(208) 555-0100". */
  formatted: string;
  area_code: string;
}

export interface PortDetails {
  number_e164: string;
  losing_carrier: string;
  account_number: string;
  pin: string;
  billing_zip: string;
}

export interface CreateAccountInput {
  email: string;
  /**
   * Launched-market slug, or omitted for any other US area code — the
   * middleware defaults market to "direct" and searches the number's area code.
   */
  market?: string;
  /** Plan slug (see lib/plans.ts); the middleware defaults to unlimited_25. */
  plan: string;
  service: ServiceChoice;
  /** Present when service === "new" — the number the customer selected. */
  phone_e164?: string;
  /** Present when service === "port". */
  port?: PortDetails;
  /**
   * Add-a-line: the existing primary account's email. When set, the middleware
   * creates this as a child line under that primary instead of a new account.
   */
  parent_email?: string;
  // Enrollment details (used for Telgoo5 billing enrollment).
  first_name?: string;
  last_name?: string;
  service_address?: AddressInput;
  billing_address?: AddressInput;
  promo_code?: string;
}

export interface AddressInput {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface AccountStatus {
  id: string;
  status: string;
  phone_e164?: string;
  port?: {
    status: string;
    failure_reason?: string;
  };
}

// --- Calls ---------------------------------------------------------------

/** POST /v1/accounts — create a new account (new number or port-in). */
export function createAccount(input: CreateAccountInput): Promise<Account> {
  return request<Account>("/v1/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /v1/numbers/available?areacode=XXX — up to 50 available DIDs. */
export function getAvailableNumbers(
  areacode: string,
): Promise<AvailableNumber[]> {
  return request<{ numbers?: AvailableNumber[] }>(
    `/v1/numbers/available?areacode=${encodeURIComponent(areacode)}`,
  ).then((res) => res.numbers ?? []);
}

/** GET /v1/accounts/:id/status — lightweight status poll. */
export function getAccountStatus(id: string): Promise<AccountStatus> {
  return request<AccountStatus>(`/v1/accounts/${encodeURIComponent(id)}/status`);
}

export interface CallRecord {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  status: string;
  duration_seconds: number;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
}

export interface MessageRecord {
  id: string;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  status: string;
  message_type: "sms" | "mms";
  created_at: string;
}

export interface AccountHistory {
  calls: CallRecord[];
  messages: MessageRecord[];
}

/** GET /v1/accounts/:id/history — call + message history (owner JWT). */
export function getAccountHistory(
  id: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<AccountHistory> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return request<AccountHistory>(
    `/v1/accounts/${encodeURIComponent(id)}/history${qs ? `?${qs}` : ""}`,
  );
}

/**
 * POST /v1/auth/send-code — request a passwordless login code for an email.
 * Always resolves { sent: true } regardless of whether the email has an account.
 */
export function sendCode(email: string): Promise<{ sent: boolean }> {
  return request<{ sent: boolean }>("/v1/auth/send-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * POST /v1/auth/verify-code — exchange a valid code for a customer JWT + the
 * serialized account. Throws ApiError (401) on an invalid/expired code.
 */
export function verifyCode(
  email: string,
  code: string,
): Promise<{ token: string; account: Account }> {
  return request<{ token: string; account: Account }>("/v1/auth/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}
