"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
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
import { ApiError, getAccountStatus, type AccountStatus } from "@/lib/api";
import { getAccount } from "@/lib/session";

const POLL_MS = 10_000;

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
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve the account id from ?id= or the saved account.
  useEffect(() => {
    setAccountId(params.get("id") ?? getAccount()?.id ?? null);
  }, [params]);

  const poll = useCallback(async (id: string) => {
    try {
      const next = await getAccountStatus(id);
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't refresh status. Retrying…",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    poll(accountId);
    timer.current = setInterval(() => poll(accountId), POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [accountId, poll]);

  return (
    <main className="brand-dark min-h-dvh">
      <div className="container max-w-lg py-12">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Account status
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {accountId
            ? "This page updates automatically every 10 seconds."
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
          <ActivationCard status={status} />
          {status?.port && <PortCard port={status.port} />}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Auto-refreshing every 10s
            </span>
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

function ActivationCard({ status }: { status: AccountStatus | null }) {
  const key = status?.status ?? "pending";
  const copy = ACTIVATION_COPY[key] ?? ACTIVATION_COPY.pending;
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
