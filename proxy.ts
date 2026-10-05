import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";
import { refreshSession } from "@/lib/db/proxy";
import { loginPath } from "@/lib/auth/redirect";

const intlMiddleware = createMiddleware(routing);
const ADMIN_PATH = new RegExp(`^/(${routing.locales.join("|")})/admin(/|$)`);

/**
 * Tamil-first: ignore the browser's Accept-Language (many Tamil readers use phones set to
 * English). A language the reader chose before is still remembered via the locale cookie.
 */
function withoutAcceptLanguage(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  headers.delete("accept-language");
  return new NextRequest(request, { headers });
}

export default async function proxy(request: NextRequest) {
  const response = intlMiddleware(withoutAcceptLanguage(request));
  const signedIn = await refreshSession(request, response);

  // Optimistic check only (JWT, no database). Pages and actions re-check roles server-side.
  const admin = request.nextUrl.pathname.match(ADMIN_PATH);
  if (admin && !signedIn) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(new URL(loginPath(admin[1], `${pathname}${search}`), request.url));
  }

  return response;
}

export const config = {
  // Everything except API routes, Next internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
