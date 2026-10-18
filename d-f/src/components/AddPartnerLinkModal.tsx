"use client";

import { useAuth } from "@/lib/auth-context";
import { govlinks, GovlinksCategory, GovlinksWard } from "@/lib/govlinks";
import { ShieldCheck, Plus, X, ExternalLink, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export function AddPartnerLinkModal({
  wards,
  currentWardId,
  onLinkAdded,
}: {
  wards: GovlinksWard[];
  currentWardId?: number;
  onLinkAdded: () => void;
}) {
  const { user, isPartner } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<GovlinksCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState<number>(1);
  const [partnerNote, setPartnerNote] = useState("");
  const [steps, setSteps] = useState("");
  const [scopeWardId, setScopeWardId] = useState<number | undefined>(currentWardId);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    setSuccess(false);
    setError("");
    if (!categoriesLoaded) {
      try {
        const cats = await govlinks.categories();
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].category_id);
        setCategoriesLoaded(true);
      } catch (e) {
        console.error("Failed to load categories", e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !categoryId) {
      setError("Please fill in Title, URL, and Category.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await govlinks.createPartnerLink({
        title: title.trim(),
        url: url.trim(),
        category_id: categoryId,
        partner_id: user.id || 2,
        partner_note: partnerNote.trim() || `Verified by ${user.name} (${user.partnerOrganization || "Verified Partner"})`,
        steps: steps.trim() || undefined,
        ward_id: scopeWardId,
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setTitle("");
          setUrl("");
          setPartnerNote("");
          setSteps("");
          setSuccess(false);
          onLinkAdded();
        }, 1200);
      } else {
        setError("Failed to publish partner link. Check URL format.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error publishing link";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isPartner) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="btn btn-primary"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#ffffff",
          fontWeight: 600,
          boxShadow: "0 4px 14px 0 rgba(16, 185, 129, 0.39)",
        }}
      >
        <ShieldCheck size={18} />
        <span>Add Verified Partner Link</span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
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
              borderRadius: "16px",
              maxWidth: "540px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(16, 185, 129, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#10b981",
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Add Verified Service Link</h3>
                  <div style={{ fontSize: "12px", color: "var(--fg-muted, #6b7280)" }}>
                    Published as <b>{user.name}</b> ({user.partnerOrganization || "Verified Partner"})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--fg-muted, #6b7280)",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "16px",
                fontSize: "12px",
                color: "#065f46",
                lineHeight: "1.5",
              }}
            >
              ⭐ <b>Partner Privilege</b>: Links added by verified partners bypass candidate review and community voting. They are immediately promoted to <b>Big Highlighted Tabs</b> at the top of the area directory.
            </div>

            {error && (
              <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px", borderRadius: "8px", marginBottom: "14px", fontSize: "13px" }}>
                {error}
              </div>
            )}

            {success ? (
              <div style={{ textAlign: "center", padding: "30px 0" }}>
                <CheckCircle2 size={48} style={{ color: "#10b981", margin: "0 auto 12px" }} />
                <h4 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Partner Link Published!</h4>
                <p style={{ margin: "6px 0 0", color: "var(--fg-muted, #6b7280)", fontSize: "13px" }}>
                  The link is now featured with a Big Highlighted Tab for residents.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Service Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jaipur MC Quick Water Pipeline Redressal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #d1d5db)",
                      background: "var(--surface, #ffffff)",
                      color: "var(--fg, #111827)",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Official Government Portal URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://jaipurmc.org/online-services/water"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #d1d5db)",
                      background: "var(--surface, #ffffff)",
                      color: "var(--fg, #111827)",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                      Category *
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(Number(e.target.value))}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #d1d5db)",
                        background: "var(--surface, #ffffff)",
                        color: "var(--fg, #111827)",
                        fontSize: "14px",
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.category_id} value={c.category_id}>
                          {c.category_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                      Location Scope
                    </label>
                    <select
                      value={scopeWardId || ""}
                      onChange={(e) => setScopeWardId(e.target.value ? Number(e.target.value) : undefined)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #d1d5db)",
                        background: "var(--surface, #ffffff)",
                        color: "var(--fg, #111827)",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">All / City Wide</option>
                      {wards.map((w) => (
                        <option key={w.ward_id} value={w.ward_id}>
                          Ward {w.ward_number} ({w.ward_name || w.local_body})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Partner Verification Note / Endorsement
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified official department direct link; priority processing enabled."
                    value={partnerNote}
                    onChange={(e) => setPartnerNote(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #d1d5db)",
                      background: "var(--surface, #ffffff)",
                      color: "var(--fg, #111827)",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Step-by-Step Instructions for Residents (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. 1. Click Register Complaint. 2. Select Ward 24. 3. Enter your mobile OTP."
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, #d1d5db)",
                      background: "var(--surface, #ffffff)",
                      color: "var(--fg, #111827)",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                    style={{
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#ffffff",
                    }}
                  >
                    {loading ? "Publishing…" : "Publish Highlighted Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
