"use client";

import { useAuth, UserRole } from "@/lib/auth-context";
import { adminUpdateUserRole } from "@/app/actions";
import { Shield, ShieldCheck, User, Users, AlertTriangle, FileText, CheckCircle2, Sliders, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type DbUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  partnerOrganization: string | null;
  partnerBadge: string | null;
  isVerified: boolean;
  createdAt: Date;
};

type ModerationLogs = {
  removedComments: {
    id: number;
    issueId: number;
    author: string;
    body: string;
    deletedAt: Date | null;
    deletedBy: string | null;
    deletedReason: string | null;
  }[];
  moderatedIssues: {
    id: number;
    title: string;
    status: string;
    moderatedBy: string | null;
    moderatedReason: string | null;
    updatedAt: Date;
  }[];
};

export function AdminClient({
  initialUsers,
  logs,
}: {
  initialUsers: DbUser[];
  logs: ModerationLogs;
}) {
  const { user, isAdmin, role, switchRole } = useAuth();
  const [tab, setTab] = useState<"users" | "moderation" | "partner_rules">("users");
  const [usersList, setUsersList] = useState(initialUsers);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("partner");
  const [editOrg, setEditOrg] = useState("");
  const [editBadge, setEditBadge] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  const handleStartEdit = (u: DbUser) => {
    setEditingUserId(u.id);
    setEditRole((u.role as UserRole) || "citizen");
    setEditOrg(u.partnerOrganization || "");
    setEditBadge(u.partnerBadge || "");
  };

  const handleSaveRole = async (userId: number) => {
    try {
      setLoading(true);
      const res = await adminUpdateUserRole(userId, editRole, editOrg, editBadge);
      if (res.ok) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  role: editRole,
                  partnerOrganization: editOrg || null,
                  partnerBadge: editBadge || null,
                  isVerified: editRole === "partner" || editRole === "admin",
                }
              : u
          )
        );
        setEditingUserId(null);
        setNotice("User role and permissions updated successfully.");
        setTimeout(() => setNotice(""), 3000);
      } else {
        alert(res.error || "Update failed");
      }
    } catch (e) {
      console.error(e);
      alert("Error updating user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-container" style={{ maxWidth: "1100px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(14, 165, 233, 0.08) 100%)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: "16px",
          padding: "24px 28px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "12px",
              background: "rgba(139, 92, 246, 0.2)",
              color: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={26} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>Admin & Control Center</h1>
              <span
                style={{
                  background: "#8b5cf6",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "6px",
                }}
              >
                Control User
              </span>
            </div>
            <p style={{ margin: "4px 0 0", color: "var(--fg-muted, #6b7280)", fontSize: "14px" }}>
              Manage users, assign Partner status, configure highlight privileges, and inspect moderation logs.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {!isAdmin && (
            <button
              type="button"
              onClick={() => switchRole("admin")}
              className="btn btn-primary"
              style={{ background: "#8b5cf6", color: "#fff", fontWeight: 600 }}
            >
              Switch to Super Admin Profile
            </button>
          )}
          <Link href="/services" className="btn btn-secondary">
            View Area Links
          </Link>
        </div>
      </div>

      {notice && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid #10b981",
            color: "#065f46",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{notice}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => setTab("users")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            background: "transparent",
            border: "none",
            borderBottom: tab === "users" ? "2px solid #8b5cf6" : "2px solid transparent",
            color: tab === "users" ? "#8b5cf6" : "var(--fg-muted, #6b7280)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Users size={16} />
          <span>Users & Role Assignment ({usersList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("moderation")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            background: "transparent",
            border: "none",
            borderBottom: tab === "moderation" ? "2px solid #8b5cf6" : "2px solid transparent",
            color: tab === "moderation" ? "#8b5cf6" : "var(--fg-muted, #6b7280)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertTriangle size={16} />
          <span>Moderation Audit Trail ({logs.removedComments.length + logs.moderatedIssues.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("partner_rules")}
          style={{
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: "14px",
            background: "transparent",
            border: "none",
            borderBottom: tab === "partner_rules" ? "2px solid #8b5cf6" : "2px solid transparent",
            color: tab === "partner_rules" ? "#8b5cf6" : "var(--fg-muted, #6b7280)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Sliders size={16} />
          <span>Partner Privileges & Highlight Rules</span>
        </button>
      </div>

      {/* Tab 1: Users & Role Assignment */}
      {tab === "users" && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>System Users & Verification</h2>
              <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
                Partners can publish links without voting and moderate unwanted comments/posts.
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13.5px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #e5e7eb)", color: "var(--fg-muted, #6b7280)" }}>
                  <th style={{ padding: "10px 12px" }}>User</th>
                  <th style={{ padding: "10px 12px" }}>Role</th>
                  <th style={{ padding: "10px 12px" }}>Partner Organization</th>
                  <th style={{ padding: "10px 12px" }}>Official Badge</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => {
                  const isEditing = editingUserId === u.id;
                  const isPartnerRow = u.role === "partner";
                  const isAdminRow = u.role === "admin";

                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border, #f3f4f6)" }}>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 600, color: "var(--fg, #111827)" }}>{u.name}</div>
                        <div style={{ fontSize: "12px", color: "var(--fg-muted, #6b7280)" }}>{u.email}</div>
                      </td>

                      <td style={{ padding: "12px" }}>
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "13px" }}
                          >
                            <option value="citizen">Citizen (Resident)</option>
                            <option value="partner">Partner (Verified)</option>
                            <option value="admin">Admin (Control User)</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              background: isAdminRow
                                ? "rgba(139, 92, 246, 0.15)"
                                : isPartnerRow
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(14, 165, 233, 0.15)",
                              color: isAdminRow ? "#8b5cf6" : isPartnerRow ? "#10b981" : "#0ea5e9",
                            }}
                          >
                            {u.role}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "12px" }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editOrg}
                            placeholder="e.g. Municipal Corporation"
                            onChange={(e) => setEditOrg(e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "100%" }}
                          />
                        ) : (
                          <span style={{ color: u.partnerOrganization ? "var(--fg, #111827)" : "var(--fg-muted, #9ca3af)" }}>
                            {u.partnerOrganization || "—"}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "12px" }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editBadge}
                            placeholder="e.g. Nodal Officer"
                            onChange={(e) => setEditBadge(e.target.value)}
                            style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "12px", width: "100%" }}
                          />
                        ) : (
                          <span style={{ color: u.partnerBadge ? "#10b981" : "var(--fg-muted, #9ca3af)", fontWeight: u.partnerBadge ? 600 : 400 }}>
                            {u.partnerBadge || "—"}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "12px" }}>
                        {u.isVerified ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#10b981", fontSize: "12px", fontWeight: 600 }}>
                            <ShieldCheck size={14} /> Verified
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-muted, #9ca3af)", fontSize: "12px" }}>Unverified</span>
                        )}
                      </td>

                      <td style={{ padding: "12px", textAlign: "right" }}>
                        {isEditing ? (
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleSaveRole(u.id)}
                              className="btn btn-sm btn-primary"
                              style={{ background: "#10b981", fontSize: "11px" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: "11px" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(u)}
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: "11px" }}
                          >
                            Edit Role
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Moderation Audit Trail */}
      {tab === "moderation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Removed Comments Log */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
              Removed Comments ({logs.removedComments.length})
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
              Audit log of comments removed by verified partners and admins.
            </p>

            {logs.removedComments.length === 0 ? (
              <div className="card empty">No comments have been removed yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {logs.removedComments.map((rc) => (
                  <div
                    key={rc.id}
                    style={{
                      padding: "12px 14px",
                      background: "rgba(239, 68, 68, 0.04)",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <div>
                        <b>Original Author:</b> {rc.author} (Case #{rc.issueId})
                      </div>
                      <span style={{ color: "#dc2626", fontWeight: 600, fontSize: "12px" }}>
                        Removed by: {rc.deletedBy}
                      </span>
                    </div>
                    <div style={{ color: "var(--fg, #111827)", margin: "4px 0", fontStyle: "italic" }}>
                      "{rc.body}"
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--fg-muted, #6b7280)" }}>
                      <b>Reason:</b> {rc.deletedReason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Moderated Posts Log */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>
              Moderated Posts & Issues ({logs.moderatedIssues.length})
            </h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--fg-muted, #6b7280)" }}>
              Civic cases hidden or marked resolved via partner moderation controls.
            </p>

            {logs.moderatedIssues.length === 0 ? (
              <div className="card empty">No posts have been moderated yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {logs.moderatedIssues.map((mi) => (
                  <div
                    key={mi.id}
                    style={{
                      padding: "12px 14px",
                      background: "rgba(139, 92, 246, 0.04)",
                      border: "1px solid rgba(139, 92, 246, 0.2)",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <Link href={`/cases/${mi.id}`} style={{ fontWeight: 700, color: "var(--fg, #111827)" }}>
                        {mi.title} (Case #{mi.id})
                      </Link>
                      <span style={{ fontWeight: 600, color: mi.status === "hidden" ? "#dc2626" : "#10b981" }}>
                        Status: {mi.status.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--fg-muted, #6b7280)" }}>
                      <b>Moderated by:</b> {mi.moderatedBy} · <b>Note:</b> {mi.moderatedReason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Partner Rules & Highlights Explanation */}
      {tab === "partner_rules" && (
        <div className="card" style={{ padding: "24px" }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 700 }}>
            How Partner Verification & Highlighted Tabs Work
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginTop: "16px" }}>
            <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#10b981", fontWeight: 700, marginBottom: "8px" }}>
                <ShieldCheck size={20} />
                <span>Instant Highlighting Without Voting</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "var(--fg, #1f2937)" }}>
                Standard user links require candidate status, multiple resident votes, and community usage signals before ranking. When a verified <b>Partner</b> adds an official link, it is immediately flagged as <code>is_partner_promoted = true</code> and given top-priority presentation as a <b>Big Highlighted Tab</b>.
              </p>
            </div>

            <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#8b5cf6", fontWeight: 700, marginBottom: "8px" }}>
                <AlertTriangle size={20} />
                <span>Comment & Post Clean-Up Powers</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "var(--fg, #1f2937)" }}>
                Verified Partners and Admins have moderation controls on every discussion comment and civic issue. Inappropriate, spam, or misleading comments can be removed with a reason recorded in the permanent audit trail.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
