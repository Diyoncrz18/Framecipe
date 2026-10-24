import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

// Pages read the repo filesystem and refresh every 2 s, so nothing is prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Framecipe",
  description: "Studio video dan motion graphic AI berbasis resep, berjalan lokal bersama Claude Code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-2 focus:shadow-md"
        >
          Lewati ke konten
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
