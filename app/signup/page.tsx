"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Loader2, Phone, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UsStatesSelect } from "@/components/us-states-select";
import {
  createAccount,
  checkPortability,
  ApiError,
  type ServiceChoice,
  type PortabilityResult,
} from "@/lib/api";
import {
  clearAddLine,
  getAddLine,
  getAddLineEmail,
  saveAccount,
  saveDraft,
  setAddLine,
  setFamilyMode,
  type Address,
} from "@/lib/session";
import { toUsE164, marketForAreaCode } from "@/lib/markets";
import { PLANS, DEFAULT_PLAN, type Plan } from "@/lib/plans";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}$/;
const EMPTY_ADDRESS: Address = {
  line1: "", line2: "", city: "", state: "", zip: "",
};

function addressValid(a: Address): boolean {
  return Boolean(a.line1.trim() && a.city.trim() && a.state && ZIP_RE.test(a.zip));
}

// PO Boxes / non-physical addresses can't be used for mobile service — E911
// can't dispatch to them. Matches PO Box, P.O. Box, P O Box, Post Office Box,
// PMB, HC (Highway Contract), and General Delivery.
const PO_BOX_RE = /\b(p\.?\s*o\.?\s*box|post\s*office|pmb|hc|general\s*delivery)\b/i;
const PO_BOX_MESSAGE = "A physical street address is required. PO Boxes cannot be used for mobile service.";

function isPoBoxAddress(a: Address): boolean {
  return PO_BOX_RE.test(a.line1) || PO_BOX_RE.test(a.line2 ?? "");
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState(DEFAULT_PLAN.id);
  // Step 2 — enrollment details (Telgoo5).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serviceAddress, setServiceAddress] = useState<Address>(EMPTY_ADDRESS);
  const [billingSameAsService, setBillingSameAsService] = useState(true);
  const [billingAddress, setBillingAddress] = useState<Address>(EMPTY_ADDRESS);
  const [promoCode, setPromoCode] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  // True once a valid plan arrives via ?plan= (landing-page pricing card). When
  // set, the picker collapses to a confirmed summary so the user lands straight
  // on email entry.
  const [planLocked, setPlanLocked] = useState(false);
  const [service, setService] = useState<ServiceChoice>("new");
  const [currentNumber, setCurrentNumber] = useState("");
  // FastPort: the portability result for currentNumber, and the losing-carrier
  // authorization details we collect once a number is confirmed portable.
  const [portability, setPortability] = useState<PortabilityResult | null>(null);
  const [checkingPort, setCheckingPort] = useState(false);
  const [carrierAccountNumber, setCarrierAccountNumber] = useState("");
  const [transferPin, setTransferPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The API reported this email already has an account — offer "add a line".
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  // True when adding a family member: the email is the primary's (locked) and
  // this signup creates a child line.
  const [addingLine, setAddingLine] = useState(false);

  // Read query/session state after mount (not in the useState initializer):
  // /signup is statically prerendered, so reading window during render would
  // hydrate with a value that mismatches the server HTML.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const requested = search.get("plan");
    if (requested && PLANS.some((p) => p.id === requested)) {
      setPlan(requested);
      setPlanLocked(true);
    }
    // Starting a family plan — remember it so onboarding offers "add a member".
    if (search.get("family") === "true") setFamilyMode();
    // Adding a family member (or duplicate-email add-line): the email is the
    // primary account's — prefill and lock it; each member still picks a plan.
    if (getAddLine()) {
      setAddingLine(true);
      setEmail(getAddLineEmail());
    }
  }, []);

  const emailValid = EMAIL_RE.test(email);
  const selectedPlan = PLANS.find((p) => p.id === plan) ?? DEFAULT_PLAN;
  const infoValid = Boolean(firstName.trim() && lastName.trim())
    && addressValid(serviceAddress)
    && (billingSameAsService || addressValid(billingAddress));

  const setServiceField = (field: keyof Address, value: string) => setServiceAddress(
    (a) => ({ ...a, [field]: value }),
  );
  const setBillingField = (field: keyof Address, value: string) => setBillingAddress(
    (a) => ({ ...a, [field]: value }),
  );

  /** The full draft to hand off to the choose-number step. */
  function buildDraft() {
    return {
      email,
      service,
      plan,
      firstName,
      lastName,
      serviceAddress,
      billingAddress,
      billingSameAsService,
      promoCode,
    };
  }

  // Step 1 (plan + email) → Step 2 (your information).
  function goToStep2() {
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setStep(2);
  }

  // Step 2 (your information) → Step 3 (number).
  function goToStep3() {
    if (!infoValid) {
      setError("Please complete your name and address (ZIP must be 5 digits).");
      return;
    }
    // Reject PO Boxes on the service address and (when different) the billing
    // address before advancing.
    if (
      isPoBoxAddress(serviceAddress)
      || (!billingSameAsService && isPoBoxAddress(billingAddress))
    ) {
      setError(PO_BOX_MESSAGE);
      return;
    }
    setError(null);
    saveDraft(buildDraft());
    setStep(3);
  }

  // FastPort: verify the number can be ported (and whether it's same-day
  // FastPort) before we collect carrier details. Public endpoint — no account
  // needed. On success we reveal the carrier-detail fields.
  async function handleCheckPortability() {
    setError(null);
    const portNumber = toUsE164(currentNumber);
    if (!portNumber) {
      setError("Please enter a valid 10-digit US number to port.");
      return;
    }
    setCheckingPort(true);
    try {
      const result = await checkPortability(portNumber);
      setPortability(result);
      if (!result.portable) {
        setError(
          result.not_portable_reason
            ? `This number can't be ported: ${result.not_portable_reason}`
            : "This number can't be ported to MobilityNet.",
        );
      }
    } catch (err) {
      setPortability(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't check that number right now. Please try again.",
      );
    } finally {
      setCheckingPort(false);
    }
  }

  // Carrier authorization details are required once the number is portable.
  const portDetailsValid = Boolean(
    portability?.portable
      && carrierAccountNumber.trim()
      && transferPin.trim(),
  );

  async function handleSubmit(addLine = false) {
    setError(null);
    setDuplicateEmail(false);

    // New number: we can't create the account until the customer picks a
    // specific number, so defer the POST to /signup/choose-number (the draft
    // carries name/address/promo for that step).
    if (service === "new") {
      saveDraft(buildDraft());
      router.push("/signup/choose-number");
      return;
    }

    // Port-in: create the account now from the number they're bringing over.
    // The temp DID assigned at account creation gives instant service; the
    // middleware opens the FastPort port order alongside it and swaps the ported
    // number in once the port completes.
    // Accept any 10-digit US number (any market/area code). Normalize to E.164
    // so the middleware can derive the area code and never rejects on market.
    const portNumber = toUsE164(currentNumber);
    if (!portNumber) {
      setError("Please enter a valid 10-digit US number to port.");
      return;
    }
    // Must have confirmed portability + collected the carrier authorization.
    if (!portability?.portable) {
      setError('Please check your number is portable first.');
      return;
    }
    if (!portDetailsValid) {
      setError("Enter your current carrier account number and transfer PIN.");
      return;
    }
    const areacode = portNumber.slice(2, 5);

    setSubmitting(true);
    // Add-a-line: send the primary's email so the middleware ports this number
    // in as a child line. Honor either the explicit arg or a stored flag.
    const parentEmail = addLine || getAddLine() ? getAddLineEmail() : "";
    const billing = billingSameAsService ? serviceAddress : billingAddress;
    try {
      const account = await createAccount({
        email,
        market: marketForAreaCode(areacode),
        plan,
        service: "port",
        port: {
          number_e164: portNumber,
          losing_carrier: portability.carrier_name ?? "",
          account_number: carrierAccountNumber.trim(),
          pin: transferPin.trim(),
          billing_zip: serviceAddress.zip,
          auth_name: `${firstName} ${lastName}`.trim(),
        },
        first_name: firstName,
        last_name: lastName,
        service_address: serviceAddress,
        billing_address: billing,
        ...(promoCode ? { promo_code: promoCode } : {}),
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
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong creating your account. Please try again.",
      );
    }
  }

  // "Add a Line": remember the intent (the middleware will link a child account
  // in a later update) and continue the signup flow.
  function handleAddLine() {
    setAddLine(email);
    setDuplicateEmail(false);
    handleSubmit(true);
  }

  // "Use Different Email": clear the field and return to email entry.
  function handleUseDifferentEmail() {
    setDuplicateEmail(false);
    setError(null);
    setEmail("");
    setStep(1);
  }

  return (
    <main className="brand-dark min-h-dvh">
      <div className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6 self-start">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-primary">
            Step {step} of 3
          </p>
          <CardTitle>
            {step === 1 && "Let's get you set up"}
            {step === 2 && "Your information"}
            {step === 3 && "Pick your number"}
          </CardTitle>
          <CardDescription>
            {step === 1
              && `${selectedPlan.name} — ${selectedPlan.description} for $${selectedPlan.price}/month.`}
            {step === 2 && "We need your name and address to activate service."}
            {step === 3 && "Start fresh with a new number, or bring your current one."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {step === 1 && (
            <>
              {/* When the plan arrived via ?plan= the customer already chose on
                  the landing page — skip the picker and go straight to email.
                  The chosen plan is shown in the card description above. */}
              {!planLocked && (
                <div className="space-y-2">
                  <Label>Your plan</Label>
                  {/* Data-driven from lib/plans.ts — add a plan there, no UI change. */}
                  <div className="space-y-2">
                    {PLANS.map((p) => (
                      <PlanOption
                        key={p.id}
                        plan={p}
                        selected={p.id === plan}
                        onSelect={() => setPlan(p.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {addingLine && (
                <div className="rounded-lg border-2 border-primary/30 bg-accent/40 p-3 text-sm">
                  <span className="font-medium">Adding a family line</span> under{" "}
                  <span className="font-medium">{email}</span>. Pick this member’s
                  plan and number below.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goToStep2()}
                  disabled={addingLine}
                  autoFocus={!addingLine}
                />
                <p className="text-xs text-muted-foreground">
                  {addingLine
                    ? "Family lines share the primary account’s email."
                    : "We’ll send your account details and receipts here."}
                </p>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <AddressFields
                idPrefix="svc"
                label="Service address"
                address={serviceAddress}
                onField={setServiceField}
              />

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={billingSameAsService}
                  onChange={(e) => setBillingSameAsService(e.target.checked)}
                />
                Billing address same as service address
              </label>

              {!billingSameAsService && (
                <AddressFields
                  idPrefix="bill"
                  label="Billing address"
                  address={billingAddress}
                  onField={setBillingField}
                />
              )}

              {showPromo ? (
                <div className="space-y-2">
                  <Label htmlFor="promo">Promo code</Label>
                  <Input
                    id="promo"
                    placeholder="e.g. FOX-12345"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPromo(true)}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Have a promo code?
                </button>
              )}
            </>
          )}

          {step === 3 && (
            <RadioGroup
              value={service}
              onValueChange={(v) => setService(v as ServiceChoice)}
            >
              <ServiceOption
                value="new"
                selected={service === "new"}
                icon={Phone}
                title="Get a new number"
                description="Choose a number in your area code."
              />
              <ServiceOption
                value="port"
                selected={service === "port"}
                icon={Repeat}
                title="Port my existing number"
                description="Keep the number you already have."
              />

              {service === "port" && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-number">Your current number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="current-number"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(208) 555-0100"
                        value={currentNumber}
                        onChange={(e) => {
                          setCurrentNumber(e.target.value);
                          // Any edit invalidates a prior portability result.
                          setPortability(null);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCheckPortability}
                        disabled={checkingPort || !currentNumber.trim()}
                      >
                        {checkingPort && <Loader2 className="h-4 w-4 animate-spin" />}
                        Check
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll confirm your number can move to MobilityNet before
                      you continue.
                    </p>
                  </div>

                  {portability?.portable && (
                    <div className="space-y-4 rounded-lg border-2 border-primary/30 bg-accent/40 p-4">
                      <div className="flex items-start gap-2 text-sm font-medium">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>
                          Good news — this number can be ported
                          {portability.carrier_name
                            ? ` from ${portability.carrier_name}`
                            : ""}
                          .
                          {portability.fast_portable && (
                            <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">
                              FastPort · same-day
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="carrier-account">
                          Current carrier account number
                        </Label>
                        <Input
                          id="carrier-account"
                          autoComplete="off"
                          placeholder="Account number with your current carrier"
                          value={carrierAccountNumber}
                          onChange={(e) => setCarrierAccountNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transfer-pin">Transfer PIN / passcode</Label>
                        <Input
                          id="transfer-pin"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="Port-out PIN from your current carrier"
                          value={transferPin}
                          onChange={(e) => setTransferPin(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Ask your current carrier for your account number and
                          transfer PIN (sometimes called a port-out PIN).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </RadioGroup>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
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
          ) : step === 1 ? (
            <Button className="w-full" onClick={goToStep2} disabled={!emailValid}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : step === 2 ? (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="flex-[2]" onClick={goToStep3} disabled={!infoValid}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                className="flex-[2]"
                onClick={() => handleSubmit()}
                disabled={submitting || (service === "port" && !portDetailsValid)}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {service === "new" ? "Choose a number" : "Create my account"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}

function AddressFields({
  idPrefix,
  label,
  address,
  onField,
}: {
  idPrefix: string;
  label: string;
  address: Address;
  onField: (field: keyof Address, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        id={`${idPrefix}-line1`}
        autoComplete="address-line1"
        placeholder="Street address"
        value={address.line1}
        onChange={(e) => onField("line1", e.target.value)}
      />
      <Input
        id={`${idPrefix}-line2`}
        autoComplete="address-line2"
        placeholder="Apt, suite, etc. (optional)"
        value={address.line2 ?? ""}
        onChange={(e) => onField("line2", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          id={`${idPrefix}-city`}
          autoComplete="address-level2"
          placeholder="City"
          value={address.city}
          onChange={(e) => onField("city", e.target.value)}
        />
        <UsStatesSelect
          id={`${idPrefix}-state`}
          value={address.state}
          onChange={(v) => onField("state", v)}
        />
      </div>
      <Input
        id={`${idPrefix}-zip`}
        inputMode="numeric"
        maxLength={5}
        autoComplete="postal-code"
        placeholder="ZIP code"
        value={address.zip}
        onChange={(e) => onField("zip", e.target.value.replace(/\D/g, "").slice(0, 5))}
        className="max-w-[10rem]"
      />
    </div>
  );
}

function PlanOption({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border-2 p-4 text-left transition-colors",
        selected ? "border-primary bg-accent/40" : "border-border hover:bg-muted",
      )}
    >
      <span className="space-y-0.5">
        <span className="flex items-center gap-2 font-semibold leading-none">
          {plan.name}
          {selected && <Check className="h-4 w-4 text-primary" />}
        </span>
        <span className="block text-sm text-muted-foreground">
          {plan.description}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="font-display text-2xl font-semibold tabular-nums">
          ${plan.price}
        </span>
        <span className="block text-xs text-muted-foreground">/month</span>
      </span>
    </button>
  );
}

function ServiceOption({
  value,
  selected,
  icon: Icon,
  title,
  description,
}: {
  value: string;
  selected: boolean;
  icon: typeof Phone;
  title: string;
  description: string;
}) {
  return (
    <Label
      htmlFor={`service-${value}`}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-colors",
        selected ? "border-primary bg-accent/40" : "border-border hover:bg-muted",
      )}
    >
      <RadioGroupItem id={`service-${value}`} value={value} className="mt-0.5" />
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <span className="space-y-0.5">
        <span className="block font-semibold leading-none">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </Label>
  );
}
