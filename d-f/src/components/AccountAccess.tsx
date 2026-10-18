"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { LogIn, LogOut, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { initials } from "@/lib/constants";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";

type AccountAccessProps = { variant: "header" | "sidebar" };
type AccountState = "loading" | "guest" | "signed-in" | "unavailable";
type AccountProfile = { email: string; displayName: string };

export function AccountAccess({ variant }: AccountAccessProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AccountProfile | null>(null);
  const [state, setState] = useState<AccountState>("loading");
  const [busy, setBusy] = useState(false);
  const returnTo = pathname === "/login" || pathname === "/signup" ? "/" : pathname || "/";

  useEffect(() => {
    let active = true;
    async function refreshAccount() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) throw new Error("Account information is unavailable.");
        const { user: currentUser } = await response.json() as { user: AccountProfile | null };
        if (!active) return;
        setUser(currentUser);
        setState(currentUser ? "signed-in" : "guest");
      } catch {
        if (active) setState("unavailable");
      }
    }

    window.addEventListener("sewak:auth-changed", refreshAccount);
    void refreshAccount();
    return () => {
      active = false;
      window.removeEventListener("sewak:auth-changed", refreshAccount);
    };
  }, []);

  async function logOut() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out did not complete. Please try again.");
      if (isFirebaseClientConfigured()) {
        try {
          await signOut(getFirebaseClientAuth());
        } catch (error) {
          console.error("Firebase client sign-out failed after the server session was cleared:", error);
        }
      }
      setUser(null);
      setState("guest");
      window.dispatchEvent(new Event("sewak:auth-changed"));
      router.refresh();
    } catch (error) {
      console.error("Resident sign-out failed:", error);
      setState("unavailable");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return <span className="account-loading" aria-label="Checking account" />;
  }

  if (state === "unavailable") {
    return (
      <span className="account-unavailable" role="status">
        Account unavailable
      </span>
    );
  }

  if (state === "signed-in" && user) {
    if (variant === "sidebar") {
      return (
        <div className="account-sidebar">
          <Link href="/profile" className="resident-row" aria-label={`Profile: ${user.displayName}`}>
            <span className="avatar">{initials(user.displayName)}</span>
            <span className="resident-text">
              <b>{user.displayName}</b>
              <small>{user.email}</small>
            </span>
          </Link>
          <button className="btn btn-secondary btn-sm" type="button" onClick={logOut} disabled={busy}>
            <LogOut size={15} aria-hidden /> {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      );
    }
    return (
      <div className="account-header">
        <Link href="/profile" className="account-name" title={user.email}>
          <span className="avatar">{initials(user.displayName)}</span>
          <span>{user.displayName}</span>
        </Link>
        <button className="btn btn-secondary btn-sm account-signout" type="button" onClick={logOut} disabled={busy}>
          <LogOut size={15} aria-hidden />
          <span>{busy ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="account-sidebar">
        <Link href={`/login?redirect=${encodeURIComponent(returnTo)}`} className="resident-row">
          <span className="avatar"><LogIn size={16} aria-hidden /></span>
          <span className="resident-text">
            <b>Sign in</b>
            <small>Resident account</small>
          </span>
        </Link>
        <Link className="btn btn-primary btn-sm" href={`/signup?redirect=${encodeURIComponent(returnTo)}`}>
          <UserPlus size={15} aria-hidden /> Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="account-header">
      <Link className="btn btn-secondary btn-sm" href={`/login?redirect=${encodeURIComponent(returnTo)}`}>
        <LogIn size={15} aria-hidden /> <span>Sign in</span>
      </Link>
      <Link className="btn btn-primary btn-sm" href={`/signup?redirect=${encodeURIComponent(returnTo)}`}>
        <UserPlus size={15} aria-hidden /> <span>Sign up</span>
      </Link>
    </div>
  );
}
