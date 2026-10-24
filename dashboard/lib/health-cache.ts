import { checkHealth, type Health } from "@/core/health.mjs";
import { ROOT } from "@/lib/root";

const TTL_MS = 30_000;
let cached: { at: number; health: Health } | null = null;

// Beranda refreshes every 2 s during a live run, and checkHealth spawns npm, uv and claude (~0.7 s): reuse the result for 30 s.
export function cachedHealth(): Health {
  const now = Date.now();
  if (!cached || now - cached.at >= TTL_MS) cached = { at: now, health: checkHealth(ROOT) };
  return cached.health;
}
