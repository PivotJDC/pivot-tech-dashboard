"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import { listAdminUsers, createAdminUser } from "@/lib/admin-api";
import { getAdminRole } from "@/lib/admin-auth";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function UsersPage() {
  // Role is client-only; resolve after mount. `undefined` = still checking.
  const [role, setRole] = useState<string | null | undefined>(undefined);
  useEffect(() => setRole(getAdminRole()), []);

  if (role === undefined) return null;

  if (role !== "super_admin") {
    return (
      <div>
        <header className="mb-6">
          <h1 className="font-display text-2xl font-semibold">Admin Users</h1>
        </header>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Only super admins can manage admin users.
        </p>
      </div>
    );
  }

  return <UsersPanel />;
}

function UsersPanel() {
  const fetcher = useCallback(() => listAdminUsers(), []);
  const { data, loading, error, reload } = useAdminFetch(fetcher, []);
  const [showForm, setShowForm] = useState(false);

  const users = data?.users ?? [];

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Admin Users</h1>
          <p className="text-sm text-slate-500">{users.length} total</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          Add User
        </Button>
      </header>

      {showForm && (
        <AddUserForm
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th>Username</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Created</Th>
              <Th>Last login</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No admin users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium text-slate-900">{u.username}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <StatusBadge status={u.role} />
                  </Td>
                  <Td className="text-slate-500">{formatDate(u.created_at)}</Td>
                  <Td className="text-slate-500">{formatDate(u.last_login_at)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!username.trim() || !email.trim() || !password) {
      setError("Username, email, and password are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createAdminUser({
        username: username.trim(),
        email: email.trim(),
        password,
        role: userRole,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user.");
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        New admin user
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create user
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
