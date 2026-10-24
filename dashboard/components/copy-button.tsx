"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed"); // permission denied or no clipboard API
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {state === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {label}
      </Button>
      <span aria-live="polite" className="sr-only">
        {state === "copied" ? "Tersalin" : state === "failed" ? "Gagal menyalin" : ""}
      </span>
    </>
  );
}
