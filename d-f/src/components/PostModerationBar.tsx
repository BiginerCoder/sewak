"use client";

import { useAuth } from "@/lib/auth-context";
import { moderateIssue } from "@/app/actions";
import { ShieldCheck, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";

export function PostModerationBar({
  issueId,
  currentStatus,
}: {
  issueId: number;
  currentStatus?: string;
}) {
  const { isPartner, isAdmin, user } = useAuth();
  const [status, setStatus] = useState(currentStatus || "active");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!isPartner && !isAdmin) return null;

  const handleAction = async (action: "hide" | "resolve" | "flag", label: string) => {
    if (!confirm(`Are you sure you want to ${label} this civic post as a verified partner/admin?`)) return;
    try {
      setLoading(true);
      const res = await moderateIssue(issueId, action);
      if (res.ok) {
        setStatus(action === "hide" ? "hidden" : action === "resolve" ? "resolved" : "under_review");
        setMessage(`Post status updated to ${action}.`);
        setTimeout(() => setMessage(""), 3000);
      } else {
        alert(res.error || "Action failed");
      }
    } catch (e) {
      console.error(e);
      alert("Error moderating post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="partner-post-moderation"
      style={{
        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%)",
        border: "1px solid rgba(16, 185, 129, 0.3)",
        borderRadius: "12px",
        padding: "12px 16px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <ShieldCheck size={18} style={{ color: "#10b981" }} />
        <div>
          <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#065f46" }}>
            Moderation Controls ({user.role.toUpperCase()})
          </span>
          <div style={{ fontSize: "11px", color: "var(--fg-muted, #6b7280)" }}>
            Current Status: <b>{status}</b> {message && `· ${message}`}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {status !== "resolved" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction("resolve", "mark as resolved")}
            className="btn btn-sm"
            style={{
              background: "#10b981",
              color: "#ffffff",
              fontSize: "12px",
              padding: "4px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <CheckCircle2 size={13} />
            <span>Mark Resolved</span>
          </button>
        )}

        {status !== "hidden" ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => handleAction("hide", "hide/archive")}
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: "12px",
              padding: "4px 10px",
              color: "#dc2626",
              borderColor: "rgba(220, 38, 38, 0.3)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <EyeOff size={13} />
            <span>Hide / Remove Post</span>
          </button>
        ) : (
          <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>[Hidden from public feed]</span>
        )}
      </div>
    </div>
  );
}
