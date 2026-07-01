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
    <main className="brand-dark relative min-h-dvh overflow-hidden">
      {/* Cyan radial glow behind the hero (mobilitynet.io accent). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(0,212,255,0.16)_0%,transparent_70%)]"
      />

      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <Signal className="h-6 w-6 text-brand-cyan" />
          <span className="font-display text-xl font-semibold tracking-tight">
            MobilityNet
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Cross-link back to the marketing site. */}
          <a
            href="https://mobilitynet.io"
            className="hidden rounded-full border border-brand-cyan/40 px-3.5 py-1.5 text-sm font-medium text-brand-muted transition-colors hover:border-brand-cyan hover:text-brand-cyan sm:inline-flex"
          >
            MobilityNet.io
          </a>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-brand-cyan hover:bg-white/5 hover:text-brand-cyan"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-brand-muted hover:bg-white/5">
            <Link href="/status">My account</Link>
          </Button>
        </div>
      </header>

      <section className="container flex flex-col items-center pb-20 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-cyan/30 bg-white/5 px-4 py-1.5 text-sm font-medium text-brand-muted">
          <Signal className="h-4 w-4 text-brand-cyan" />
          Powered by universal eSIM technology — works on any unlocked device
        </span>

        <h1 className="mt-8 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          <span className="text-cyan-gradient">Unlimited</span> talk, text &amp; data.
          <br />
          <span className="text-brand-cyan">$25</span>
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
              Get Started — $25/mo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <ul className="mt-14 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="brand-glow flex items-center justify-center gap-3 rounded-xl border bg-card px-5 py-4"
            >
              <Icon className="h-5 w-5 text-brand-cyan" />
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
            MobilityNet dialer. No contracts — change or cancel anytime.
          </p>
        </div>

        <div className="mx-auto mt-12 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const popular = plan.id === POPULAR_PLAN_ID;
            return (
              <Card
                key={plan.id}
                className={cn(
                  "brand-glow relative flex flex-col",
                  popular && "border-brand-cyan ring-1 ring-brand-cyan/60",
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
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
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
          <Card className="brand-glow border-brand-cyan/30 bg-white/[0.03]">
            <CardContent className="flex flex-col items-start gap-5 py-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-cyan" />
                  <h3 className="font-display text-xl font-semibold">Family Plan</h3>
                </div>
                <p className="text-sm font-medium text-brand-cyan">
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
