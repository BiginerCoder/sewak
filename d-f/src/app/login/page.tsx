"use client";

import { useAuth, UserRole } from "@/lib/auth-context";
import { LogIn, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuick = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      router.push("/");
    } else {
      setError(res.error || "Login failed");
    }
  };

  return (
    <div style={{ maxWidth: "440px", margin: "40px auto", padding: "0 16px" }}>
      <div className="card" style={{ padding: "32px", borderRadius: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(14, 165, 233, 0.15)",
              color: "var(--accent, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <LogIn size={26} />
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Sign In</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
            Enter your email and password to access Civic Network.
          </p>
        </div>

        {/* Quick fill */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--fg-muted, #6b7280)", marginBottom: "6px" }}>
            Quick Credentials:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <button
              type="button"
              onClick={() => handleQuick("meera@sewak.local", "password123")}
              style={{
                padding: "6px 8px",
                borderRadius: "8px",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                background: "rgba(14, 165, 233, 0.08)",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
                color: "#0369a1",
              }}
            >
              👤 Resident
            </button>
            <button
              type="button"
              onClick={() => handleQuick("partner.ward24@jaipurmc.org", "partner123")}
              style={{
                padding: "6px 8px",
                borderRadius: "8px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                background: "rgba(16, 185, 129, 0.08)",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
                color: "#047857",
              }}
            >
              🛡️ Partner
            </button>
            <button
              type="button"
              onClick={() => handleQuick("admin@sewak.local", "admin123")}
              style={{
                padding: "6px 8px",
                borderRadius: "8px",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                background: "rgba(139, 92, 246, 0.08)",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600,
                color: "#6d28d9",
              }}
            >
              ⚡ Admin
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #d1d5db)",
                background: "var(--surface, #ffffff)",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #d1d5db)",
                background: "var(--surface, #ffffff)",
                fontSize: "14px",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              padding: "12px",
              fontWeight: 700,
              fontSize: "14px",
              marginTop: "6px",
            }}
          >
            {loading ? "Authenticating…" : "Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
          Don't have an account?{" "}
          <Link href="/register" style={{ fontWeight: 600, color: "var(--accent, #0ea5e9)" }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
