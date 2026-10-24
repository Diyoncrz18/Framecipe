"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Backstop for what the run pages and server actions cannot handle themselves, such as a run.json that Windows will not let the dashboard write (EPERM/EBUSY).
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div role="alert" className="flex max-w-prose flex-col gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-semibold"><CircleAlert aria-hidden="true" className="size-6 shrink-0 text-destructive" />Terjadi masalah</h1>
      <p>Halaman eksekusi tidak bisa ditampilkan atau aksinya tidak berhasil. Data run tidak diubah atau dihapus. Coba lagi, atau kembali ke daftar eksekusi.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => retry()}>Coba lagi</Button>
        <Link href="/eksekusi" className="text-sm underline underline-offset-2">Kembali ke daftar eksekusi</Link>
      </div>
    </div>
  );
}
