import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const AUTH_SECRET = process.env.AUTH_SECRET || "sewak-super-secure-production-auth-secret-key-32chars";
const COOKIE_NAME = "sewak_session";

export type SessionPayload = {
  id: number;
  name: string;
  email: string;
  role: "citizen" | "partner" | "admin";
  partnerOrganization: string | null;
  partnerBadge: string | null;
  isVerified: boolean;
  exp: number;
};

/**
 * Hash password using standard scrypt (format: scrypt$salt$hash)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 67108864 });
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Verify password against stored scrypt hash
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const originalKeyHex = parts[2];
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 67108864 });
  const keyBuffer = Buffer.from(derivedKey.toString("hex"), "hex");
  const originalBuffer = Buffer.from(originalKeyHex, "hex");
  if (keyBuffer.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, originalBuffer);
}

/**
 * Create HMAC-signed session token
 */
export function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verify HMAC-signed session token
 */
export function verifyToken(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return null;
    const expectedSignature = crypto.createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get current authenticated user from session cookie
 */
export async function getSessionUser(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
      const verified = verifyToken(token);
      if (verified) return verified;
    }

    // Fallback: Check if demo role cookie is present for initial quick-start
    const demoRole = cookieStore.get("sewak_user_role")?.value as "citizen" | "partner" | "admin" | undefined;
    if (demoRole) {
      const [u] = await db.select().from(users).where(eq(users.role, demoRole)).limit(1);
      if (u) {
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role as "citizen" | "partner" | "admin",
          partnerOrganization: u.partnerOrganization,
          partnerBadge: u.partnerBadge,
          isVerified: u.isVerified,
          exp: Date.now() + 7 * 24 * 3600 * 1000,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set session cookie
 */
export async function setSessionCookie(payload: SessionPayload) {
  const token = signToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 3600, // 7 days
  });

  // Client-readable sync cookies for UI state
  cookieStore.set("sewak_user_role", payload.role, { path: "/", maxAge: 7 * 24 * 3600, sameSite: "lax" });
  cookieStore.set("sewak_user_name", encodeURIComponent(payload.name), { path: "/", maxAge: 7 * 24 * 3600, sameSite: "lax" });
  cookieStore.set("sewak_user_badge", encodeURIComponent(payload.partnerBadge || ""), { path: "/", maxAge: 7 * 24 * 3600, sameSite: "lax" });
  cookieStore.set("sewak_user_id", String(payload.id), { path: "/", maxAge: 7 * 24 * 3600, sameSite: "lax" });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  cookieStore.delete("sewak_user_role");
  cookieStore.delete("sewak_user_name");
  cookieStore.delete("sewak_user_badge");
  cookieStore.delete("sewak_user_id");
}
