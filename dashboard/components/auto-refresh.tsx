"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the server component tree on an interval, but only while the tab is visible.
export function AutoRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
