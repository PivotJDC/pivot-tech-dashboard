import Link from "next/link";
import {
  MessageSquare,
  Phone,
  Signal,
  Wifi,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Phone, label: "Unlimited talk" },
  { icon: MessageSquare, label: "Unlimited text" },
  { icon: Wifi, label: "Unlimited data" },
];

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
        <Button asChild variant="ghost" size="sm">
          <Link href="/status">My account</Link>
        </Button>
      </header>

      <section className="container flex flex-col items-center pb-20 pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
          <Signal className="h-4 w-4" />
          Powered by BICS multi-IMSI eSIM technology
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

      <footer className="container border-t py-8 text-center text-sm text-muted-foreground">
        <p>
          Pivot-Tech Development Inc. · Unlimited plan is $25/month. eSIM-capable
          device required.
        </p>
      </footer>
    </main>
  );
}
