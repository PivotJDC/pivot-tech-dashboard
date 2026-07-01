"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminFetch } from "@/components/admin/use-admin-fetch";
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  type AdminUser,
} from "@/lib/admin-api";
import { getAdminRole, getAdminUsername } from "@/lib/admin-auth";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";

const ROLE_OPTIONS = ["super_admin", "admin", "viewer"];

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
  // The logged-in admin's username, to disable self-targeted actions.
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => setMe(getAdminUsername()), []);

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
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-red-600">
                  {error}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No admin users yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.username === me} onChanged={reload} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  onChanged,
}: {
  user: AdminUser;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(role: string) {
    if (role === user.role) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminUser(user.id, { role });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update role.");
      setBusy(false);
    }
  }

  async function remove() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete admin user "${user.username}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAdminUser(user.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete user.");
      setBusy(false);
    }
  }

  return (
    <tr>
      <Td className="font-medium text-slate-900">{user.username}</Td>
      <Td>{user.email}</Td>
      <Td>
        <select
          value={user.role}
          disabled={isSelf || busy}
          onChange={(e) => changeRole(e.target.value)}
          aria-label={`Role for ${user.username}`}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Td>
      <Td className="text-slate-500">{formatDate(user.created_at)}</Td>
      <Td className="text-slate-500">{formatDate(user.last_login_at)}</Td>
      <Td>
        {isSelf ? (
          <span className="text-xs text-slate-400">You</span>
        ) : (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </button>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </Td>
    </tr>
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
