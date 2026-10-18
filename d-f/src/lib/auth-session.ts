import { cookies } from "next/headers";
import { getAuthProfile, type AuthProfile } from "@/lib/auth-profiles";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const AUTH_SESSION_COOKIE = "sewak_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
export const AUTH_SESSION_SHORT_AGE_SECONDS = 12 * 60 * 60;

export function authCookieOptions(remember = true) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(remember ? { maxAge: AUTH_SESSION_MAX_AGE_SECONDS } : {}),
  };
}

export function isInvalidFirebaseSessionError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  return [
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/session-cookie-expired",
    "auth/session-cookie-revoked",
    "auth/user-disabled",
    "auth/user-not-found",
  ].includes(code);
}

export async function getResidentProfile(): Promise<AuthProfile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  let decoded;
  try {
    decoded = await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch (error) {
    if (isInvalidFirebaseSessionError(error)) return null;
    throw error;
  }

  return getAuthProfile(decoded.uid);
}
