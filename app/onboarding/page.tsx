"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StepIndicator } from "@/components/step-indicator";
import { ApnSetup } from "@/components/apn-setup";
import {
  clearAddLine,
  clearFamilyMode,
  getAccount,
  getFamilyMode,
  setAddLine,
} from "@/lib/session";
import type { Account } from "@/lib/api";

const STEPS = ["Install eSIM", "Download App", "Scan QR", "Done"];

// Acrobits Cloud Softphone (white-labeled as Pivot Mobility) on the App Store.
// Static placeholder until the branded store listings ship.
const APP_STORE_URL = "https://apps.apple.com/us/app/cloud-softphone/id313362813";
// Placeholder pending the published Pivot Mobility Android listing.
const PLAY_STORE_URL = "https://play.google.com/store/search?q=cloud%20softphone&c=apps";

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
  const [isFamily, setIsFamily] = useState(false);
  const [doneAdding, setDoneAdding] = useState(false);

  useEffect(() => {
    const a = getAccount();
    if (!a) {
      router.replace("/signup");
      return;
    }
    setAccount(a);
    setIsFamily(getFamilyMode());
    setReady(true);
  }, [router]);

  // Add another family line: reuse the add-a-line flow (parent_email = the
  // primary's email) and loop back through plan + number selection.
  function addAnotherLine() {
    const primaryEmail = account?.email;
    if (primaryEmail) setAddLine(primaryEmail);
    router.push("/signup");
  }

  function doneForNow() {
    clearFamilyMode();
    clearAddLine();
    setDoneAdding(true);
  }

  if (!ready || !account) return null;

  const acrobitsQr = account.provisioning?.qr_code_url;
  const esim = account.esim;

  return (
    <main className="brand-dark min-h-dvh">
      <div className="container max-w-2xl py-10">
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

      <div className="space-y-6">
        {/* Step 1 — eSIM install QR, rendered client-side from the LPA
            activation code returned by the middleware. */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <div>
              <p className="font-semibold">Step 1: Install eSIM</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan with your phone’s camera to install cellular data
              </p>
            </div>

            {esim?.activationCode ? (
              <>
                <div className="rounded-lg border bg-white p-3">
                  <QRCodeSVG
                    value={esim.activationCode}
                    size={168}
                    aria-label="eSIM installation QR code"
                  />
                </div>
                <div className="w-full max-w-sm space-y-2 text-left text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">iPhone:</span>{" "}
                    Settings → Cellular → Add eSIM → Scan QR
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Android:</span>{" "}
                    Settings → Network → SIMs → Add eSIM → Scan QR
                  </p>
                </div>
              </>
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/40 px-5 py-8 text-center">
                <Info className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium leading-snug">
                  eSIM provisioning is being processed. Check back shortly or
                  contact support.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* APN configuration — shown right after the eSIM install step. */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <p className="font-semibold">APN Setup</p>
            <div className="w-full max-w-sm">
              <ApnSetup />
            </div>
          </CardContent>
        </Card>

        {/* Step 2 — download the dialer app. Placeholder QR links to the
            App Store; Google Play link is a placeholder for now. */}
        <StepCard
          step="2. Download the Pivot Mobility app"
          caption={
            <span className="flex items-center justify-center gap-3">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                iOS — App Store
              </a>
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                Android — Google Play
              </a>
            </span>
          }
        >
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download on the App Store (iOS)"
            className="rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <PlaceholderQr label="iOS" sublabel="Scan or tap — App Store" />
          </a>
        </StepCard>

        {/* Step 3 — Acrobits dialer provisioning QR (real, works as-is). */}
        <StepCard
          step="3. Scan to activate your dialer"
          caption="Open the Pivot Mobility app, then scan this code."
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
        </StepCard>
      </div>

      {/* Family plan: after this line is set up, offer to add another. Loops
          until "Done for Now". */}
      {isFamily && !doneAdding && (
        <Card className="mt-8 border-primary/30 bg-accent/30">
          <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
            <div>
              <p className="font-display text-lg font-semibold">
                Add a family member?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add another line under this account. Each member picks their own
                plan and number.
              </p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={addAnotherLine}>
                Add Another Line
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="flex-1" onClick={doneForNow}>
                Done for Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {doneAdding && (
        <p className="mt-6 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          You can add more lines anytime from your account.
        </p>
      )}

      <Button asChild size="lg" className="mt-8 w-full">
        <Link href="/status">
          Check my activation status
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
      </div>
    </main>
  );
}

function StepCard({
  step,
  caption,
  children,
}: {
  step: string;
  caption: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="font-semibold">{step}</p>
        <div className="flex h-44 w-44 items-center justify-center">
          {children}
        </div>
        <div className="text-sm text-muted-foreground">{caption}</div>
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
      <span aria-hidden className="grid grid-cols-4 grid-rows-4 gap-1 opacity-40">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className={cellShade(i)} />
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
