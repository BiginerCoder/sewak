"use client";
import { useAuth, UserRole } from "@/lib/auth-context";
import { Shield, ShieldCheck, User, Sparkles, Check, ChevronDown, LogIn, LogOut, UserPlus } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AuthModal } from "./AuthModal";

export function RoleSwitcher({ variant = "sidebar" }: { variant?: "sidebar" | "header" }) {
  const { user, role, switchRole, logout, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rolesConfig: {
    id: UserRole;
    label: string;
    sub: string;
    badge: string;
    icon: typeof User;
    color: string;
    bg: string;
  }[] = [
    {
      id: "citizen",
      label: "Meera Sharma",
      sub: "Citizen / Resident",
      badge: "Resident",
      icon: User,
      color: "var(--accent, #0ea5e9)",
      bg: "rgba(14, 165, 233, 0.12)",
    },
    {
      id: "partner",
      label: "Jaipur Ward 24 Officer",
      sub: "Jaipur Municipal Corporation",
      badge: "Verified Partner",
      icon: ShieldCheck,
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.15)",
    },
    {
      id: "admin",
      label: "Sewak Admin",
      sub: "Platform Operations",
      badge: "Control User",
      icon: Shield,
      color: "#8b5cf6",
      bg: "rgba(139, 92, 246, 0.15)",
    },
  ];

  const currentConfig = rolesConfig.find((r) => r.id === role) || rolesConfig[0];
  const Icon = currentConfig.icon;

  if (variant === "header") {
    return (
      <div className="relative inline-block" ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="role-chip-btn"
          aria-expanded={open}
          aria-haspopup="listbox"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 12px",
            borderRadius: "20px",
            border: `1px solid ${currentConfig.color}40`,
            background: currentConfig.bg,
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--fg, #1f2937)",
            transition: "all 0.2s ease",
          }}
        >
          <Icon size={14} style={{ color: currentConfig.color }} />
          <span>{currentConfig.badge}</span>
          <ChevronDown size={14} style={{ opacity: 0.7 }} />
        </button>

        {open && (
          <div
            className="role-dropdown"
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: "260px",
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: "12px",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
              padding: "6px",
              zIndex: 100,
            }}
          >
            <div style={{ padding: "8px 12px 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>
              Switch Active Role (Demo)
            </div>
            {rolesConfig.map((r) => {
              const RoleIcon = r.icon;
              const isSelected = r.id === role;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    switchRole(r.id);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: isSelected ? r.bg : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: `${r.color}20`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: r.color,
                      }}
                    >
                      <RoleIcon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg, #111827)" }}>{r.label}</div>
                      <div style={{ fontSize: "11px", color: "var(--fg-muted, #6b7280)" }}>{r.badge} · {r.sub}</div>
                    </div>
                  </div>
                  {isSelected && <Check size={16} style={{ color: r.color }} />}
                </button>
              );
            })}
            <div style={{ margin: "6px 0", borderTop: "1px solid var(--border, #e5e7eb)" }} />
            <button
              type="button"
              onClick={() => {
                setAuthModalMode("login");
                setAuthModalOpen(true);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--accent, #0ea5e9)",
              }}
            >
              <LogIn size={15} />
              <span>Sign in with password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalMode("register");
                setAuthModalOpen(true);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#10b981",
              }}
            >
              <UserPlus size={15} />
              <span>Register new account</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "12.5px",
                color: "#dc2626",
              }}
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        )}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
        />
      </div>
    );
  }

  // Sidebar variant
  return (
    <div className="role-switcher-sidebar" ref={ref} style={{ position: "relative", marginBottom: "8px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="role-sidebar-box"
        aria-expanded={open}
        aria-label="Switch User Role"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "10px 12px",
          borderRadius: "10px",
          border: `1px solid ${currentConfig.color}40`,
          background: currentConfig.bg,
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: `${currentConfig.color}25`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: currentConfig.color,
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </div>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg, #111827)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  background: currentConfig.color,
                  color: "#ffffff",
                  letterSpacing: "0.03em",
                }}
              >
                {currentConfig.badge}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown size={16} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "12px",
            boxShadow: "0 -10px 25px -5px rgba(0,0,0,0.15)",
            padding: "6px",
            zIndex: 100,
          }}
        >
          <div style={{ padding: "8px 10px 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>
            Select Active Profile
          </div>
          {rolesConfig.map((r) => {
            const RoleIcon = r.icon;
            const isSelected = r.id === role;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  switchRole(r.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "none",
                  background: isSelected ? r.bg : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <RoleIcon size={16} style={{ color: r.color }} />
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--fg, #111827)" }}>{r.label}</div>
                    <div style={{ fontSize: "10px", color: "var(--fg-muted, #6b7280)" }}>{r.badge}</div>
                  </div>
                </div>
                {isSelected && <Check size={14} style={{ color: r.color }} />}
              </button>
            );
          })}
          <div style={{ margin: "6px 0", borderTop: "1px solid var(--border, #e5e7eb)" }} />
          <button
            type="button"
            onClick={() => {
              setAuthModalMode("login");
              setAuthModalOpen(true);
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--accent, #0ea5e9)",
            }}
          >
            <LogIn size={14} />
            <span>Sign in with password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthModalMode("register");
              setAuthModalOpen(true);
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "#10b981",
            }}
          >
            <UserPlus size={14} />
            <span>Register new account</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "7px 10px",
              borderRadius: "8px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "12px",
              color: "#dc2626",
            }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      )}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
