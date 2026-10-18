import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const returnTo = safeAuthRedirect(redirect);

  return (
    <div className="auth-layout">
      <div className="auth-intro">
        <span className="brand-mark auth-brand-mark" aria-hidden>CN</span>
        <div>
          <p className="eyebrow">Civic Network</p>
          <h1>Make your voice part of the neighbourhood.</h1>
          <p className="muted">Create a resident account to join the community. Guest browsing remains available.</p>
        </div>
      </div>
      <AuthForm mode="signup" returnTo={returnTo} />
    </div>
  );
}
