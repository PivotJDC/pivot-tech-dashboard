/**
 * Service plans, data-driven.
 *
 * The signup UI renders selectable plans from this array, and the chosen
 * plan id is sent to the middleware as `plan` on POST /v1/accounts. Adding a
 * new plan is a one-line change here — no UI edits required. `id` must match a
 * plan slug the middleware accepts (it defaults to `unlimited_25`).
 */
export interface Plan {
  id: string;
  label: string;
  price: number;
  description: string;
}

export const PLANS: Plan[] = [
  {
    id: "unlimited_25",
    label: "Unlimited",
    price: 25,
    description: "Unlimited talk, text & data",
  },
];

/** The plan selected by default (first entry). */
export const DEFAULT_PLAN = PLANS[0];
