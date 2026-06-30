import Link from "next/link";
import {
  Check,
  MessageSquare,
  Phone,
  Signal,
  Users,
  Wifi,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLANS } from "@/lib/plans";

const FEATURES = [
  { icon: Phone, label: "Unlimited talk" },
  { icon: MessageSquare, label: "Unlimited text" },
  { icon: Wifi, label: "Unlimited data" },
];

// The flagship $25 plan is highlighted on the pricing grid.
const POPULAR_PLAN_ID = "unlimited_25";

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Warm radial glow behind the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(60%_60%_at_50%_0%,hsl(40_96%_88%)_0%,transparent_70%)]"
      />

      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <Signal className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-semibold">Pivot-Tech</span>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/status">My account</Link>
          </Button>
        </div>
      </header>

      <section className="container flex flex-col items-center pb-20 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
          <Signal className="h-4 w-4" />
          Powered by universal eSIM technology — works on any unlocked device
        </span>

        <h1 className="mt-8 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Unlimited talk, text &amp; data.
          <br />
          <span className="text-primary">$25</span>
          <span className="text-3xl font-medium text-muted-foreground sm:text-4xl">
            /month
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
          One simple plan. No contracts, no overages, no surprises. Activate in
          minutes with an eSIM — keep your number or get a new one.
        </p>

        <div className="mt-9 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">
              Sign up — $25/mo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <ul className="mt-14 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center justify-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-sm"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="container pb-24" id="plans">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Pick the plan that fits
          </h2>
          <p className="mt-3 text-balance text-muted-foreground">
            Every plan includes unlimited talk &amp; text, an eSIM, and the
            Pivot-Tech dialer. No contracts — change or cancel anytime.
          </p>
        </div>

        <div className="mx-auto mt-12 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const popular = plan.id === POPULAR_PLAN_ID;
            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col",
                  popular && "border-primary shadow-lg ring-1 ring-primary",
                )}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                )}
                <CardHeader>
                  <CardTitle className="font-display text-xl">
                    {plan.name}
                  </CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-4xl font-semibold tabular-nums">
                      ${plan.price}
                    </span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <CardDescription>{plan.data}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <ul className="space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    variant={popular ? "default" : "outline"}
                    className="mt-6 w-full"
                  >
                    <Link href={`/signup?plan=${plan.id}`}>
                      Choose {plan.name}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Family Plan — multiple lines under one account. */}
        <div className="mx-auto mt-6 max-w-5xl">
          <Card className="border-primary/30 bg-accent/30">
            <CardContent className="flex flex-col items-start gap-5 py-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-xl font-semibold">Family Plan</h3>
                </div>
                <p className="text-sm font-medium text-primary">
                  Multiple lines, one bill
                </p>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Add lines for family members under a single account. Each
                  member chooses their own plan.
                </p>
              </div>
              <Button asChild size="lg" className="w-full shrink-0 md:w-auto">
                <Link href="/signup?family=true">
                  Start a Family Plan
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="container border-t py-8 text-center text-sm text-muted-foreground">
        <p>
          Pivot-Tech Development Inc. · Unlimited plan is $25/month. eSIM-capable
          device required.
        </p>
      </footer>
    </main>
  );
}
