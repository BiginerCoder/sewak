import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, authCookieOptions } from "@/lib/auth-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_SESSION_COOKIE, "", { ...authCookieOptions(), maxAge: 0 });
  return response;
}
