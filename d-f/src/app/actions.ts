"use server";

import { CATEGORIES, CIVIC_LOCATIONS, REOPEN_THRESHOLD, VERIFY_THRESHOLD, categoryOf, stageOf } from "@/lib/constants";
import { getResidentProfile } from "@/lib/auth-session";
import type { AuthProfile } from "@/lib/auth-profiles";
import { getCivicStore } from "@/lib/queries";
import {
  recordResidentActivities,
  recordResidentIssue,
  type ActivityInput,
} from "@/lib/resident-activity";
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

async function signedIn(): Promise<{ ok: true; resident: AuthProfile } | { ok: false; error: string }> {
  const resident = await getResidentProfile();
  return resident
    ? { ok: true, resident }
    : { ok: false, error: "Sign in to your resident account before submitting or supporting a case." };
}

async function save(email: string, activities: ActivityInput[]): Promise<ActionResult> {
  try {
    await recordResidentActivities(email, activities);
    refresh();
    return { ok: true };
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "23505") return { ok: false, error: "You have already recorded this confirmation." };
    console.error("Unable to save resident civic activity:", error);
    return { ok: false, error: "Your activity could not be saved. Please try again." };
  }
}

function timeline(issueId: number, stage: number, label: string, note: string | null, actor: string, source: string): ActivityInput {
  return {
    type: "timeline_event",
    issueId,
    payload: { stage, label, note, actor, source, createdAt: new Date().toISOString() },
  };
}

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
  const fields: Record<string, string> = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const location = input.location.trim();
  if (title.length < 8) fields.title = "Enter a short title of at least 8 characters.";
  if (title.length > 120) fields.title = "Keep the title under 120 characters.";
  if (!CATEGORIES.some((category) => category.id === input.category)) fields.category = "Choose a category.";
  if (description.length < 20) fields.description = "Describe the problem in at least 20 characters so neighbours and the authority understand it.";
  if (location.length < 3) fields.location = "Add a location or use the demo location.";
  if (!CIVIC_LOCATIONS.some((item) => item.id === input.locationId)) fields.location = "Choose a ward or neighbourhood.";
  const photo = validImage(input.photo);
  if (photo === undefined) fields.photo = "Photo must be a JPEG, PNG or WebP image under 1 MB after resizing.";
  if (Object.keys(fields).length) return { ok: false, error: "Please fix the highlighted fields.", fields };

  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error };
  const resident = auth.resident;
  const kind: "information" | "problem" = input.kind === "information" ? "information" : "problem";
  const category = categoryOf(input.category);
  const now = new Date().toISOString();
  const issue = {
    kind,
    title,
    description,
    category: category.id,
    stage: 1,
    author: resident.displayName,
    authorEmail: resident.email,
    locationId: input.locationId,
    locationText: location,
    locationSimulated: input.simulated !== false,
    department: kind === "problem" ? category.department : null,
    complaintRef: null,
    authorityNote: null,
    affectedCount: kind === "problem" ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };
  const related: Array<Omit<ActivityInput, "issueId">> = [];
  if (kind === "problem") {
    related.push(
      { type: "timeline_event", payload: { stage: 1, label: "Reported", note: "Problem posted.", actor: resident.displayName, source: "resident", createdAt: now } },
      { type: "confirmation", payload: { resident: resident.displayName } },
    );
  }
  if (photo) {
    related.push({
      type: "evidence",
      payload: { phase: "before", caption: "Photo added with the report", imageUrl: photo, addedBy: resident.displayName },
    });
  }

  try {
    const id = await recordResidentIssue(resident.email, issue, related);
    refresh();
    return { ok: true, id };
  } catch (error) {
    console.error("Unable to save resident report:", error);
    return { ok: false, error: "Your report could not be saved. Please try again." };
  }
}

export async function confirmAffected(issueId: number): Promise<ActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { resident } = auth;
  const store = await getCivicStore();
  const issue = store.issues.find((item) => item.id === issueId);
  if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
  if (store.confirmations.some((item) => item.issueId === issueId && item.residentEmail === resident.email)) {
    return { ok: false, error: "You have already confirmed this problem." };
  }
  const affectedCount = issue.affectedCount + 1;
  const stage = issue.stage === 1 && affectedCount >= 3 ? 2 : issue.stage;
  const activities: ActivityInput[] = [
    { type: "confirmation", issueId, payload: { resident: resident.displayName } },
    { type: "issue_update", issueId, payload: { updates: { affectedCount, stage, updatedAt: new Date().toISOString() } } },
  ];
  if (stage === 2 && issue.stage === 1) {
    activities.push(timeline(issueId, 2, "Community confirmed", "Three or more residents confirmed they are affected.", "Community", "community"));
  }
  return save(resident.email, activities);
}

export async function addComment(issueId: number, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (text.length < 2) return { ok: false, error: "Write a comment first." };
  if (text.length > 1000) return { ok: false, error: "Keep comments under 1000 characters." };
  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error };
  const store = await getCivicStore();
  if (!store.issues.some((issue) => issue.id === issueId)) return { ok: false, error: "Case not found." };
  return save(auth.resident.email, [{
    type: "comment",
    issueId,
    payload: { author: auth.resident.displayName, body: text },
  }]);
}

export async function addEvidence(input: { issueId: number; phase: string; caption: string; photo?: string | null }): Promise<ActionResult> {
  const phase: "before" | "during" | "after" | null = ["before", "during", "after"].includes(input.phase) ? (input.phase as "before" | "during" | "after") : null;
  const caption = input.caption.trim();
  const photo = validImage(input.photo);
  if (!phase) return { ok: false, error: "Choose before, during or after." };
  if (caption.length < 3) return { ok: false, error: "Add a short caption describing the evidence." };
  if (photo === undefined) return { ok: false, error: "Photo must be a JPEG, PNG or WebP image." };
  if (!photo) return { ok: false, error: "Attach a photo." };
  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error };
  const store = await getCivicStore();
  if (!store.issues.some((issue) => issue.id === input.issueId)) return { ok: false, error: "Case not found." };
  return save(auth.resident.email, [{
    type: "evidence",
    issueId: input.issueId,
    payload: { phase, caption, imageUrl: photo, addedBy: auth.resident.displayName },
  }]);
}

export async function logAuthorityUpdate(input: { issueId: number; stage: number; ref: string; note: string }): Promise<ActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error };
  const store = await getCivicStore();
  const issue = store.issues.find((item) => item.id === input.issueId);
  if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
  const ref = input.ref.trim();
  const note = input.note.trim();
  const stageNo = Number(input.stage);
  if (!(stageNo >= 3 && stageNo <= 6) || stageNo <= issue.stage) {
    return { ok: false, error: "Choose a stage after the current one (sent, acknowledged, in progress, or authority-resolved)." };
  }
  if (!ref && !note) return { ok: false, error: "Add a complaint reference or a note about what the authority said." };
  const label = stageOf(stageNo).label;
  return save(auth.resident.email, [
    timeline(input.issueId, stageNo, label, note || (ref ? `Complaint reference ${ref} recorded.` : null), `${auth.resident.displayName} (reporting authority activity)`, "authority-reported"),
    { type: "issue_update", issueId: input.issueId, payload: { updates: { stage: stageNo, complaintRef: ref || issue.complaintRef, authorityNote: note || issue.authorityNote, updatedAt: new Date().toISOString() } } },
  ]);
}

export async function submitVerification(input: { issueId: number; verdict: string; note: string }): Promise<ActionResult> {
  const auth = await signedIn();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { resident } = auth;
  const store = await getCivicStore();
  const issue = store.issues.find((item) => item.id === input.issueId);
  if (!issue || issue.kind !== "problem") return { ok: false, error: "Case not found." };
  if (issue.stage !== 6) return { ok: false, error: "Resolution can only be verified after the authority reports it resolved." };
  if (!["fixed", "not_fixed"].includes(input.verdict)) return { ok: false, error: "Choose a verdict." };

  const cycle = store.timelineEvents.filter((event) => event.issueId === issue.id && event.label === "Reopened by residents").length;
  const verdict = input.verdict as "fixed" | "not_fixed";
  const note = input.note.trim() || null;
  const existing = store.verifications.find((item) => item.issueId === issue.id && item.residentEmail === resident.email && (item.cycle ?? 0) === cycle);
  const fixed = store.verifications.filter((item) => item.issueId === issue.id && (item.cycle ?? 0) === cycle && item.verdict === "fixed").length
    - (existing?.verdict === "fixed" ? 1 : 0) + (verdict === "fixed" ? 1 : 0);
  const notFixed = store.verifications.filter((item) => item.issueId === issue.id && (item.cycle ?? 0) === cycle && item.verdict === "not_fixed").length
    - (existing?.verdict === "not_fixed" ? 1 : 0) + (verdict === "not_fixed" ? 1 : 0);
  const activities: ActivityInput[] = [{
    type: "verification",
    issueId: issue.id,
    payload: { resident: resident.displayName, verdict, note, cycle },
  }];

  if (fixed >= VERIFY_THRESHOLD) {
    activities.push(
      timeline(issue.id, 7, "Community verified resolved", `${fixed} residents confirmed the problem is actually fixed.`, "Community", "community"),
      { type: "issue_update", issueId: issue.id, payload: { updates: { stage: 7, updatedAt: new Date().toISOString() } } },
    );
  } else if (notFixed >= REOPEN_THRESHOLD) {
    activities.push(
      timeline(issue.id, 5, "Reopened by residents", `${notFixed} residents reported the problem is not fixed. Case returned to work in progress.`, "Community", "community"),
      { type: "issue_update", issueId: issue.id, payload: { updates: { stage: 5, updatedAt: new Date().toISOString() } } },
    );
  }
  return save(resident.email, activities);
}
