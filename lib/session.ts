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

// "Add a line" intent: the customer hit a duplicate-email at signup and chose to
// add another line to their existing account. Stored as a plain "true" flag plus
// the email, for the (future) middleware child-account linking step to consume.
const ADD_LINE_KEY = "add_line";
const ADD_LINE_EMAIL_KEY = "add_line_email";

export function setAddLine(email: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADD_LINE_KEY, "true");
  window.sessionStorage.setItem(ADD_LINE_EMAIL_KEY, email);
}

export function getAddLine(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(ADD_LINE_KEY) === "true";
}

/** The primary account's email stored by setAddLine (empty string if none). */
export function getAddLineEmail(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(ADD_LINE_EMAIL_KEY) ?? "";
}

/** Clear the add-a-line flags once the child line has been created. */
export function clearAddLine() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADD_LINE_KEY);
  window.sessionStorage.removeItem(ADD_LINE_EMAIL_KEY);
}

// Family-plan mode: set when a customer starts a family plan (/signup?family=true).
// Persists through onboarding so we can offer "Add a family member?" after each
// line completes, looping until they choose "Done for Now".
const FAMILY_KEY = "family";

export function setFamilyMode() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FAMILY_KEY, "true");
}

export function getFamilyMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(FAMILY_KEY) === "true";
}

export function clearFamilyMode() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FAMILY_KEY);
}
