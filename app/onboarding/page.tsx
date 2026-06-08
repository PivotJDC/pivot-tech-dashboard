"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "@/components/step-indicator";
import { getAccount } from "@/lib/session";
import type { Account } from "@/lib/api";

const STEPS = ["Install eSIM", "Download App", "Scan QR", "Done"];

/** +12085550100 → (208) 555-0100. */
function formatNumber(e164?: string): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length !== 10) return e164;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const a = getAccount();
    if (!a) {
      router.replace("/signup");
      return;
    }
    setAccount(a);
    setReady(true);
  }, [router]);

  if (!ready || !account) return null;

  const acrobitsQr = account.provisioning?.qr_code_url;

  return (
    <main className="container max-w-2xl py-10">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium text-primary">You’re almost there</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Set up your phone
        </h1>
      </div>

      <div className="mb-10">
        <StepIndicator steps={STEPS} current={0} />
      </div>

      {/* Prominent phone number. */}
      <Card className="mb-8 border-primary/30 bg-accent/40">
        <CardContent className="flex flex-col items-center gap-1 py-6 text-center">
          <span className="text-sm font-medium text-muted-foreground">
            Your new number
          </span>
          <span className="font-display text-4xl font-semibold tabular-nums text-foreground">
            {formatNumber(account.phone_e164) || "Pending assignment"}
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Step 1 — eSIM (BICS placeholder). */}
        <QrCard
          step="1. Install your eSIM"
          caption="Scan in Settings → Cellular → Add eSIM."
        >
          <PlaceholderQr label="eSIM QR" sublabel="Provisioned by BICS" />
        </QrCard>

        {/* Step 3 — Acrobits dialer provisioning. */}
        <QrCard
          step="3. Scan to activate your dialer"
          caption="Open the Pivot-Tech app, then scan this code."
        >
          {acrobitsQr ? (
            // qr_code_url is a self-contained data: URL from the middleware.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={acrobitsQr}
              alt="Acrobits provisioning QR code"
              className="h-44 w-44 rounded-lg border bg-white p-2"
            />
          ) : (
            <PlaceholderQr label="QR pending" sublabel="Refresh in a moment" />
          )}
        </QrCard>
      </div>

      {/* Step 2 reminder. */}
      <Card className="mt-6">
        <CardContent className="flex items-center gap-4 py-5">
          <Smartphone className="h-6 w-6 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold">2. Download the Pivot-Tech app</p>
            <p className="text-muted-foreground">
              Get it from the App Store or Google Play, then come back to scan the
              code above.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button asChild size="lg" className="mt-8 w-full">
        <Link href="/status">
          Check my activation status
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </main>
  );
}

function QrCard({
  step,
  caption,
  children,
}: {
  step: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="font-semibold">{step}</p>
        <div className="flex h-44 w-44 items-center justify-center">
          {children}
        </div>
        <p className="text-sm text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

function PlaceholderQr({
  label,
  sublabel,
}: {
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex h-44 w-44 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed bg-muted/40 text-center">
      <span
        aria-hidden
        className="grid grid-cols-4 grid-rows-4 gap-1 opacity-40"
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className={cellShade(i)}
          />
        ))}
      </span>
      <span className="mt-2 text-sm font-semibold">{label}</span>
      <span className="text-xs text-muted-foreground">{sublabel}</span>
    </div>
  );
}

// Deterministic checkerboard-ish pattern so the placeholder reads as a QR.
function cellShade(i: number): string {
  const filled = [0, 1, 2, 4, 6, 8, 11, 12, 14, 15].includes(i);
  return `h-3 w-3 rounded-[2px] ${filled ? "bg-foreground/70" : "bg-transparent"}`;
}
