"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
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
import {
  ApiError, getAccountStatus, type Account, type AccountStatus,
} from "@/lib/api";
import { getAccount } from "@/lib/session";

// Poll every 5s while activation is in flight; we stop once the line is fully
// active AND the eSIM (bics) is provisioned.
const POLL_MS = 5_000;

/** True once the line is active and cellular data (eSIM) is provisioned. */
function isReady(status: AccountStatus | null): boolean {
  return status?.status === "active" && status?.bics_provisioned === true;
}

export default function StatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusView />
    </Suspense>
  );
}

function StatusView() {
  const params = useSearchParams();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve the account id from ?id= or the saved account. The saved account
  // (from signup) also carries the eSIM + dialer QR payloads we reveal once ready.
  useEffect(() => {
    const saved = getAccount();
    setAccount(saved);
    setAccountId(params.get("id") ?? saved?.id ?? null);
  }, [params]);

  const stopPolling = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const poll = useCallback(async (id: string) => {
    try {
      const next = await getAccountStatus(id);
      setStatus(next);
      setError(null);
      // Fully provisioned — stop polling; the QRs are shown and won't change.
      if (isReady(next)) stopPolling();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't refresh status. Retrying…",
      );
    } finally {
      setLoading(false);
    }
  }, [stopPolling]);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return undefined;
    }
    poll(accountId);
    timer.current = setInterval(() => poll(accountId), POLL_MS);
    return stopPolling;
  }, [accountId, poll, stopPolling]);

  const ready = isReady(status);
  // When the account is active but the eSIM isn't provisioned yet, keep showing
  // the "setting up" copy rather than a premature "all set".
  const displayKey = ready
    ? "active"
    : status?.status === "active"
      ? "pending"
      : status?.status ?? "pending";

  return (
    <main className="brand-dark min-h-dvh">
      <div className="container max-w-lg py-12">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Account status
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {accountId
            ? "This page updates automatically every 5 seconds."
            : "We couldn't find an account on this device."}
        </p>
      </div>

      {!accountId ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground">
              Start a signup to track your activation here.
            </p>
            <Button asChild>
              <Link href="/signup">Sign up — $25/mo</Link>
            </Button>
          </CardContent>
        </Card>
      ) : loading && !status ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your status…
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <ActivationCard statusKey={displayKey} />
          {/* Once the line is active AND the eSIM is provisioned, reveal the
              setup QRs so the customer can finish activating on their phone. */}
          {ready && <SetupCard account={account} phoneE164={status?.phone_e164} />}
          {status?.port && <PortCard port={status.port} />}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {ready ? (
              <span className="flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="h-3 w-3" />
                Activation complete
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Checking every 5s…
              </span>
            )}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

const ACTIVATION_COPY: Record<
  string,
  { title: string; description: string; tone: "ok" | "wait" | "bad" }
> = {
  active: {
    title: "Your line is active",
    description: "Talk, text & data are ready to go. Welcome to Pivot-Tech!",
    tone: "ok",
  },
  pending: {
    title: "Setting up your line",
    description:
      "We're provisioning your number and eSIM. This usually takes under a minute.",
    tone: "wait",
  },
  suspended: {
    title: "Your line is suspended",
    description: "Please contact support to restore service.",
    tone: "bad",
  },
  cancelled: {
    title: "Your line is cancelled",
    description: "This account is no longer active.",
    tone: "bad",
  },
};

function ActivationCard({ statusKey }: { statusKey: string }) {
  const copy = ACTIVATION_COPY[statusKey] ?? ACTIVATION_COPY.pending;
  const Icon =
    copy.tone === "ok" ? CheckCircle2 : copy.tone === "bad" ? XCircle : Clock;

  return (
    <Card
      className={cn(
        copy.tone === "ok" && "border-primary/40 bg-accent/40",
        copy.tone === "bad" && "border-destructive/40",
      )}
    >
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <Icon
          className={cn(
            "mt-0.5 h-7 w-7 shrink-0",
            copy.tone === "ok" && "text-primary",
            copy.tone === "wait" && "text-muted-foreground",
            copy.tone === "bad" && "text-destructive",
          )}
        />
        <div className="space-y-1">
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

/** +12085550100 → (208) 555-0100. */
function formatNumber(e164?: string): string {
  if (!e164) return "";
  const d = e164.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length !== 10) return e164;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}

/**
 * Setup QRs shown once the line is fully active + provisioned. The payloads come
 * from the account saved at signup: the eSIM LPA activation code (rendered to a
 * QR client-side) and the dialer provisioning QR (a self-contained data: URL).
 */
function SetupCard({
  account,
  phoneE164,
}: {
  account: Account | null;
  phoneE164?: string;
}) {
  const esimCode = account?.esim?.activationCode;
  const dialerQr = account?.provisioning?.qr_code_url;
  const number = formatNumber(phoneE164 ?? account?.phone_e164);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">Finish setting up your phone</CardTitle>
        <CardDescription>
          {number ? `Your number: ${number}` : "Scan these on your phone to activate."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {/* eSIM install QR */}
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold">1. Install eSIM</p>
          {esimCode ? (
            <div className="rounded-lg border bg-white p-3">
              <QRCodeSVG value={esimCode} size={150} aria-label="eSIM installation QR code" />
            </div>
          ) : (
            <QrPlaceholder note="eSIM is provisioning — check back shortly." />
          )}
          <p className="text-xs text-muted-foreground">
            Settings → Cellular → Add eSIM → Scan QR
          </p>
        </div>

        {/* Dialer provisioning QR */}
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-semibold">2. Activate your dialer</p>
          {dialerQr ? (
            // qr_code_url is a self-contained data: URL from the middleware.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dialerQr}
              alt="Dialer provisioning QR code"
              className="h-[168px] w-[168px] rounded-lg border bg-white p-2"
            />
          ) : (
            <QrPlaceholder note="Open the Pivot Mobility app, then refresh." />
          )}
          <p className="text-xs text-muted-foreground">
            Open the Pivot Mobility app, then scan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QrPlaceholder({ note }: { note: string }) {
  return (
    <div className="flex h-[168px] w-[168px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/40 p-4 text-center">
      <Info className="h-7 w-7 text-primary" />
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

const PORT_STEPS = ["submitted", "pending", "approved", "completed"];

const PORT_COPY: Record<string, string> = {
  submitted: "We've submitted your port request to your old carrier.",
  pending: "Your old carrier is processing the transfer.",
  approved: "Approved! Your number is moving to Pivot-Tech.",
  completed: "Your number has been ported. You're all set.",
  failed: "The port couldn't be completed.",
  cancelled: "This port request was cancelled.",
};

function PortCard({
  port,
}: {
  port: NonNullable<AccountStatus["port"]>;
}) {
  const failed = port.status === "failed" || port.status === "cancelled";
  const activeIdx = PORT_STEPS.indexOf(port.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Number transfer</CardTitle>
        <CardDescription>
          {PORT_COPY[port.status] ?? "Tracking your number transfer."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {failed ? (
          <p className="text-sm font-medium text-destructive">
            {port.failure_reason || "Please contact support for next steps."}
          </p>
        ) : (
          <ol className="space-y-2.5">
            {PORT_STEPS.map((label, i) => {
              const done = i < activeIdx || port.status === "completed";
              const active = i === activeIdx && port.status !== "completed";
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border text-xs",
                      done && "border-primary bg-primary text-primary-foreground",
                      active && "border-primary text-primary",
                      !done && !active && "border-border text-muted-foreground",
                    )}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "capitalize",
                      active && "font-semibold",
                      !done && !active && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
