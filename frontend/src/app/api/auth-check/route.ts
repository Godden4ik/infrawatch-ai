import { NextResponse } from "next/server";
import { env } from "@/env";
import { verifyAuthToken } from "@/lib/auth-token";

const COOKIE_NAME = "demo_auth";

/**
 * Auth-check endpoint for Caddy's forward_auth.
 *
 * Returns 200 if the request carries a valid `demo_auth` HMAC token,
 * 401 otherwise. Caddy forwards the original request's Cookie header
 * here on every upstream request; we just check it.
 *
 * When the gate is disabled (DEMO_PASSWORD unset) this endpoint
 * unconditionally returns 200 — same shape as the middleware.
 */
export async function GET(req: Request) {
  if (!env.DEMO_PASSWORD) {
    return new NextResponse(null, { status: 200 });
  }
  if (!env.SESSION_SECRET) {
    return new NextResponse(null, { status: 503 });
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
  );
  const token = match?.[1];

  if (await verifyAuthToken(token, env.SESSION_SECRET)) {
    return new NextResponse(null, { status: 200 });
  }
  return new NextResponse(null, { status: 401 });
}
