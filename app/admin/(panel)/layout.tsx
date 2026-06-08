"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminSidebar } from "@/components/admin/sidebar";
import { getAdminToken } from "@/lib/admin-auth";

/**
 * Authenticated admin shell: dark sidebar + white content. Guards every nested
 * page — without a stored token it redirects to the /admin login and renders
 * nothing (no protected content flash).
 */
export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (getAdminToken()) {
      setAuthed(true);
    } else {
      router.replace("/admin");
    }
  }, [router]);

  if (!authed) return null;

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <main className="flex-1 overflow-x-auto bg-slate-50 p-6 sm:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
