import { NextResponse } from "next/server";
import { env } from "@/env";
import { issueAuthToken, timingSafeCompareHashed } from "@/lib/auth-token";
import { checkLoginRateLimit, clientIp } from "@/lib/rate-limit";

const COOKIE_NAME = "demo_auth";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

export async function POST(req: Request) {
  const expected = env.DEMO_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Auth not configured on server." },
      { status: 503 },
    );
  }

  const secret = env.SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Auth not configured: SESSION_SECRET missing. Generate with `openssl rand -hex 32` and set as env var.",
      },
      { status: 503 },
    );
  }

  // Brute-force throttle — keyed on the visitor's IP, 5 attempts / 15 min.
  const ip = clientIp(req);
  const limit = checkLoginRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = (body.password ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  // Length-independent compare: HMAC both inputs with the server secret
  // and compare the resulting equal-length digests. Neither the length
  // nor the prefix of the expected password leaks through timing.
  if (!(await timingSafeCompareHashed(password, expected, secret))) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 },
    );
  }

  const token = await issueAuthToken(secret);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}
