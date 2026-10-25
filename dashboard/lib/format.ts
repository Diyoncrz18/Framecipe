// "m:ss" for a length in seconds.
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// "12 B", "850 KB", "12,3 MB", "1,4 GB": a file size in id-ID style.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const [value, unit] = bytes >= 1024 ** 3 ? [bytes / 1024 ** 3, "GB"] : bytes >= 1024 ** 2 ? [bytes / 1024 ** 2, "MB"] : [bytes / 1024, "KB"];
  return `${value.toFixed(unit === "KB" ? 0 : 1).replace(".", ",")} ${unit}`;
}

// id-ID date (with the time when asked); "—" for a missing or unparsable value, never "Invalid Date".
export function formatDate(iso: string | null | undefined, withTime = false): string {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

// A step length in milliseconds: "250 ms", "4,2 dtk" under a minute, "m:ss" above.
export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1).replace(".", ",")} dtk`;
  return formatDuration(ms / 1000);
}
