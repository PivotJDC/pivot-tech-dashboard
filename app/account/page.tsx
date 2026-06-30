"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Info, LogOut, Smartphone, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/status-badge";
import { HistoryTable } from "@/components/history-table";
import {
  clearAccount, getAccount, saveAccount, setAddLine,
} from "@/lib/session";
import {
  getAccountStatus, getAccountHistory, type Account, type CallRecord, type MessageRecord,
} from "@/lib/api";
import { planById } from "@/lib/plans";
import { formatPhone } from "@/lib/format";

/**
 * Customer account page.
 *
 * Auth: this app has no server session — the created account (with its
 * provisioning links + eSIM payload) is stashed in sessionStorage at signup.
 * We gate on that payload's presence (same pattern as /onboarding and /status);
 * without it we bounce to /signup. Live status is refreshed from the middleware
 * via GET /v1/accounts/:id/status.
 */
export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);

  useEffect(() => {
    const a = getAccount();
    if (!a) {
      // No session — send returning customers to sign in (not re-signup).
      router.replace("/login");
      return;
    }
    setAccount(a);
    setReady(true);

    // Refresh status (account auto-activates after provisioning, so the stashed
    // copy may still read "pending"). Best-effort: ignore failures. Persist the
    // advanced status back to the stashed copy so other pages see it too.
    getAccountStatus(a.id)
      .then((s) => {
        setLiveStatus(s.status);
        if (s.status && s.status !== a.status) {
          const updated = { ...a, status: s.status };
          saveAccount(updated);
          setAccount(updated);
        }
      })
      .catch(() => {});

    // Call + message history (best-effort).
    getAccountHistory(a.id, { limit: 50 })
      .then((h) => {
        setCalls(h.calls ?? []);
        setMessages(h.messages ?? []);
      })
      .catch(() => {});
  }, [router]);

  function addFamilyLine() {
    if (account?.email) setAddLine(account.email);
    router.push("/signup");
  }

  function logout() {
    clearAccount();
    router.replace("/login");
  }

  if (!ready || !account) return null;

  const status = liveStatus ?? account.status;
  const plan = planById(account.plan);
  const esim = account.esim;
  const dialerQr = account.provisioning?.qr_code_url;
  const addr = account.service_address;
  // Family lines: only a primary (no parent) with children gets the family card.
  const isPrimary = !account.parent_account_id;
  const lineCount = account.line_count ?? 0;

  return (
    <main className="container max-w-2xl py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Your account</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {account.email}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      {/* Number + plan summary. */}
      <Card className="mb-6 border-primary/30 bg-accent/40">
        <CardContent className="grid gap-6 py-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              Your number
            </span>
            <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
              {formatPhone(account.phone_e164) || "Pending"}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:items-end sm:text-right">
            <span className="text-sm font-medium text-muted-foreground">
              Your plan
            </span>
            <span className="font-display text-xl font-semibold text-foreground">
              {plan?.name ?? account.plan ?? "—"}
            </span>
            {plan && (
              <span className="text-sm text-muted-foreground">
                {plan.priceDisplay} · {plan.data}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {/* Your eSIM. */}
        <Section
          title="Your eSIM"
          subtitle="Scan with your phone's camera to install cellular data"
        >
          {esim?.activationCode ? (
            <div className="flex flex-col items-center gap-4">
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
            </div>
          ) : (
            <Pending message="eSIM provisioning is being processed. Check back shortly or contact support." />
          )}
        </Section>

        {/* Your dialer. */}
        <Section
          title="Your Dialer"
          subtitle="Open the Pivot Mobility app, then scan this code to activate calling."
        >
          {dialerQr ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-3">
              {/* qr_code_url is a self-contained data: URL from the middleware. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dialerQr}
                alt="Dialer provisioning QR code"
                className="h-44 w-44"
              />
            </div>
          ) : (
            <Pending message="Your dialer QR isn't ready yet. Refresh in a moment." />
          )}
        </Section>

        {/* Family lines (primary accounts only). */}
        {isPrimary && (
          <Section
            title="Family lines"
            subtitle={
              lineCount > 0
                ? `You have ${lineCount} additional line${lineCount === 1 ? "" : "s"} on this account.`
                : "Add lines for family members under this account."
            }
          >
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              {lineCount > 0 && (
                <div className="flex w-full items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-left">
                  <Users className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {lineCount} family{" "}
                    {lineCount === 1 ? "line" : "lines"} linked to this account.
                  </span>
                </div>
              )}
              <Button className="w-full" onClick={addFamilyLine}>
                <Smartphone className="h-4 w-4" />
                Add a Family Line
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Section>
        )}

        {/* Service address. */}
        {addr && (
          <Section title="Service address" subtitle="On file for E911 and billing.">
            <div className="w-full max-w-sm rounded-lg border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground">
              <p className="text-foreground">{addr.line1}</p>
              {addr.line2 && <p>{addr.line2}</p>}
              <p>
                {addr.city}, {addr.state} {addr.zip}
              </p>
            </div>
          </Section>
        )}

        {/* Call & message history. */}
        <Card>
          <CardContent className="space-y-4 py-6">
            <div className="text-center">
              <p className="font-semibold">Call &amp; Message History</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your recent calls and messages.
              </p>
            </div>
            <HistoryTable calls={calls} messages={messages} />
          </CardContent>
        </Card>
      </div>

      <Button asChild size="lg" variant="outline" className="mt-8 w-full">
        <Link href="/status">
          Check activation status
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </main>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-6 text-center">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Pending({ message }: { message: string }) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/40 px-5 py-8 text-center">
      <Info className="h-8 w-8 text-primary" />
      <p className="text-sm font-medium leading-snug">{message}</p>
    </div>
  );
}
