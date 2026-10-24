import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAllowedHost } from "@/core/host-guard.mjs";

// Next 16 "proxy" (formerly middleware): runs before every page, route handler and server action.
// A request whose Host is not the local address is refused, so a page on another site cannot reach the dashboard by DNS rebinding.
export function proxy(request: NextRequest) {
  if (isAllowedHost(request.headers.get("host"))) return NextResponse.next();
  return new Response("Host tidak diizinkan", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
