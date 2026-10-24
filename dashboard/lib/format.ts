// "m:ss" for a length in seconds.
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// id-ID date (with the time when asked); "—" for a missing or unparsable value, never "Invalid Date".
export function formatDate(iso: string | null | undefined, withTime = false): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
