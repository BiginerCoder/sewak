"use server";

import { db } from "@/db";
import { comments, confirmations, evidence, issues, timelineEvents, verifications } from "@/db/schema";
import { CATEGORIES, CURRENT_RESIDENT, REOPEN_THRESHOLD, VERIFY_THRESHOLD, categoryOf, stageOf } from "@/lib/constants";
import { ensureSeeded } from "@/lib/queries";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

/* ---- Report a problem ---- */
export async function createIssue(input: {
  kind: string;
  title: string;
  category: string;
  description: string;
  location: string;
  simulated?: boolean;
  photo?: string | null;
}): Promise<ActionResult> {
  await ensureSeeded();
  const fields: Record<string, string> = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  if (title.length < 8) fields.title = "Enter a short title of at least 8 characters.";
  if (title.length > 120) fields.title = "Keep the title under 120 characters.";
  if (!CATEGORIES.some((c) => c.id === input.category)) fields.category = "Choose a category.";
  if (description.length < 20) fields.description = "Describe the problem in at least 20 characters so neighbours and the authority understand it.";
  if (location.length < 3) fields.location = "Add a location or use the demo location.";
  const photo = validImage(input.photo);
  if (photo === undefined) fields.photo = "Photo must be a JPEG, PNG or WebP image under 1 MB after resizing.";
  if (Object.keys(fields).length) return { ok: false, error: "Please fix the highlighted fields.", fields };

  const kind = input.kind === "information" ? "information" : "problem";
  const cat = categoryOf(input.category);
  const [row] = await db
    .insert(issues)
    .values({
      kind,
      title,
      description,
      category: cat.id,
      stage: 1,
      author: CURRENT_RESIDENT,
      locationText: location,
      locationSimulated: input.simulated !== false,
      department: kind === "problem" ? cat.department : null,
      affectedCount: kind === "problem" ? 1 : 0,
    })
    .returning({ id: issues.id });

  if (kind === "problem") {
    await db.insert(timelineEvents).values({
      issueId: row.id, stage: 1, label: "Reported", note: "Problem posted.", actor: CURRENT_RESIDENT, source: "resident",
    });
    await db.insert(confirmations).values({ issueId: row.id, resident: CURRENT_RESIDENT });
  }
  if (photo) {
    await db.insert(evidence).values({ issueId: row.id, phase: "before", caption: "Photo added with the report", imageUrl: photo, addedBy: CURRENT_RESIDENT });
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
  await db.insert(comments).values({ issueId, author: CURRENT_RESIDENT, body: text });
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
