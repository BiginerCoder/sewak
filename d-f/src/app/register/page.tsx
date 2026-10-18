"use client";

import { useAuth, UserRole } from "@/lib/auth-context";
import { UserPlus, ArrowRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("citizen");
  const [partnerOrg, setPartnerOrg] = useState("");
  const [partnerBadge, setPartnerBadge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await register({
      name,
      email,
      password,
      role,
      partnerOrganization: role === "partner" ? partnerOrg : undefined,
      partnerBadge: role === "partner" ? partnerBadge : undefined,
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
    } else {
      setError(res.error || "Registration failed");
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "40px auto", padding: "0 16px" }}>
      <div className="card" style={{ padding: "32px", borderRadius: "16px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <UserPlus size={26} />
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Create Genuine Account</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
            Join Civic Network as a local resident or verified partner.
          </p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              Email Address *
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
              Password * (min 6 characters)
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

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
              Account Type / Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #d1d5db)",
                background: "var(--surface, #ffffff)",
                fontSize: "14px",
              }}
            >
              <option value="citizen">Resident (Citizen)</option>
              <option value="partner">Verified Partner (Authority / Department / NGO)</option>
            </select>
          </div>

          {role === "partner" && (
            <div style={{ padding: "14px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "10px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>
                  Partner Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Municipal Corporation, Water Board, or Action NGO"
                  value={partnerOrg}
                  onChange={(e) => setPartnerOrg(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>
                  Official Badge / Designation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ward Nodal Officer, Community Lead"
                  value={partnerBadge}
                  onChange={(e) => setPartnerBadge(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              padding: "12px",
              fontWeight: 700,
              fontSize: "14px",
              marginTop: "6px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            }}
          >
            {loading ? "Creating Account…" : "Register & Sign In"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ fontWeight: 600, color: "var(--accent, #0ea5e9)" }}>
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
