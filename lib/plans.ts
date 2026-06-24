/**
 * Service plans, data-driven.
 *
 * The signup UI and landing page render plans from this array, and the chosen
 * plan id is sent to the middleware as `plan` on POST /v1/accounts. Adding a
 * new plan is a one-line change here — no UI edits required. `id` must match a
 * plan slug the middleware accepts (it defaults to `unlimited_25`).
 */
export interface Plan {
  /** Slug sent to the middleware as `plan`. */
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** Monthly price in whole dollars (used for revenue math). */
  price: number;
  /** Pre-formatted price string for display, e.g. "$25/mo". */
  priceDisplay: string;
  /** Human-readable data allowance, e.g. "30 GB (Unlimited)". */
  data: string;
  /** Full-speed data allowance in bytes. */
  dataBytes: number;
  /** How data beyond the allowance is handled. */
  overage: string;
  /**
   * Byte threshold after which the connection is throttled (rather than
   * billed for overage). Only set on throttled plans.
   */
  throttleAfter?: number;
  /** One-line plan summary. */
  description: string;
  /** Bullet list of plan highlights for the pricing cards. */
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "starter_10",
    name: "Starter",
    price: 10,
    priceDisplay: "$10/mo",
    data: "1 GB",
    dataBytes: 1073741824,
    overage: "$2/GB at full speed",
    description: "1 GB of high-speed data. $2 per additional GB.",
    features: [
      "1 GB high-speed data",
      "Unlimited talk & text",
      "$2/GB overage at full speed",
      "eSIM + SIP dialer",
    ],
  },
  {
    id: "unlimited_25",
    name: "Unlimited 30",
    price: 25,
    priceDisplay: "$25/mo",
    data: "30 GB (Unlimited)",
    dataBytes: 32212254720,
    overage: "Throttled to 1 Mbps after 30 GB",
    throttleAfter: 32212254720,
    description: "30 GB at full speed, then unlimited at 1 Mbps.",
    features: [
      "30 GB high-speed data",
      "Unlimited talk & text",
      "Unlimited data after 30 GB (throttled)",
      "eSIM + SIP dialer",
    ],
  },
  {
    id: "unlimited_25_plus",
    name: "Unlimited 30 Plus",
    price: 25,
    priceDisplay: "$25/mo",
    data: "30 GB + Overage",
    dataBytes: 32212254720,
    overage: "$2/GB at full speed after 30 GB",
    description: "30 GB at full speed. Stay fast with $2/GB overage.",
    features: [
      "30 GB high-speed data",
      "Unlimited talk & text",
      "$2/GB overage at full speed",
      "eSIM + SIP dialer",
    ],
  },
];

/**
 * The plan selected by default. Kept as `unlimited_25` (the flagship plan and
 * the middleware's own default) regardless of array order, so signup defaults
 * and admin revenue math stay anchored to the $25 plan.
 */
export const DEFAULT_PLAN =
  PLANS.find((p) => p.id === "unlimited_25") ?? PLANS[0];
