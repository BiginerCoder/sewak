import { NextResponse } from "next/server";
import { upsertAuthProfile } from "@/lib/auth-profiles";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_MAX_AGE_SECONDS,
  AUTH_SESSION_SHORT_AGE_SECONDS,
  authCookieOptions,
  isInvalidFirebaseSessionError,
  getResidentProfile,
} from "@/lib/auth-session";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getResidentProfile();
    return NextResponse.json({
      user: user ? { email: user.email, displayName: user.displayName } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load the resident session:", error);
    return NextResponse.json({ error: "Account information is temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request is required." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "A valid sign-in request is required." }, { status: 400 });
  }

  const { idToken, displayName, remember } = body as {
    idToken?: unknown;
    displayName?: unknown;
    remember?: unknown;
  };
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) {
    return NextResponse.json({ error: "A valid Firebase sign-in token is required." }, { status: 400 });
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Your Firebase account must have an email address." }, { status: 400 });
    }

    const requestedName = typeof displayName === "string" ? displayName.trim() : "";
    const tokenName = typeof decoded.name === "string" ? decoded.name.trim() : "";
    const name = (requestedName || tokenName || email.split("@")[0]).slice(0, 100);
    if (!name) {
      return NextResponse.json({ error: "Enter your name to create a resident profile." }, { status: 400 });
    }

    const user = await upsertAuthProfile({ firebaseUid: decoded.uid, email, displayName: name });
    const sessionCookie = await getFirebaseAdminAuth().createSessionCookie(idToken, {
      expiresIn: (remember === false ? AUTH_SESSION_SHORT_AGE_SECONDS : AUTH_SESSION_MAX_AGE_SECONDS) * 1000,
    });

    const response = NextResponse.json({
      user: { email: user.email, displayName: user.displayName },
    }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AUTH_SESSION_COOKIE, sessionCookie, authCookieOptions(remember !== false));
    return response;
  } catch (error) {
    if (isInvalidFirebaseSessionError(error)) {
      return NextResponse.json({ error: "Your sign-in session expired. Please sign in again." }, { status: 401 });
    }
    console.error("Unable to establish the resident session:", error);
    return NextResponse.json({ error: "Unable to save your account right now. Please try again." }, { status: 500 });
  }
}
