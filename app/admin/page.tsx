"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Signal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAdminToken,
  getConfiguredToken,
  saveAdminToken,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Already signed in → skip the gate.
  useEffect(() => {
    if (getAdminToken()) {
      router.replace("/admin/dashboard");
    } else {
      setChecking(false);
    }
  }, [router]);

  function submit() {
    if (!getConfiguredToken()) {
      setError("Admin access is not configured (NEXT_PUBLIC_ADMIN_TOKEN unset).");
      return;
    }
    if (!verifyAdminPassword(password)) {
      setError("Incorrect password.");
      return;
    }
    saveAdminToken(password);
    router.replace("/admin/dashboard");
  }

  if (checking) return null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
            <Signal className="h-6 w-6 text-amber-400" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Ops Console</h1>
          <p className="text-sm text-slate-500">Pivot-Tech internal tools</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button className="w-full" onClick={submit}>
            <Lock className="h-4 w-4" />
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
