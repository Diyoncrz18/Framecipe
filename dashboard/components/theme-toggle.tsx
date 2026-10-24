"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { DARK_QUERY, THEME_KEY } from "@/lib/theme";

type Theme = "system" | "light" | "dark";

const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "Sistem", light: "Terang", dark: "Gelap" };
const ICON = { system: Monitor, light: Sun, dark: Moon };

function read(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system"; // storage blocked: follow the system
  }
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const query = window.matchMedia(DARK_QUERY);
  const onSystem = () => read() === "system" && apply("system");
  query.addEventListener("change", onSystem);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener("change", onSystem);
  };
}

/** Cycles Sistem → Terang → Gelap and remembers the choice in this browser. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = ICON[theme];

  function cycle() {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // storage blocked: the choice lasts until the page reloads
    }
    apply(next);
    listeners.forEach((l) => l());
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${LABEL[theme]}. Ganti ke ${LABEL[next]}`}
      title={`Tema: ${LABEL[theme]}`}
      className={className}
    >
      <Icon aria-hidden className="size-[18px]" strokeWidth={1.5} />
    </button>
  );
}
