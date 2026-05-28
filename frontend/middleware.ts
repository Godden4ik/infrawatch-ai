import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { verifyAuthToken } from "@/lib/auth-token";

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|api/login|api/logout|login|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)",
  ],
};

const COOKIE_NAME = "demo_auth";

export async function middleware(req: NextRequest) {
  const demoPassword = env.DEMO_PASSWORD;

  // Auth disabled when no password is set (local dev convenience).
  if (!demoPassword) {
    return NextResponse.next();
  }

  const secret = env.SESSION_SECRET;
  // If the server is misconfigured (DEMO_PASSWORD without SESSION_SECRET),
  // fail closed — redirect to /login. /api/login will surface the 503.
  if (secret) {
    const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
    if (await verifyAuthToken(cookieValue, secret)) {
      return NextResponse.next();
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}
