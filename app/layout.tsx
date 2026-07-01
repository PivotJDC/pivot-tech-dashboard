import type { Metadata, Viewport } from "next";
import { Sora, DM_Sans, JetBrains_Mono } from "next/font/google";

import "./globals.css";

// Brand type system (matches mobilitynet.io): Sora for display headings,
// DM Sans for body/UI, JetBrains Mono for code/mono.
const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dmsans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MobilityNet — $25/mo Unlimited",
  description:
    "Unlimited talk, text & data for $25/month. Powered by universal eSIM technology — works on any unlocked device.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0D1628",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${sora.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
