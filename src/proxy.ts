import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/invoices"];
const AUTH_PAGES = ["/auth/login", "/auth/register"];

/**
 * Refreshes the Supabase session and performs an optimistic redirect for
 * unauthenticated users. Real authorization (including admin role checks)
 * happens server-side in layouts, pages, actions and route handlers.
 */
export async function proxy(request: NextRequest) {
  const { response, userId, configured } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!configured) return response;

  if (!userId && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (userId && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/invoices/:path*", "/auth/:path*", "/api/:path((?!webhooks).*)"],
};
