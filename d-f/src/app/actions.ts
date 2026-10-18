"use server";

import { db } from "@/db";
import { comments, confirmations, evidence, issues, timelineEvents, verifications, users } from "@/db/schema";
import { CATEGORIES, CIVIC_LOCATIONS, CURRENT_RESIDENT, REOPEN_THRESHOLD, VERIFY_THRESHOLD, categoryOf, stageOf } from "@/lib/constants";
import { ensureSeeded } from "@/lib/queries";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  getSessionUser,
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  type SessionPayload,
} from "@/lib/auth-server";

export type ActionResult = { ok: true; id?: number; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

const MAX_IMAGE_CHARS = 1_600_000;

function validImage(data: string | null | undefined) {
  if (!data) return null;
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(data) || data.length > MAX_IMAGE_CHARS) return undefined;
  return data;
}

function refresh() {
  revalidatePath("/", "layout");
}

export async function getAuthFromCookies() {
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      return {
        role: sessionUser.role,
        name: sessionUser.name,
        badge: sessionUser.partnerBadge || "",
        id: sessionUser.id,
        email: sessionUser.email,
        isPartner: sessionUser.role === "partner" || sessionUser.role === "admin",
        isAdmin: sessionUser.role === "admin",
      };
    }

    const cookieStore = await cookies();
    const role = (cookieStore.get("sewak_user_role")?.value || "citizen") as "citizen" | "partner" | "admin";
    const name = decodeURIComponent(cookieStore.get("sewak_user_name")?.value || CURRENT_RESIDENT);
    const badge = decodeURIComponent(cookieStore.get("sewak_user_badge")?.value || "");
    const id = Number(cookieStore.get("sewak_user_id")?.value) || 1;
    return {
      role,
      name,
      badge,
      id,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@sewak.local`,
      isPartner: role === "partner" || role === "admin",
      isAdmin: role === "admin",
    };
  } catch {
    return {
      role: "citizen" as const,
      name: CURRENT_RESIDENT,
      badge: "",
      id: 1,
      email: "meera@sewak.local",
      isPartner: false,
      isAdmin: false,
    };
  }
}

/* ---- Real Authentication: Log in ---- */
export async function loginAction(formData: {
  email: string;
  password: string;
}): Promise<ActionResult & { user?: SessionPayload }> {
  await ensureSeeded();
  const email = formData.email.trim().toLowerCase();
  const password = formData.password;
  if (!email || !password) return { ok: false, error: "Please enter both email and password." };

  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) {
    return { ok: false, error: "No account found with this email." };
  }

  if (!verifyPassword(password, u.passwordHash)) {
    return { ok: false, error: "Incorrect password. Please try again." };
  }

  const payload: SessionPayload = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "citizen" | "partner" | "admin",
    partnerOrganization: u.partnerOrganization,
    partnerBadge: u.partnerBadge,
    isVerified: u.isVerified,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  };

  await setSessionCookie(payload);
  refresh();
  return { ok: true, user: payload, message: `Welcome back, ${u.name}!` };
}

/* ---- Real Authentication: Register / Sign up ---- */
export async function registerAction(input: {
  name: string;
  email: string;
  password: string;
  role?: "citizen" | "partner" | "admin";
  partnerOrganization?: string;
  partnerBadge?: string;
}): Promise<ActionResult & { user?: SessionPayload }> {
  await ensureSeeded();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const role = input.role || "citizen";
  const partnerOrganization = input.partnerOrganization?.trim() || null;
  const partnerBadge = input.partnerBadge?.trim() || null;

  if (name.length < 2) return { ok: false, error: "Please enter your full name (minimum 2 characters)." };
  if (!email.includes("@") || email.length < 5) return { ok: false, error: "Please enter a valid email address." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters long." };

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Please sign in instead." };
  }

  const pHash = hashPassword(password);
  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: pHash,
      role,
      partnerOrganization,
      partnerBadge,
      isVerified: role === "citizen" || role === "partner",
    })
    .returning();

  const payload: SessionPayload = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role as "citizen" | "partner" | "admin",
    partnerOrganization: newUser.partnerOrganization,
    partnerBadge: newUser.partnerBadge,
    isVerified: newUser.isVerified,
    exp: Date.now() + 7 * 24 * 3600 * 1000,
  };

  await setSessionCookie(payload);
  refresh();
  return { ok: true, user: payload, message: `Account created! Welcome, ${newUser.name}.` };
}

/* ---- Real Authentication: Log out ---- */
export async function logoutAction(): Promise<ActionResult> {
  await clearSessionCookie();
  refresh();
  return { ok: true, message: "Logged out successfully." };
}

/* ---- Report a problem ---- */
export async function createIssue(input: {
  kind: string;
  title: string;
  category: string;
  description: string;
  locationId: string;
  location: string;
  simulated?: boolean;
  photo?: string | null;
}): Promise<ActionResult> {
  await ensureSeeded();
  const fields: Record<string, string> = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  const locationId = input.locationId;
  if (title.length < 8) fields.title = "Enter a short title of at least 8 characters.";
  if (title.length > 120) fields.title = "Keep the title under 120 characters.";
  if (!CATEGORIES.some((c) => c.id === input.category)) fields.category = "Choose a category.";
  if (description.length < 20) fields.description = "Describe the problem in at least 20 characters so neighbours and the authority understand it.";
  if (location.length < 3) fields.location = "Add a location or use GPS / search.";
  if (!CIVIC_LOCATIONS.some((item) => item.id === locationId) && !locationId.startsWith("pin-") && !locationId.startsWith("geo-") && !locationId.startsWith("gps-") && locationId.length < 2) {
    fields.location = "Choose a ward, neighbourhood or PIN code.";
  }
  const photo = validImage(input.photo);
  if (photo === undefined) fields.photo = "Photo must be a JPEG, PNG or WebP image under 1 MB after resizing.";
  if (Object.keys(fields).length) return { ok: false, error: "Please fix the highlighted fields.", fields };

  const auth = await getAuthFromCookies();
  const authorName = auth?.name || CURRENT_RESIDENT;
  const kind = input.kind === "information" ? "information" : "problem";
  const cat = categoryOf(input.category);
  const isSimulated = input.simulated === true;
  const [row] = await db
    .insert(issues)
    .values({
      kind,
      title,
      description,
      category: cat.id,
      stage: 1,
      author: authorName,
      locationId,
      locationText: location,
      locationSimulated: isSimulated,
      department: kind === "problem" ? cat.department : null,
      affectedCount: kind === "problem" ? 1 : 0,
    })
    .returning({ id: issues.id });

  if (kind === "problem") {
    await db.insert(timelineEvents).values({
      issueId: row.id, stage: 1, label: "Reported", note: "Problem posted.", actor: authorName, source: "resident",
    });
    await db.insert(confirmations).values({ issueId: row.id, resident: authorName });
  }
  if (photo) {
    await db.insert(evidence).values({ issueId: row.id, phase: "before", caption: "Photo added with the report", imageUrl: photo, addedBy: authorName });
  }
  refresh();
  return { ok: true, id: row.id };
}

/* ---- Community confirmation ("I'm affected too") ---- */
export async function confirmAffected(issueId: number): Promise<ActionResult> {
  const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
  if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
  const inserted = await db
    .insert(confirmations)
    .values({ issueId, resident: CURRENT_RESIDENT })
    .onConflictDoNothing()
    .returning({ id: confirmations.id });
  if (!inserted.length) return { ok: false, error: "You have already confirmed this problem." };

  const affected = issue.affectedCount + 1;
  let stage = issue.stage;
  if (stage === 1 && affected >= 3) {
    stage = 2;
    await db.insert(timelineEvents).values({
      issueId, stage: 2, label: "Community confirmed", note: "Three or more residents confirmed they are affected.", actor: "Community", source: "community",
    });
  }
  await db.update(issues).set({ affectedCount: affected, stage, updatedAt: new Date() }).where(eq(issues.id, issueId));
  refresh();
  return { ok: true };
}

/* ---- Discussion ---- */
export async function addComment(issueId: number, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (text.length < 2) return { ok: false, error: "Write a comment first." };
  if (text.length > 1000) return { ok: false, error: "Keep comments under 1000 characters." };
  const auth = await getAuthFromCookies();
  await db.insert(comments).values({
    issueId,
    author: auth.name,
    body: text,
    authorRole: auth.role,
    authorBadge: auth.badge || null,
  });
  refresh();
  return { ok: true };
}

/* ---- Partner & Admin Moderation: Remove Comment ---- */
export async function deleteComment(commentId: number, reason?: string): Promise<ActionResult> {
  const auth = await getAuthFromCookies();
  if (!auth.isPartner) {
    return { ok: false, error: "Only verified partners and admins can remove comments." };
  }

  await db
    .update(comments)
    .set({
      deletedAt: new Date(),
      deletedBy: `${auth.name} (${auth.role.toUpperCase()})`,
      deletedReason: reason?.trim() || "Removed by verified moderator as unnecessary or misleading",
    })
    .where(eq(comments.id, commentId));

  refresh();
  return { ok: true, message: "Comment removed." };
}

/* ---- Partner & Admin Moderation: Moderate Issue / Post ---- */
export async function moderateIssue(
  issueId: number,
  action: "hide" | "resolve" | "flag",
  reason?: string
): Promise<ActionResult> {
  const auth = await getAuthFromCookies();
  if (!auth.isPartner) {
    return { ok: false, error: "Only verified partners and admins can moderate posts." };
  }

  const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
  if (!issue) return { ok: false, error: "Post not found." };

  const newStatus = action === "hide" ? "hidden" : action === "resolve" ? "resolved" : "under_review";
  await db
    .update(issues)
    .set({
      status: newStatus,
      moderatedBy: `${auth.name} (${auth.role.toUpperCase()})`,
      moderatedReason: reason?.trim() || `Marked as ${newStatus} by verified partner`,
      updatedAt: new Date(),
    })
    .where(eq(issues.id, issueId));

  refresh();
  return { ok: true, message: `Post updated to ${newStatus}.` };
}

/* ---- Admin: Update User Role ---- */
export async function adminUpdateUserRole(
  userId: number,
  role: "citizen" | "partner" | "admin",
  organization?: string,
  badge?: string
): Promise<ActionResult> {
  const auth = await getAuthFromCookies();
  if (!auth.isAdmin) {
    return { ok: false, error: "Only administrators can modify user roles." };
  }

  await db
    .update(users)
    .set({
      role,
      partnerOrganization: organization || null,
      partnerBadge: badge || null,
      isVerified: role === "partner" || role === "admin",
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  refresh();
  return { ok: true };
}

/* ---- Evidence ---- */
export async function addEvidence(input: { issueId: number; phase: string; caption: string; photo?: string | null }): Promise<ActionResult> {
  const phase = ["before", "during", "after"].includes(input.phase) ? input.phase : null;
  const caption = input.caption.trim();
  const photo = validImage(input.photo);
  if (!phase) return { ok: false, error: "Choose before, during or after." };
  if (caption.length < 3) return { ok: false, error: "Add a short caption describing the evidence." };
  if (photo === undefined) return { ok: false, error: "Photo must be a JPEG, PNG or WebP image." };
  if (!photo) return { ok: false, error: "Attach a photo." };
  await db.insert(evidence).values({ issueId: input.issueId, phase, caption, imageUrl: photo, addedBy: CURRENT_RESIDENT });
  refresh();
  return { ok: true };
}

/* ---- Authority information (entered by a resident, labelled unverified) ---- */
export async function logAuthorityUpdate(input: { issueId: number; stage: number; ref: string; note: string }): Promise<ActionResult> {
  const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId));
  if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
  const ref = input.ref.trim();
  const note = input.note.trim();
  const stageNo = Number(input.stage);
  if (!(stageNo >= 3 && stageNo <= 6) || stageNo <= issue.stage) {
    return { ok: false, error: "Choose a stage after the current one (sent, acknowledged, in progress, or authority-resolved)." };
  }
  if (!ref && !note) return { ok: false, error: "Add a complaint reference or a note about what the authority said." };
  const st = stageOf(stageNo);
  await db.insert(timelineEvents).values({
    issueId: issue.id, stage: stageNo, label: st.label,
    note: note || (ref ? `Complaint reference ${ref} recorded.` : null),
    actor: `${CURRENT_RESIDENT} (reporting authority activity)`, source: "authority-reported",
  });
  await db
    .update(issues)
    .set({ stage: stageNo, complaintRef: ref || issue.complaintRef, authorityNote: note || issue.authorityNote, updatedAt: new Date() })
    .where(eq(issues.id, issue.id));
  refresh();
  return { ok: true };
}

/* ---- Resolution feedback ---- */
export async function submitVerification(input: { issueId: number; verdict: string; note: string }): Promise<ActionResult> {
  const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId));
  if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
  if (issue.stage !== 6) return { ok: false, error: "Resolution can only be verified after the authority reports it resolved." };
  if (!["fixed", "not_fixed"].includes(input.verdict)) return { ok: false, error: "Choose a verdict." };
  const note = input.note.trim() || null;

  await db
    .insert(verifications)
    .values({ issueId: issue.id, resident: CURRENT_RESIDENT, verdict: input.verdict, note })
    .onConflictDoUpdate({
      target: [verifications.issueId, verifications.resident],
      set: { verdict: input.verdict, note, createdAt: new Date() },
    });

  const [{ fixed, notFixed }] = await db
    .select({
      fixed: sql<number>`count(*) filter (where verdict = 'fixed')::int`,
      notFixed: sql<number>`count(*) filter (where verdict = 'not_fixed')::int`,
    })
    .from(verifications)
    .where(eq(verifications.issueId, issue.id));

  if (fixed >= VERIFY_THRESHOLD) {
    await db.insert(timelineEvents).values({
      issueId: issue.id, stage: 7, label: "Community verified resolved",
      note: `${fixed} residents confirmed the problem is actually fixed.`, actor: "Community", source: "community",
    });
    await db.update(issues).set({ stage: 7, updatedAt: new Date() }).where(eq(issues.id, issue.id));
  } else if (notFixed >= REOPEN_THRESHOLD) {
    await db.insert(timelineEvents).values({
      issueId: issue.id, stage: 5, label: "Reopened by residents",
      note: `${notFixed} residents reported the problem is not fixed. Case returned to work in progress.`, actor: "Community", source: "community",
    });
    await db.delete(verifications).where(and(eq(verifications.issueId, issue.id)));
    await db.update(issues).set({ stage: 5, updatedAt: new Date() }).where(eq(issues.id, issue.id));
  }
  refresh();
  return { ok: true };
}
