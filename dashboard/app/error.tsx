"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Backstop for any page without its own error.tsx: the user gets a message and a way to try again, not a blank screen.
// `retry` (not `reset`) re-fetches the server data too, as the Next 16 docs recommend; the alur and eksekusi boundaries do the same.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="flex max-w-prose flex-col gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><CircleAlert aria-hidden="true" className="size-6 shrink-0 text-destructive" />Terjadi masalah</h1>
      <p>Halaman ini tidak bisa ditampilkan. Data Anda tidak diubah atau dihapus. Coba lagi, atau kembali ke Beranda.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => retry()}>Coba lagi</Button>
        <Link href="/" className="text-sm underline underline-offset-2">Kembali ke Beranda</Link>
      </div>
    </div>
  );
}
