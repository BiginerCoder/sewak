"use client";

import { useAuth, UserRole } from "@/lib/auth-context";
import { Shield, ShieldCheck, User, X, LogIn, UserPlus, KeyRound, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("citizen");
  const [partnerOrg, setPartnerOrg] = useState("");
  const [partnerBadge, setPartnerBadge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await login(email, password);
        if (res.ok) {
          setSuccessMsg("Signed in successfully!");
          setTimeout(() => {
            onClose();
          }, 800);
        } else {
          setError(res.error || "Invalid credentials.");
        }
      } else {
        const res = await register({
          name,
          email,
          password,
          role,
          partnerOrganization: role === "partner" ? partnerOrg : undefined,
          partnerBadge: role === "partner" ? partnerBadge : undefined,
        });
        if (res.ok) {
          setSuccessMsg("Account created and signed in!");
          setTimeout(() => {
            onClose();
          }, 800);
        } else {
          setError(res.error || "Registration failed.");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: "20px",
          maxWidth: "460px",
          width: "100%",
          padding: "28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--fg-muted, #6b7280)",
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(14, 165, 233, 0.12)",
              color: "var(--accent, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            {mode === "login" ? <LogIn size={26} /> : <UserPlus size={26} />}
          </div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800 }}>
            {mode === "login" ? "Sign In to Civic Network" : "Create Genuine Account"}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
            {mode === "login"
              ? "Access your reporting history, partner links & moderation tools."
              : "Register as a Resident or apply as a Verified Partner."}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px",
            background: "rgba(0,0,0,0.05)",
            padding: "4px",
            borderRadius: "10px",
            marginBottom: "18px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              background: mode === "login" ? "var(--surface, #ffffff)" : "transparent",
              color: mode === "login" ? "var(--fg, #111827)" : "var(--fg-muted, #6b7280)",
              cursor: "pointer",
              boxShadow: mode === "login" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            style={{
              padding: "8px",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 700,
              background: mode === "register" ? "var(--surface, #ffffff)" : "transparent",
              color: mode === "register" ? "var(--fg, #111827)" : "var(--fg-muted, #6b7280)",
              cursor: "pointer",
              boxShadow: mode === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            Register
          </button>
        </div>

        {/* Quick Demo Logins in Login mode */}
        {mode === "login" && (
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--fg-muted, #6b7280)", marginBottom: "6px" }}>
              Quick Credentials (Click to Fill):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
              <button
                type="button"
                onClick={() => handleQuickLogin("meera@sewak.local", "password123")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  border: "1px solid rgba(14, 165, 233, 0.3)",
                  background: "rgba(14, 165, 233, 0.08)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#0369a1",
                  textAlign: "center",
                }}
              >
                👤 Resident
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("partner.ward24@jaipurmc.org", "partner123")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  background: "rgba(16, 185, 129, 0.08)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#047857",
                  textAlign: "center",
                }}
              >
                🛡️ Partner
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("admin@sewak.local", "admin123")}
                style={{
                  padding: "6px 8px",
                  borderRadius: "8px",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  background: "rgba(139, 92, 246, 0.08)",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#6d28d9",
                  textAlign: "center",
                }}
              >
                ⚡ Admin
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ background: "#d1fae5", color: "#065f46", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
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
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border, #d1d5db)",
                  background: "var(--surface, #ffffff)",
                  fontSize: "14px",
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
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
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #d1d5db)",
                background: "var(--surface, #ffffff)",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
              Password *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border, #d1d5db)",
                background: "var(--surface, #ffffff)",
                fontSize: "14px",
              }}
            />
          </div>

          {mode === "register" && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 600, marginBottom: "4px" }}>
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid var(--border, #d1d5db)",
                    background: "var(--surface, #ffffff)",
                    fontSize: "14px",
                  }}
                >
                  <option value="citizen">Resident (Citizen)</option>
                  <option value="partner">Verified Partner (Authority / NGO)</option>
                </select>
              </div>

              {role === "partner" && (
                <div style={{ padding: "10px", background: "rgba(16, 185, 129, 0.08)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                  <div style={{ marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>
                      Partner Organization *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Municipal Corporation, Water Authority, or NGO"
                      value={partnerOrg}
                      onChange={(e) => setPartnerOrg(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "3px" }}>
                      Official Designation / Badge *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ward Nodal Officer, Community Lead"
                      value={partnerBadge}
                      onChange={(e) => setPartnerBadge(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              padding: "11px",
              marginTop: "8px",
              fontWeight: 700,
              fontSize: "14px",
              borderRadius: "10px",
            }}
          >
            {loading ? "Authenticating…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
