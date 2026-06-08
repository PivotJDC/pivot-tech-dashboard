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

export interface Account {
  id: string;
  email: string;
  status: string;
  phone_e164?: string;
  market?: string;
  provisioning?: ProvisioningLinks;
}

export interface AvailableNumber {
  number: string;
  region?: string;
  city?: string;
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
  market: string;
  service: ServiceChoice;
  /** Present when service === "new" — the number the customer selected. */
  phone_e164?: string;
  /** Present when service === "port". */
  port?: PortDetails;
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
  return request<{ data?: AvailableNumber[] } | AvailableNumber[]>(
    `/v1/numbers/available?areacode=${encodeURIComponent(areacode)}`,
  ).then((res) => (Array.isArray(res) ? res : (res.data ?? [])));
}

/** GET /v1/accounts/:id/status — lightweight status poll. */
export function getAccountStatus(id: string): Promise<AccountStatus> {
  return request<AccountStatus>(`/v1/accounts/${encodeURIComponent(id)}/status`);
}
