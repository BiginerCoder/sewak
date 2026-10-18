import { CURRENT_RESIDENT, isResolved, isUnresolved } from "./constants";
import { ensureSeeded, getFirebaseStore } from "@/lib/firebase-store";
import type {
  CommentRecord,
  ConfirmationRecord,
  EvidenceRecord,
  IssueRecord,
  StoreShape,
  TimelineEventRecord,
  VerificationRecord,
} from "@/lib/firebase-store";
import { getResidentActivities } from "@/lib/resident-activity";

export type IssueRow = {
  id: number;
  kind: "problem" | "information";
  title: string;
  description: string;
  category: string;
  stage: number;
  author: string;
  authorEmail?: string;
  locationId: string;
  locationText: string;
  department: string | null;
  complaintRef: string | null;
  affectedCount: number;
  createdAt: Date;
  updatedAt: Date;
  commentCount: number;
  thumbId: number | null;
  lastEventAt: Date | null;
};

export function ensureSeededLocal() {
  return ensureSeeded();
}

export async function getCivicStore(): Promise<StoreShape> {
  ensureSeededLocal();
  const demo = getFirebaseStore();
  const store: StoreShape = {
    issues: [...demo.issues],
    comments: [...demo.comments],
    confirmations: [...demo.confirmations],
    evidence: [...demo.evidence],
    timelineEvents: [...demo.timelineEvents],
    verifications: [...demo.verifications],
  };
  const activities = await getResidentActivities();
  for (const activity of activities) {
    const payload = activity.payload;
    if (activity.type === "issue_created") {
      const issue = payload as unknown as IssueRecord;
      issue.createdAt = new Date(issue.createdAt);
      issue.updatedAt = new Date(issue.updatedAt);
      store.issues.push(issue);
    } else if (activity.type === "issue_update" && activity.issueId !== null) {
      const issue = store.issues.find((item) => item.id === activity.issueId);
      const updates = payload.updates as Partial<IssueRecord> | undefined;
      if (issue && updates) {
        if (updates.updatedAt) updates.updatedAt = new Date(updates.updatedAt);
        Object.assign(issue, updates);
      }
    } else if (activity.type === "comment") {
      store.comments.push({ ...payload, id: activity.id, issueId: activity.issueId, authorEmail: activity.email, createdAt: activity.createdAt } as unknown as CommentRecord);
    } else if (activity.type === "confirmation") {
      store.confirmations.push({ ...payload, id: activity.id, issueId: activity.issueId, residentEmail: activity.email, createdAt: activity.createdAt } as unknown as ConfirmationRecord);
    } else if (activity.type === "evidence") {
      store.evidence.push({ ...payload, id: activity.id, issueId: activity.issueId, addedByEmail: activity.email, createdAt: activity.createdAt } as unknown as EvidenceRecord);
    } else if (activity.type === "timeline_event") {
      store.timelineEvents.push({ ...payload, id: activity.id, issueId: activity.issueId, createdAt: activity.createdAt } as unknown as TimelineEventRecord);
    } else if (activity.type === "verification") {
      const row = { ...payload, id: activity.id, issueId: activity.issueId, residentEmail: activity.email, createdAt: activity.createdAt } as unknown as VerificationRecord;
      const existing = store.verifications.findIndex((item) =>
        item.issueId === activity.issueId &&
        item.residentEmail === activity.email &&
        (item.cycle ?? 0) === (row.cycle ?? 0)
      );
      if (existing >= 0) store.verifications[existing] = row;
      else store.verifications.push(row);
    }
  }
  return store;
}

export async function getIssues() {
  const store = await getCivicStore();
  return store.issues
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((issue) => ({
      ...issue,
      commentCount: store.comments.filter((comment) => comment.issueId === issue.id).length,
      thumbId: store.evidence.find((item) => item.issueId === issue.id && item.imageUrl)?.id ?? null,
      lastEventAt: store.timelineEvents.filter((item) => item.issueId === issue.id).sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))[0]?.createdAt ?? null,
    }));
}

export async function getStats(locationId?: string) {
  const all = (await getIssues()).filter((issue) => !locationId || issue.locationId === locationId);
  return {
    unresolved: all.filter(isUnresolved).length,
    resolved: all.filter(isResolved).length,
    total: all.length,
    confirmations: all.filter((i) => i.kind === "problem").reduce((s, i) => s + i.affectedCount, 0),
    awaiting: all.filter((i) => i.kind === "problem" && i.stage === 6).length,
  };
}

export async function getIssueDetail(id: number, email?: string) {
  const store = await getCivicStore();
  const issue = store.issues.find((item) => item.id === id);
  if (!issue) return null;
  const comments = store.comments.filter((item) => item.issueId === id).sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
  const evidence = store.evidence.filter((item) => item.issueId === id).sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
  const timeline = store.timelineEvents.filter((item) => item.issueId === id).sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
  const currentCycle = store.timelineEvents.filter((item) => item.issueId === id && item.label === "Reopened by residents").length;
  const verifications = store.verifications
    .filter((item) => item.issueId === id && (item.cycle ?? 0) === currentCycle)
    .sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
  const mine = store.confirmations.filter((item) => item.issueId === id && (email ? item.residentEmail === email : item.resident === CURRENT_RESIDENT));
  return {
    issue,
    comments,
    evidence: evidence.map((e) => ({ id: e.id, phase: e.phase, caption: e.caption, hasImage: !!e.imageUrl, addedBy: e.addedBy, createdAt: e.createdAt })),
    timeline,
    verifications,
    confirmed: mine.length > 0,
    myVerdict: verifications.find((v) => email ? v.residentEmail === email : v.resident === CURRENT_RESIDENT)?.verdict ?? null,
  };
}

export async function getContributions(email?: string) {
  const store = await getCivicStore();
  const all = await getIssues();
  const mineConf = store.confirmations.filter((item) => email ? item.residentEmail === email : item.resident === CURRENT_RESIDENT);
  const mineVer = store.verifications
    .filter((item) => email ? item.residentEmail === email : item.resident === CURRENT_RESIDENT)
    .sort((a, b) => Number(new Date(a.createdAt)) - Number(new Date(b.createdAt)));
  const latestVerifications = new Map<number, VerificationRecord>();
  for (const verification of mineVer) latestVerifications.set(verification.issueId, verification);
  const byId = new Map(all.map((issue) => [issue.id, issue]));
  const verified = [...latestVerifications.values()]
    .map((v) => ({ verdict: v.verdict, issue: byId.get(v.issueId) }))
    .filter((value) => !!value.issue) as { verdict: string; issue: IssueRow }[];
  const ownIssue = (issue: IssueRow) => email
    ? issue.authorEmail === email
    : issue.author === CURRENT_RESIDENT;
  const confirmed = mineConf
    .map((c) => byId.get(c.issueId))
    .filter((issue) => issue && !ownIssue(issue)) as IssueRow[];
  return {
    reported: all.filter((issue) => email ? issue.authorEmail === email : issue.author === CURRENT_RESIDENT),
    confirmed,
    verified,
    commentCount: store.comments.filter((comment) => email ? comment.authorEmail === email : comment.author === CURRENT_RESIDENT).length,
  };
}

export async function getRecentUpdates(limit = 4, locationId?: string) {
  const store = await getCivicStore();
  const rows = store.timelineEvents
    .filter((event) => event.stage > 1 && (!locationId || store.issues.find((issue) => issue.id === event.issueId)?.locationId === locationId))
    .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)))
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      issueId: event.issueId,
      label: event.label,
      source: event.source,
      createdAt: event.createdAt,
      title: store.issues.find((issue) => issue.id === event.issueId)?.title ?? "Update",
    }));
  return rows;
}
