import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pivot-Tech Ops",
  robots: { index: false, follow: false },
};

/**
 * Admin base layout. Forces a white/slate surface distinct from the warm,
 * amber customer theme. The sidebar shell lives in (panel)/layout.tsx so the
 * /admin login page renders without it.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-white text-slate-900">{children}</div>
  );
}
