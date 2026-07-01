"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock, Signal, Loader2, Eye, EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAdminToken, saveAdminToken, saveAdminRole, saveAdminUsername,
} from "@/lib/admin-auth";
import { adminLogin } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already signed in → skip the gate.
  useEffect(() => {
    if (getAdminToken()) {
      router.replace("/admin/dashboard");
    } else {
      setChecking(false);
    }
  }, [router]);

  async function submit() {
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, role, username: name } = await adminLogin(username.trim(), password);
      saveAdminToken(token);
      saveAdminRole(role);
      saveAdminUsername(name);
      router.replace("/admin/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Sign in failed. Please try again.",
      );
      setBusy(false);
    }
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
            <Label htmlFor="username" className="text-slate-700">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="jim"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
