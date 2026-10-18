import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";
import { safeAuthRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
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
          <h1>Neighbourhood change starts together.</h1>
          <p className="muted">Sign in to your resident account, or keep exploring as a guest.</p>
        </div>
      </div>
      <AuthForm mode="login" returnTo={returnTo} />
    </div>
  );
}
