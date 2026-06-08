/**
 * Lightweight client-side handoff between signup steps.
 *
 * The signup flow spans several routes (/signup → /signup/choose-number →
 * /onboarding → /status) with no server session, so we stash the in-flight
 * signup draft and the created account in sessionStorage. sessionStorage (not
 * localStorage) so it clears when the tab closes — these payloads include
 * provisioning links we don't want lingering on a shared device.
 *
 * Guarded for SSR: every accessor no-ops when `window` is undefined.
 */
import type { Account, ServiceChoice } from "./api";

const DRAFT_KEY = "pivot.signup.draft";
const ACCOUNT_KEY = "pivot.account";

export interface SignupDraft {
  email: string;
  service: ServiceChoice;
  /** Selected plan id (lib/plans.ts). */
  plan: string;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export const saveDraft = (d: SignupDraft) => write(DRAFT_KEY, d);
export const getDraft = () => read<SignupDraft>(DRAFT_KEY);

export const saveAccount = (a: Account) => write(ACCOUNT_KEY, a);
export const getAccount = () => read<Account>(ACCOUNT_KEY);
