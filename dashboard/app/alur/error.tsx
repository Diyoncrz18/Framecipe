"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Backstop for what the flow pages and server actions cannot handle themselves: a duplicate on a stale page, or a folder
// that Windows will not move (EPERM/EBUSY) when archiving.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="flex max-w-prose flex-col gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><CircleAlert aria-hidden="true" className="size-6 shrink-0 text-destructive" />Terjadi masalah</h1>
      <p>Aksi pada alur tidak berhasil. Tidak ada file yang dihapus. Coba lagi, atau kembali ke daftar alur dan muat ulang halamannya.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => retry()}>Coba lagi</Button>
        <Link href="/alur" className="text-sm underline underline-offset-2">Kembali ke daftar alur</Link>
      </div>
    </div>
  );
}
