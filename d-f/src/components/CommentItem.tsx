"use client";

import { useAuth } from "@/lib/auth-context";
import { deleteComment } from "@/app/actions";
import { Shield, ShieldCheck, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

type CommentData = {
  id: number;
  author: string;
  body: string;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  deletedReason: string | null;
  authorRole: string;
  authorBadge: string | null;
};

export function CommentItem({
  comment,
  timeAgoText,
}: {
  comment: CommentData;
  timeAgoText: string;
}) {
  const { isPartner, isAdmin, user } = useAuth();
  const [deleted, setDeleted] = useState(Boolean(comment.deletedAt));
  const [deletedBy, setDeletedBy] = useState(comment.deletedBy);
  const [deletedReason, setDeletedReason] = useState(comment.deletedReason);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reasonInput, setReasonInput] = useState("Unnecessary or misleading information");

  const handleDelete = async () => {
    try {
      setLoading(true);
      const res = await deleteComment(comment.id, reasonInput);
      if (res.ok) {
        setDeleted(true);
        setDeletedBy(`${user.name} (${user.role.toUpperCase()})`);
        setDeletedReason(reasonInput);
        setShowConfirm(false);
      } else {
        alert(res.error || "Failed to remove comment");
      }
    } catch (e) {
      console.error(e);
      alert("Error removing comment");
    } finally {
      setLoading(false);
    }
  };

  const isCommentPartner = comment.authorRole === "partner" || comment.authorRole === "admin";

  if (deleted) {
    return (
      <div
        className="comment-deleted"
        style={{
          padding: "10px 14px",
          background: "rgba(0, 0, 0, 0.03)",
          border: "1px dashed var(--border, #d1d5db)",
          borderRadius: "8px",
          fontSize: "12.5px",
          color: "var(--fg-muted, #6b7280)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontStyle: "italic",
        }}
      >
        <AlertTriangle size={15} style={{ opacity: 0.6 }} />
        <span>
          [Comment removed by {deletedBy || "a verified partner"} — {deletedReason || "Unnecessary or misleading"}]
        </span>
      </div>
    );
  }

  return (
    <div
      className="comment-item"
      style={{
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        padding: "8px 0",
        position: "relative",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isCommentPartner ? "rgba(16, 185, 129, 0.2)" : "rgba(14, 165, 233, 0.15)",
          color: isCommentPartner ? "#10b981" : "var(--accent, #0ea5e9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: "13px",
          flexShrink: 0,
        }}
      >
        {isCommentPartner ? <ShieldCheck size={18} /> : comment.author.charAt(0)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
          <b style={{ fontSize: "13px", color: "var(--fg, #111827)" }}>{comment.author}</b>

          {comment.authorBadge ? (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                background: "#10b981",
                color: "#ffffff",
                padding: "1px 6px",
                borderRadius: "4px",
                textTransform: "uppercase",
              }}
            >
              {comment.authorBadge}
            </span>
          ) : isCommentPartner ? (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                background: "rgba(16, 185, 129, 0.2)",
                color: "#065f46",
                padding: "1px 6px",
                borderRadius: "4px",
              }}
            >
              Verified Partner
            </span>
          ) : null}

          <span className="small muted" style={{ fontSize: "11px" }}>· {timeAgoText}</span>
        </div>

        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.45", color: "var(--fg, #1f2937)", wordBreak: "break-word" }}>
          {comment.body}
        </p>

        {showConfirm ? (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#991b1b" }}>
              Remove this comment as Verified Partner / Admin?
            </div>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Reason for removal"
              style={{
                fontSize: "12px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
              }}
            />
            <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
              <button
                type="button"
                disabled={loading}
                onClick={handleDelete}
                className="btn btn-sm"
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "11px",
                  padding: "4px 10px",
                }}
              >
                {loading ? "Removing…" : "Confirm Remove"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "11px", padding: "4px 8px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          (isPartner || isAdmin) && (
            <div style={{ marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontSize: "11px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: 0,
                  opacity: 0.8,
                }}
                title="Moderation action: remove comment"
              >
                <Trash2 size={12} />
                <span>Remove comment</span>
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
