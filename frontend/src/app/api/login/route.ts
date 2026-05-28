import { NextResponse } from "next/server";
import { env } from "@/env";

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

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = (body.password ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  if (password !== expected) {
    return NextResponse.json(
      { error: "Incorrect password." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: expected,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}
