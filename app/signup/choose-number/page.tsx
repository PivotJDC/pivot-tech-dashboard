"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ApiError,
  createAccount,
  getAvailableNumbers,
  type AvailableNumber,
} from "@/lib/api";
import {
  clearAddLine,
  getAddLine,
  getAddLineEmail,
  getDraft,
  saveAccount,
  setAddLine,
} from "@/lib/session";
import { marketForAreaCode, SUGGESTED_AREA_CODES } from "@/lib/markets";

/** Format +12085550100 → (208) 555-0100 for display. */
function formatNumber(e164: string): string {
  const d = e164.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length !== 10) return e164;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}

export default function ChooseNumberPage() {
  const router = useRouter();
  const [areacode, setAreacode] = useState("");
  const [numbers, setNumbers] = useState<AvailableNumber[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The API reported this email already has an account — offer "add a line".
  const [duplicateEmail, setDuplicateEmail] = useState(false);

  // Guard: this step requires an in-flight signup draft (email + choice).
  useEffect(() => {
    if (!getDraft()) router.replace("/signup");
  }, [router]);

  async function search() {
    if (!/^\d{3}$/.test(areacode)) {
      setError("Enter a 3-digit area code.");
      return;
    }
    setError(null);
    setSelected(null);
    setSearching(true);
    try {
      const results = await getAvailableNumbers(areacode);
      // The API returns up to 50; render what we get.
      setNumbers(results.slice(0, 50));
    } catch (err) {
      setNumbers(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't load numbers. Please try again.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function confirm(addLine = false) {
    const draft = getDraft();
    if (!draft || !selected) return;
    setError(null);
    setDuplicateEmail(false);
    setSubmitting(true);
    // Add-a-line: send the primary's email so the middleware creates this as a
    // child line. Honor either the explicit arg or a previously-stored flag.
    const parentEmail = addLine || getAddLine() ? getAddLineEmail() : "";
    // Enrollment details captured in step 2 of /signup, resolved for billing.
    const billing = draft.billingSameAsService === false
      ? draft.billingAddress
      : draft.serviceAddress;
    try {
      const account = await createAccount({
        email: draft.email,
        market: marketForAreaCode(areacode),
        plan: draft.plan,
        service: "new",
        phone_e164: selected,
        first_name: draft.firstName,
        last_name: draft.lastName,
        service_address: draft.serviceAddress,
        billing_address: billing,
        ...(draft.promoCode ? { promo_code: draft.promoCode } : {}),
        ...(parentEmail ? { parent_email: parentEmail } : {}),
      });
      clearAddLine();
      saveAccount(account);
      router.push("/onboarding");
    } catch (err) {
      setSubmitting(false);
      // Duplicate email → offer to add a line instead of dead-ending. Only on
      // the first attempt; if it recurs after "Add a Line", the middleware
      // doesn't yet support linking, so fall through to a plain message.
      const isDuplicateEmail = err instanceof ApiError
        && err.code === "VALIDATION_ERROR"
        && err.field === "email";
      if (isDuplicateEmail && !addLine) {
        setDuplicateEmail(true);
        return;
      }
      if (isDuplicateEmail && addLine) {
        setError(
          "Thanks! Adding a line to an existing account isn't fully automated "
          + "yet — our team will reach out to finish setting it up.",
        );
        return;
      }
      // The chosen number was taken between selection and checkout
      // (DID_UNAVAILABLE). Clear the selection, keep the list visible, and
      // refresh availability so the user can pick another number.
      const numberUnavailable = err instanceof ApiError
        && err.code === "VALIDATION_ERROR"
        && err.field === "phone_e164";
      if (numberUnavailable) {
        setSelected(null);
        // Refresh availability, then set the message LAST: search() resets
        // error to null at its start, so setting it afterward wins (both run
        // synchronously in this tick and are batched). The list stays visible.
        search();
        setError(
          "The number you selected is no longer available. "
          + "Please choose a different number.",
        );
        return;
      }
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reserve that number. Please try another.",
      );
    }
  }

  // "Add a Line": remember the intent (the middleware will link a child account
  // in a later update) and retry reserving the number.
  function handleAddLine() {
    const draft = getDraft();
    if (draft) setAddLine(draft.email);
    setDuplicateEmail(false);
    confirm(true);
  }

  // "Use Different Email": return to the start of signup to re-enter the email.
  function handleUseDifferentEmail() {
    setDuplicateEmail(false);
    setError(null);
    router.push("/signup");
  }

  return (
    <main className="brand-dark min-h-dvh">
      <div className="container flex min-h-dvh max-w-2xl flex-col py-10">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 self-start"
        onClick={() => router.push("/signup")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-primary">Step 2 of 2</p>
          <CardTitle>Choose your new number</CardTitle>
          <CardDescription>
            Enter an area code to see available numbers.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="areacode">Area code</Label>
            {/* Guided suggestions — tap to fill. Any US area code also works. */}
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_AREA_CODES.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setAreacode(s.code)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    areacode === s.code
                      ? "border-primary bg-accent/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {s.code} ({s.label})
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Input
                id="areacode"
                inputMode="numeric"
                pattern="\d{3}"
                maxLength={3}
                placeholder="Enter area code (e.g., 208)"
                value={areacode}
                onChange={(e) =>
                  setAreacode(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="flex-1"
                autoFocus
              />
              <Button onClick={search} disabled={searching || areacode.length !== 3}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          {numbers !== null && (
            <div className="space-y-3">
              {numbers.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No numbers available in this area code. Try another.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {numbers.length} available — tap one to select.
                  </p>
                  <div className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto rounded-lg border bg-muted/30 p-2 sm:grid-cols-3">
                    {numbers.map((n) => {
                      const active = selected === n.e164;
                      return (
                        <button
                          key={n.e164}
                          type="button"
                          onClick={() => setSelected(n.e164)}
                          className={cn(
                            "rounded-md border-2 bg-card px-3 py-3 text-center text-sm font-medium tabular-nums transition-colors",
                            active
                              ? "border-primary text-primary"
                              : "border-transparent hover:border-border",
                          )}
                        >
                          {n.formatted}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {duplicateEmail ? (
            <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-accent/40 p-4">
              <p className="text-sm font-medium">
                This email already has a MobilityNet account. Want to add another
                line?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={handleAddLine}
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add a Line
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleUseDifferentEmail}
                  disabled={submitting}
                >
                  Use Different Email
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={!selected || submitting}
              onClick={() => confirm()}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {selected
                ? `Continue with ${formatNumber(selected)}`
                : "Select a number to continue"}
            </Button>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
