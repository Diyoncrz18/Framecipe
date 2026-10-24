"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_FOOTER, NAV_GROUPS, isActive, type NavLink } from "@/lib/nav";

const ROW =
  "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";
const IDLE = "text-muted-foreground hover:bg-black/5 hover:text-foreground";

export const KBD =
  "inline-flex h-5 items-center rounded-[4px] border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground";

function Item({ link, pathname, onNavigate }: { link: NavLink; pathname: string; onNavigate?: () => void }) {
  const active = isActive(link.href, pathname);
  const Icon = link.icon;
  return (
    <li>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(ROW, active ? "bg-black/5 font-medium text-foreground" : IDLE)}
      >
        <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.5} />
        <span className="truncate">{link.label}</span>
      </Link>
    </li>
  );
}

/** Sidebar content: brand, search, grouped pages, and settings pinned to the bottom. */
export function AppNav({ onSearch, onNavigate }: { onSearch: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-3 px-2 py-2">
        <div aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-semibold text-primary-foreground shadow-sm">
          F
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="mb-1 truncate text-[13px] leading-none font-medium">Framecipe</span>
          <span className="truncate text-[11px] leading-none text-muted-foreground">Studio video AI · lokal</span>
        </div>
      </div>

      <nav aria-label="Navigasi utama" className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none]">
          {NAV_GROUPS.map((group, i) => {
            const headingId = group.heading ? `nav-${group.heading.toLowerCase()}` : undefined;
            return (
              <div key={group.heading ?? i} className="flex flex-col gap-0.5">
                {group.heading && (
                  <span id={headingId} className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.heading}
                  </span>
                )}
                <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
                  {i === 0 && (
                    <li>
                      <button type="button" onClick={onSearch} className={cn(ROW, IDLE)}>
                        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.5} />
                        <span className="flex-1 text-left">Cari</span>
                        <kbd className={cn(KBD, "hidden group-hover:inline-flex group-focus-visible:inline-flex")}>Ctrl K</kbd>
                      </button>
                    </li>
                  )}
                  {group.items.map((link) => <Item key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} />)}
                </ul>
              </div>
            );
          })}
        </div>

        <ul className="mt-auto flex flex-col gap-0.5 border-t border-border/60 pt-3">
          {NAV_FOOTER.map((link) => <Item key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} />)}
        </ul>
      </nav>
    </div>
  );
}
