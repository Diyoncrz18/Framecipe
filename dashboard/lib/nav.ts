import { Activity, Blocks, BookOpen, Clapperboard, LayoutDashboard, Palette, Settings, Workflow, type LucideIcon } from "lucide-react";

export type NavLink = { href: string; label: string; icon: LucideIcon; keywords: string };
export type NavGroup = { heading?: string; items: NavLink[] };

// keywords: extra words the search palette matches, in both languages.
export const NAV_GROUPS: NavGroup[] = [
  { items: [{ href: "/", label: "Beranda", icon: LayoutDashboard, keywords: "home dashboard buat video prompt" }] },
  {
    heading: "Produksi",
    items: [
      { href: "/alur", label: "Alur", icon: Workflow, keywords: "resep recipe flow scene template" },
      { href: "/eksekusi", label: "Eksekusi", icon: Activity, keywords: "run proses status render execution" },
      { href: "/video", label: "Video", icon: Clapperboard, keywords: "galeri gallery hasil mp4" },
    ],
  },
  {
    heading: "Pustaka",
    items: [
      { href: "/referensi", label: "Referensi Desain", icon: Palette, keywords: "template brand contoh example transisi komponen" },
      { href: "/skill", label: "Skill & Tools", icon: Blocks, keywords: "skill tool command" },
      { href: "/cara-kerja", label: "Cara Kerja", icon: BookOpen, keywords: "panduan bantuan help pipeline how it works" },
    ],
  },
];

export const NAV_FOOTER: NavLink[] = [
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, keywords: "settings kesehatan health api key hook" },
];

export const NAV_LINKS: NavLink[] = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOTER];

export const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The nav entry a page belongs to, e.g. /eksekusi/a/b -> Eksekusi. */
export const sectionOf = (pathname: string) => NAV_LINKS.find((l) => isActive(l.href, pathname));
