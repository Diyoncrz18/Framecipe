"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/alur", label: "Alur" },
  { href: "/video", label: "Video" },
  { href: "/eksekusi", label: "Eksekusi" },
  { href: "/referensi", label: "Referensi Desain" },
  { href: "/skill", label: "Skill & Tools" },
  { href: "/cara-kerja", label: "Cara Kerja" },
  { href: "/pengaturan", label: "Pengaturan" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigasi utama">
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ href, label }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
