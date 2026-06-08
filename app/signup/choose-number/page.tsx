"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ApiError,
  createAccount,
  getAvailableNumbers,
  type AvailableNumber,
} from "@/lib/api";
import { getDraft, saveAccount } from "@/lib/session";
import { marketForAreaCode } from "@/lib/markets";

/** Format +12085550100 → (208) 555-0100 for display. */
function formatNumber(e164: string): string {
  const d = e164.replace(/\D/g, "");
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length !== 10) return e164;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}

export default function ChooseNumberPage() {
  const router = useRouter();
  const [areacode, setAreacode] = useState("");
  const [numbers, setNumbers] = useState<AvailableNumber[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: this step requires an in-flight signup draft (email + choice).
  useEffect(() => {
    if (!getDraft()) router.replace("/signup");
  }, [router]);

  async function search() {
    if (!/^\d{3}$/.test(areacode)) {
      setError("Enter a 3-digit area code.");
      return;
    }
    setError(null);
    setSelected(null);
    setSearching(true);
    try {
      const results = await getAvailableNumbers(areacode);
      // The API returns up to 50; render what we get.
      setNumbers(results.slice(0, 50));
    } catch (err) {
      setNumbers(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't load numbers. Please try again.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function confirm() {
    const draft = getDraft();
    if (!draft || !selected) return;
    setError(null);
    setSubmitting(true);
    try {
      const account = await createAccount({
        email: draft.email,
        market: marketForAreaCode(areacode),
        plan: draft.plan,
        service: "new",
        phone_e164: selected,
      });
      saveAccount(account);
      router.push("/onboarding");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reserve that number. Please try another.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="container flex min-h-dvh max-w-2xl flex-col py-10">
      <Button
        variant="ghost"
        size="sm"
        className="mb-6 self-start"
        onClick={() => router.push("/signup")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-primary">Step 2 of 2</p>
          <CardTitle>Choose your new number</CardTitle>
          <CardDescription>
            Enter an area code to see available numbers.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="areacode">Area code</Label>
            <div className="flex gap-3">
              <Input
                id="areacode"
                inputMode="numeric"
                maxLength={3}
                placeholder="208"
                value={areacode}
                onChange={(e) =>
                  setAreacode(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="max-w-[8rem]"
                autoFocus
              />
              <Button onClick={search} disabled={searching || areacode.length !== 3}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}

          {numbers !== null && (
            <div className="space-y-3">
              {numbers.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No numbers available in {areacode}. Try a nearby area code.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {numbers.length} available — tap one to select.
                  </p>
                  <div className="grid max-h-[22rem] grid-cols-2 gap-2 overflow-y-auto rounded-lg border bg-muted/30 p-2 sm:grid-cols-3">
                    {numbers.map((n) => {
                      const active = selected === n.e164;
                      return (
                        <button
                          key={n.e164}
                          type="button"
                          onClick={() => setSelected(n.e164)}
                          className={cn(
                            "rounded-md border-2 bg-card px-3 py-3 text-center text-sm font-medium tabular-nums transition-colors",
                            active
                              ? "border-primary text-primary"
                              : "border-transparent hover:border-border",
                          )}
                        >
                          {n.formatted}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!selected || submitting}
            onClick={confirm}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {selected
              ? `Continue with ${formatNumber(selected)}`
              : "Select a number to continue"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
