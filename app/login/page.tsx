"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendCode, verifyCode, ApiError } from "@/lib/api";
import { saveAccount, saveToken } from "@/lib/session";

type Step = "email" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    const value = email.trim();
    if (!value) {
      setError("Enter your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCode(value);
      setStep("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    const value = code.trim();
    if (value.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, account } = await verifyCode(email.trim(), value);
      saveToken(token);
      saveAccount(account);
      router.replace("/account");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That code is invalid or expired. Request a new one."
          : "Something went wrong. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="brand-dark min-h-dvh">
      <div className="container flex min-h-dvh max-w-md flex-col justify-center py-10">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-brand-cyan">Welcome back</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === "email"
            ? "We'll email you a 6-digit code — no password needed."
            : `Enter the code we sent to ${email}.`}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-6">
          {step === "email" ? (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className="pl-8"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && requestCode()}
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  className="pl-8 tracking-[0.4em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && submitCode()}
                  autoFocus
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          {step === "email" ? (
            <Button className="w-full" onClick={requestCode} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send code
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="space-y-2">
              <Button className="w-full" onClick={submitCode} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify &amp; sign in
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </div>
          )}
        </CardContent>
      </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to MobilityNet?{" "}
          <a href="/signup" className="font-medium text-brand-cyan underline-offset-4 hover:underline">
            Sign up
          </a>
        </p>
      </div>
    </main>
  );
}
