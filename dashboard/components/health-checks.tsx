import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { Health } from "@/core/health.mjs";

// Every check carries an icon and a text, never color alone (NFR-10). `warn` is for things that are optional or fixable later.
export function Mark({ ok, warn = false, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  const Icon = ok ? CircleCheck : warn ? CircleAlert : CircleX;
  const tone = ok ? "text-green-800" : warn ? "text-amber-900" : "text-red-900";
  return (
    <span className={`flex items-start gap-1.5 ${tone}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </span>
  );
}

// The list items Beranda and Pengaturan both show. Render inside a <ul>.
export function CoreChecks({ health: h }: { health: Health }) {
  return (
    <>
      <li><Mark ok>{`Node v${h.node}`}</Mark></li>
      <li><Mark ok={!!h.npm}>{h.npm ? `npm ${h.npm}` : "npm tidak ditemukan"}</Mark></li>
      <li><Mark ok={!!h.uv}>{h.uv ? `uv ${h.uv}` : "uv tidak ditemukan"}</Mark></li>
      <li><Mark ok={!!h.claude}>{h.claude ? `Claude ${h.claude}` : "Claude Code tidak ditemukan"}</Mark></li>
      <li><Mark ok={h.hooksInstalled}>{h.hooksInstalled ? "Hook Claude Code terpasang" : "Hook belum terpasang di .claude/settings.json"}</Mark></li>
      <li><Mark ok={h.commandInstalled}>{h.commandInstalled ? "Command /buat-video terpasang" : "Command /buat-video belum ada"}</Mark></li>
    </>
  );
}
