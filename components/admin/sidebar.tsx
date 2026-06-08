"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Hash,
  ArrowLeftRight,
  LogOut,
  Signal,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { clearAdminToken } from "@/lib/admin-auth";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
  { href: "/admin/dids", label: "DIDs", icon: Hash },
  { href: "/admin/ports", label: "Ports", icon: ArrowLeftRight },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearAdminToken();
    router.replace("/admin");
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 px-5 py-5">
        <Signal className="h-5 w-5 text-amber-400" />
        <span className="font-display text-lg font-semibold">Pivot-Tech</span>
        <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Ops
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          // Highlight the active section, including nested routes like
          // /admin/accounts/[id].
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={logout}
        className="m-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
