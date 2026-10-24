import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
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
      <body className="flex min-h-full flex-col md:flex-row">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-background focus:p-2"
        >
          Lewati ke konten
        </a>
        <aside className="shrink-0 border-b bg-sidebar p-4 text-sidebar-foreground md:w-56 md:border-r md:border-b-0">
          <p className="mb-4 px-3 text-base font-semibold">Framecipe</p>
          <AppNav />
        </aside>
        <main id="konten" className="min-w-0 flex-1 p-6">
          {children}
        </main>
      </body>
    </html>
  );
}
