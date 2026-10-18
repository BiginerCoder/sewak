"use client";

import { useState, type FormEvent } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { getFirebaseClientAuth, isFirebaseClientConfigured } from "@/lib/firebase-client";

type AuthFormProps = {
  mode: "login" | "signup";
  returnTo: string;
};

function firebaseErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email. Sign in instead.";
    case "auth/invalid-credential":
    case "auth/invalid-email":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "The email or password is incorrect.";
    case "auth/weak-password":
      return "Choose a password with at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a little and try again.";
    case "auth/network-request-failed":
      return "Could not reach Firebase. Check your connection and try again.";
    default:
      return error instanceof Error ? error.message : "Unable to complete sign-in.";
  }
}

export function AuthForm({ mode, returnTo }: AuthFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const isSignup = mode === "signup";
  const firebaseConfigured = isFirebaseClientConfigured();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (isSignup && name.length < 2) {
      setError("Enter your name (at least 2 characters).");
      return;
    }
    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (!firebaseConfigured) {
      setError("Firebase is not configured. Add the Firebase web-app settings to d-f/.env and restart the dev server.");
      return;
    }

    setBusy(true);
    try {
      const auth = getFirebaseClientAuth();
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const credential = isSignup
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);

      if (isSignup) await updateProfile(credential.user, { displayName: name });
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, remember, ...(isSignup ? { displayName: name } : {}) }),
      });
      const result = await response.json() as { error?: string; user?: { email: string; displayName: string } };
      if (!response.ok) {
        await auth.signOut();
        throw new Error(result.error || "Your account could not be connected to the resident database.");
      }

      window.dispatchEvent(new Event("sewak:auth-changed"));
      router.replace(returnTo);
      router.refresh();
    } catch (cause) {
      console.error("Resident authentication failed:", cause);
      setError(firebaseErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    const email = document.querySelector<HTMLInputElement>("#auth-email")?.value.trim().toLowerCase() ?? "";
    if (!email) {
      setError("Enter your email address first, then request a password reset.");
      setNotice("");
      return;
    }
    if (!firebaseConfigured) {
      setError("Firebase is not configured yet. Add the Firebase web-app settings to enable password recovery.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendPasswordResetEmail(getFirebaseClientAuth(), email);
      setNotice("If an account exists for this email, Firebase has sent a password-reset link.");
    } catch (cause) {
      console.error("Password-reset request failed:", cause);
      setError(firebaseErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card auth-card" aria-labelledby="auth-title">
      <div className="auth-card-heading">
        <span className="badge green plain">Resident account</span>
        <h2 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h2>
        <p className="small muted">
          {isSignup
            ? "Sign up to join your neighbourhood and keep your account details in one place."
            : "Sign in to your Civic Network account."}
        </p>
      </div>

      {!firebaseConfigured && (
        <p className="auth-error" role="status">
          Firebase is not configured yet. Add the Firebase web-app settings to d-f/.env and restart the app to enable accounts.
        </p>
      )}
      <form className="stack auth-form" onSubmit={submit}>
        {isSignup && (
          <div className="field">
            <label htmlFor="auth-name">Full name</label>
            <input
              className="input"
              id="auth-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            className="input"
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <div className="auth-password-wrap">
            <input
              className="input"
              id="auth-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
            </button>
          </div>
          {isSignup && <span className="hint">Use at least 8 characters.</span>}
        </div>
        {isSignup && (
          <div className="field">
            <label htmlFor="auth-confirm-password">Confirm password</label>
            <input
              className="input"
              id="auth-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
        )}
        {!isSignup && (
          <div className="auth-options">
            <label className="auth-check">
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember me on this device
            </label>
            <button className="btn btn-ghost btn-sm" type="button" onClick={sendPasswordReset} disabled={busy}>
              Forgot password?
            </button>
          </div>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-success" role="status">{notice}</p>}
        <button className="btn btn-primary btn-lg btn-block auth-submit" type="submit" disabled={busy || !firebaseConfigured}>
          {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>

      <div className="auth-switch small">
        {isSignup ? "Already have an account?" : "New to Civic Network?"}{" "}
        <Link
          className="link"
          href={`/${isSignup ? "login" : "signup"}?redirect=${encodeURIComponent(returnTo)}`}
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </div>
      <p className="auth-guest small muted">
        You can also <Link href="/" className="link">continue browsing as a guest</Link>.
      </p>
    </section>
  );
}
