"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Plus, Search, SearchX, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { KBD } from "@/components/app-nav";
import { cn } from "@/lib/utils";
import { NAV_LINKS, type NavLink } from "@/lib/nav";

type Entry = NavLink & { kind: "Halaman" | "Aksi" };

const ENTRIES: Entry[] = [
  ...NAV_LINKS.map((l) => ({ ...l, kind: "Halaman" as const })),
  { href: "/alur/baru", label: "Buat alur baru", icon: Plus, keywords: "tambah new recipe resep", kind: "Aksi" },
];

function match(query: string) {
  const q = query.trim().toLowerCase();
  return q ? ENTRIES.filter((e) => `${e.label} ${e.keywords}`.toLowerCase().includes(q)) : ENTRIES;
}

// Lives inside the popup, which unmounts on close, so every open starts with an empty query.
function Palette({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const results = match(query);
  const current = Math.min(cursor, results.length - 1);
  const optionId = (i: number) => `${listId}-${i}`;

  function go(entry: Entry) {
    onDone();
    router.push(entry.href);
  }

  function move(next: number) {
    setCursor(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); move((current + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move((current - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[current]); }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border/60 px-4">
        <Search aria-hidden className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={results.length ? optionId(current) : undefined}
          aria-label="Cari halaman atau aksi"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={onKeyDown}
          placeholder="Cari halaman atau aksi…"
          className="flex-1 bg-transparent py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className={cn(KBD, "hidden sm:inline-flex")}>Esc</kbd>
        <DialogClose
          aria-label="Tutup pencarian"
          className="rounded-md p-1 text-muted-foreground outline-none hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
        >
          <X aria-hidden className="size-[18px]" strokeWidth={1.5} />
        </DialogClose>
      </div>

      {results.length ? (
        <ul id={listId} role="listbox" aria-label="Hasil" className="max-h-[min(22rem,55vh)] overflow-y-auto p-2">
          {results.map((entry, i) => {
            const Icon = entry.icon;
            const selected = i === current;
            return (
              <li
                key={entry.href}
                id={optionId(i)}
                role="option"
                aria-selected={selected}
                onClick={() => go(entry)}
                onMouseMove={() => selected || setCursor(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-muted-foreground",
                  selected && "bg-black/5 text-foreground dark:bg-white/10",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1 truncate">{entry.label}</span>
                <span className="text-[11px] text-muted-foreground">{entry.kind}</span>
                <CornerDownLeft aria-hidden className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} strokeWidth={1.5} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div id={listId} role="status" className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-[13px] text-muted-foreground">
          <SearchX aria-hidden className="size-6" strokeWidth={1.5} />
          Tidak ada halaman atau aksi yang cocok.
        </div>
      )}

      <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">↑ ↓ untuk memilih · Enter untuk membuka · Esc untuk menutup</p>
    </>
  );
}

/** Ctrl+K / ⌘K palette: jump to any dashboard page or start a new recipe. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent
        showCloseButton={false}
        className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 shadow-2xl sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Cari halaman atau aksi</DialogTitle>
        {open && <Palette onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
