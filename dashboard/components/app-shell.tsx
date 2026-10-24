"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { AppNav, KBD } from "@/components/app-nav";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { sectionOf } from "@/lib/nav";

const DESKTOP = "(min-width: 768px)";
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const ICON_BUTTON =
  "rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none dark:hover:bg-white/5";

/**
 * Sidebar + header + content. The sidebar collapses in place on desktop and slides in over the page on mobile;
 * the window keeps scrolling (sidebar and header are sticky) so Next's scroll-to-top on navigation still works.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDesktop = useSyncExternalStore(subscribe, () => window.matchMedia(DESKTOP).matches, () => true);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const sidebarVisible = isDesktop ? desktopOpen : mobileOpen;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      } else if (e.key === "Escape") {
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const section = sectionOf(pathname);
  const leaf = section && pathname !== section.href ? (pathname.endsWith("/baru") ? "Baru" : "Detail") : null;
  const openSearch = () => {
    setMobileOpen(false);
    setSearchOpen(true);
  };

  return (
    <div className="flex min-h-dvh">
      {mobileOpen && <div aria-hidden className="fixed inset-0 z-30 bg-black/20 md:hidden dark:bg-black/50" onClick={() => setMobileOpen(false)} />}

      <aside
        id="sidebar"
        aria-label="Sidebar"
        inert={!sidebarVisible}
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[260px] shrink-0 overflow-hidden border-r border-border/60 bg-card transition-[translate,width] duration-200 ease-out motion-reduce:transition-none",
          "md:sticky md:top-0 md:z-auto md:h-dvh md:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
          desktopOpen ? "md:w-[260px]" : "md:w-0 md:border-r-0",
        )}
      >
        <div className="h-full w-[260px] p-3">
          <AppNav onSearch={openSearch} onNavigate={() => setMobileOpen(false)} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-black/[0.02] dark:bg-white/[0.02]">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-card px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => (isDesktop ? setDesktopOpen((o) => !o) : setMobileOpen((o) => !o))}
              aria-label={sidebarVisible ? "Tutup sidebar" : "Buka sidebar"}
              aria-expanded={sidebarVisible}
              aria-controls="sidebar"
              className={ICON_BUTTON}
            >
              {sidebarVisible ? <PanelLeftClose aria-hidden className="size-[18px]" strokeWidth={1.5} /> : <PanelLeftOpen aria-hidden className="size-[18px]" strokeWidth={1.5} />}
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <li className="hidden sm:block">Framecipe</li>
                {section && (
                  <li className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="hidden sm:inline">/</span>
                    {leaf ? (
                      <Link href={section.href} className="truncate rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                        {section.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className="truncate font-medium text-foreground">{section.label}</span>
                    )}
                  </li>
                )}
                {leaf && (
                  <li className="flex items-center gap-2">
                    <span aria-hidden>/</span>
                    <span aria-current="page" className="font-medium text-foreground">{leaf}</span>
                  </li>
                )}
              </ol>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openSearch}
              className="hidden h-8 w-64 items-center gap-2 rounded-md bg-black/[0.04] px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-black/[0.07] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:flex dark:bg-white/5 dark:hover:bg-white/10"
            >
              <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1 truncate text-left">Cari halaman atau aksi…</span>
              <kbd className={KBD}>Ctrl K</kbd>
            </button>
            <button type="button" onClick={openSearch} aria-label="Cari halaman atau aksi" className={cn(ICON_BUTTON, "md:hidden")}>
              <Search aria-hidden className="size-[18px]" strokeWidth={1.5} />
            </button>
            <ThemeToggle className={ICON_BUTTON} />
          </div>
        </header>

        <main id="konten" tabIndex={-1} className="flex-1 p-6 outline-none md:p-8">
          {children}
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
