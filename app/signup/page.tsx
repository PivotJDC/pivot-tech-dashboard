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
import { createAccount, ApiError, type ServiceChoice } from "@/lib/api";
import { saveAccount, saveDraft } from "@/lib/session";
import { areaCodeFromNumber, marketForAreaCode } from "@/lib/markets";
import { PLANS, DEFAULT_PLAN, type Plan } from "@/lib/plans";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState(DEFAULT_PLAN.id);
  // True once a valid plan arrives via ?plan= (landing-page pricing card). When
  // set, the picker collapses to a confirmed summary so the user lands straight
  // on email entry.
  const [planLocked, setPlanLocked] = useState(false);
  const [service, setService] = useState<ServiceChoice>("new");
  const [currentNumber, setCurrentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Honor a ?plan= deep link from the landing-page pricing cards. Read in an
  // effect (after mount) rather than in the useState initializer: /signup is
  // statically prerendered, so reading window during render would hydrate with
  // a value that mismatches the server HTML and the selection would be dropped.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("plan");
    if (requested && PLANS.some((p) => p.id === requested)) {
      setPlan(requested);
      setPlanLocked(true);
    }
  }, []);

  const emailValid = EMAIL_RE.test(email);
  const selectedPlan = PLANS.find((p) => p.id === plan) ?? DEFAULT_PLAN;

  function goToStep2() {
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleSubmit() {
    setError(null);

    // New number: we can't create the account until the customer picks a
    // specific number, so defer the POST to /signup/choose-number.
    if (service === "new") {
      saveDraft({ email, service, plan });
      router.push("/signup/choose-number");
      return;
    }

    // Port-in: create the account now from the number they're bringing over.
    // DECISION: the full port (carrier, PIN, billing zip) is Phase 2 in the
    // middleware; here we create the account + port intent and derive the
    // market from the existing number's area code.
    const areacode = areaCodeFromNumber(currentNumber);
    if (!areacode) {
      setError("Please enter the number you'd like to bring, including area code.");
      return;
    }

    setSubmitting(true);
    try {
      const account = await createAccount({
        email,
        market: marketForAreaCode(areacode),
        plan,
        service: "port",
        port: {
          number_e164: currentNumber,
          losing_carrier: "",
          account_number: "",
          pin: "",
          billing_zip: "",
        },
      });
      saveAccount(account);
      router.push("/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong creating your account. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6 self-start">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-primary">
            Step {step} of 2
          </p>
          <CardTitle>
            {step === 1 ? "Let's get you set up" : "Pick your number"}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? `${selectedPlan.description} for $${selectedPlan.price}/month.`
              : "Start fresh with a new number, or bring your current one."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Your plan</Label>
                {planLocked ? (
                  // Plan chosen on the landing page — show it confirmed and let
                  // the picker reopen if they want to change it.
                  <div className="space-y-2">
                    <PlanOption plan={selectedPlan} selected onSelect={() => {}} />
                    <button
                      type="button"
                      onClick={() => setPlanLocked(false)}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Change plan
                    </button>
                  </div>
                ) : (
                  // Data-driven from lib/plans.ts — add a plan there, no UI change.
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
                )}
              </div>

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
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  We’ll send your account details and receipts here.
                </p>
              </div>
            </>
          )}

          {step === 2 && (
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
                <div className="space-y-2 pt-2">
                  <Label htmlFor="current-number">Your current number</Label>
                  <Input
                    id="current-number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(208) 555-0100"
                    value={currentNumber}
                    onChange={(e) => setCurrentNumber(e.target.value)}
                  />
                </div>
              )}
            </RadioGroup>
          )}

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          {step === 1 ? (
            <Button className="w-full" onClick={goToStep2} disabled={!emailValid}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                className="flex-[2]"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {service === "new" ? "Choose a number" : "Create my account"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
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
