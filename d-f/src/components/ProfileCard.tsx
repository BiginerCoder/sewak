"use client";

import { useAuth } from "@/lib/auth-context";
import { Shield, ShieldCheck, User, LogIn, LogOut, KeyRound, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { AuthModal } from "./AuthModal";

export function ProfileCard() {
  const { user, role, logout, isAuthenticated } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"login" | "register">("login");

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isPartner = role === "partner";
  const isAdmin = role === "admin";

  return (
    <>
      <section
        className="card"
        style={{
          padding: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "18px",
          border: isPartner ? "2px solid #10b981" : isAdmin ? "2px solid #8b5cf6" : "1px solid var(--border, #e5e7eb)",
          background: isPartner
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(255, 255, 255, 0) 100%)"
            : isAdmin
            ? "linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(255, 255, 255, 0) 100%)"
            : "var(--surface, #ffffff)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <span
            className="avatar"
            style={{
              width: 64,
              height: 64,
              fontSize: 22,
              background: isPartner ? "rgba(16, 185, 129, 0.2)" : isAdmin ? "rgba(139, 92, 246, 0.2)" : "rgba(14, 165, 233, 0.15)",
              color: isPartner ? "#10b981" : isAdmin ? "#8b5cf6" : "var(--accent, #0ea5e9)",
              fontWeight: 800,
            }}
            aria-hidden
          >
            {initials}
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h2 className="section-title" style={{ margin: 0 }}>
                {user.name}
              </h2>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: isPartner ? "#10b981" : isAdmin ? "#8b5cf6" : "#0ea5e9",
                  color: "#ffffff",
                }}
              >
                {role}
              </span>
              {user.isVerified && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#10b981", fontWeight: 600 }}>
                  <ShieldCheck size={14} /> Verified Account
                </span>
              )}
            </div>
            <div className="small muted" style={{ marginTop: "4px" }}>
              <b>{user.email}</b>
              {user.partnerOrganization && ` · ${user.partnerOrganization}`}
              {user.partnerBadge && ` (${user.partnerBadge})`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => {
              setModalMode("login");
              setModalOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <KeyRound size={14} />
            <span>Switch / Sign In</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="btn btn-secondary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#dc2626" }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </section>

      <AuthModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialMode={modalMode}
      />
    </>
  );
}
