import { CURRENT_RESIDENT } from "@/lib/constants";

export type IssueRecord = {
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
  locationSimulated: boolean;
  department: string | null;
  complaintRef: string | null;
  authorityNote: string | null;
  affectedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CommentRecord = {
  id: number;
  issueId: number;
  author: string;
  authorEmail?: string;
  body: string;
  createdAt: Date;
};

export type ConfirmationRecord = {
  id: number;
  issueId: number;
  resident: string;
  residentEmail?: string;
  createdAt: Date;
};

export type EvidenceRecord = {
  id: number;
  issueId: number;
  phase: "before" | "during" | "after";
  caption: string;
  imageUrl: string | null;
  addedBy: string;
  addedByEmail?: string;
  createdAt: Date;
};

export type TimelineEventRecord = {
  id: number;
  issueId: number;
  stage: number;
  label: string;
  note: string | null;
  actor: string;
  source: "resident" | "authority-reported" | "community" | "system";
  createdAt: Date;
};

export type VerificationRecord = {
  id: number;
  issueId: number;
  resident: string;
  residentEmail?: string;
  cycle?: number;
  verdict: "fixed" | "not_fixed";
  note: string | null;
  createdAt: Date;
};

export type StoreShape = {
  issues: IssueRecord[];
  comments: CommentRecord[];
  confirmations: ConfirmationRecord[];
  evidence: EvidenceRecord[];
  timelineEvents: TimelineEventRecord[];
  verifications: VerificationRecord[];
};

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600 * 1000);

const seedIssues: IssueRecord[] = [
  {
    id: 1,
    kind: "problem",
    title: "Deep pothole on Gandhi Path near Shastri Nagar Circle",
    description:
      "A pothole roughly a foot deep has formed at the turn before the circle. Two-wheelers swerve into the oncoming lane to avoid it, especially after dark. It has been growing since the last rain.",
    category: "roads",
    stage: 5,
    author: "Rohit Verma",
    locationId: "jaipur-24",
    locationText: "Gandhi Path, near Shastri Nagar Circle",
    locationSimulated: true,
    department: "Roads & Public Works (Municipal Corporation)",
    complaintRef: "DEMO-RD-20417",
    authorityNote: "Crew visit reported by residents: pothole marked for patching.",
    affectedCount: 34,
    createdAt: ago(12),
    updatedAt: ago(10),
  },
  {
    id: 2,
    kind: "problem",
    title: "Six streetlights out on Lane 4",
    description:
      "Six consecutive streetlights have not worked for over a week. The lane is completely dark after 7 pm and women and senior residents have stopped using it to walk home.",
    category: "streetlights",
    stage: 4,
    author: "Anita Joshi",
    locationId: "jaipur-24",
    locationText: "Lane 4, Shastri Nagar",
    locationSimulated: true,
    department: "Street Lighting (Municipal Corporation)",
    complaintRef: "DEMO-SL-11882",
    authorityNote: "Complaint acknowledged; inspection date not shared yet.",
    affectedCount: 18,
    createdAt: ago(7),
    updatedAt: ago(5),
  },
  {
    id: 3,
    kind: "problem",
    title: "Garbage not collected for five days in Block C",
    description:
      "The collection vehicle has skipped Block C since last Monday. Bins are overflowing onto the footpath and there is a strong smell. Stray animals are spreading the waste.",
    category: "sanitation",
    stage: 3,
    author: CURRENT_RESIDENT,
    locationId: "jaipur-24",
    locationText: "Block C, Shastri Nagar",
    locationSimulated: true,
    department: "Sanitation & Solid Waste (Municipal Corporation)",
    complaintRef: "DEMO-SW-77031",
    authorityNote: "Complaint lodged by the reporter; awaiting acknowledgement.",
    affectedCount: 27,
    createdAt: ago(5),
    updatedAt: ago(4),
  },
  {
    id: 4,
    kind: "problem",
    title: "Waterlogging on 60 Feet Road after every rain",
    description:
      "The storm drain on 60 Feet Road was choked with silt, so the road flooded within an hour of rain and shops had to close. The drain needed desilting before the monsoon.",
    category: "drainage",
    stage: 7,
    author: "Sunita Meena",
    locationId: "jaipur-24",
    locationText: "60 Feet Road, Shastri Nagar",
    locationSimulated: true,
    department: "Drainage & Sewerage (Municipal Corporation)",
    complaintRef: "DEMO-DR-28804",
    authorityNote: "Desilting completed; residents verified after the next rain.",
    affectedCount: 15,
    createdAt: ago(30),
    updatedAt: ago(2),
  },
  {
    id: 5,
    kind: "information",
    title: "Neighbour notice: water supply may pause on Saturday morning",
    description:
      "A resident shared that supply may be interrupted on Saturday morning for pipeline work. This notice is resident-shared and has not been confirmed with the water department. Store water as a precaution.",
    category: "water",
    stage: 1,
    author: "Anita Joshi",
    locationId: "jaipur-24",
    locationText: "Ward 24 (general notice)",
    locationSimulated: true,
    department: null,
    complaintRef: null,
    authorityNote: null,
    affectedCount: 0,
    createdAt: ago(2),
    updatedAt: ago(2),
  },
];

const seedTimelineEvents: TimelineEventRecord[] = [
  { id: 1, issueId: 1, stage: 1, label: "Reported", note: "Problem posted.", actor: "Rohit Verma", source: "resident", createdAt: ago(12) },
  { id: 2, issueId: 1, stage: 2, label: "Community confirmed", note: "Three or more neighbours confirmed they are affected.", actor: "Community", source: "community", createdAt: ago(10) },
  { id: 3, issueId: 1, stage: 3, label: "Sent to authority", note: "Complaint lodged with the roads department.", actor: "Rohit Verma", source: "resident", createdAt: ago(9) },
  { id: 4, issueId: 1, stage: 4, label: "Authority acknowledged", note: "Reference DEMO-RD-20417 recorded; inspection scheduled.", actor: "Authority (as reported by resident)", source: "authority-reported", createdAt: ago(6) },
  { id: 5, issueId: 1, stage: 5, label: "Work in progress", note: "A crew marked the pothole for patching.", actor: "Authority (as reported by resident)", source: "authority-reported", createdAt: ago(1) },
  { id: 6, issueId: 2, stage: 1, label: "Reported", note: "Problem posted.", actor: "Anita Joshi", source: "resident", createdAt: ago(7) },
  { id: 7, issueId: 2, stage: 2, label: "Community confirmed", note: "Neighbours on Lane 4 confirmed.", actor: "Community", source: "community", createdAt: ago(6) },
  { id: 8, issueId: 2, stage: 3, label: "Sent to authority", note: "Complaint lodged with street lighting.", actor: "Anita Joshi", source: "resident", createdAt: ago(5) },
  { id: 9, issueId: 2, stage: 4, label: "Authority acknowledged", note: "Acknowledgement received, no inspection date yet.", actor: "Authority (as reported by resident)", source: "authority-reported", createdAt: ago(3) },
  { id: 10, issueId: 3, stage: 1, label: "Reported", note: "Problem posted.", actor: CURRENT_RESIDENT, source: "resident", createdAt: ago(5) },
  { id: 11, issueId: 3, stage: 2, label: "Community confirmed", note: "Block C residents confirmed.", actor: "Community", source: "community", createdAt: ago(4) },
  { id: 12, issueId: 3, stage: 3, label: "Sent to authority", note: "Complaint lodged with sanitation.", actor: CURRENT_RESIDENT, source: "resident", createdAt: ago(3) },
  { id: 13, issueId: 4, stage: 1, label: "Reported", note: "Problem posted with photo.", actor: "Sunita Meena", source: "resident", createdAt: ago(30) },
  { id: 14, issueId: 4, stage: 2, label: "Community confirmed", note: "Shopkeepers and residents confirmed.", actor: "Community", source: "community", createdAt: ago(28) },
  { id: 15, issueId: 4, stage: 3, label: "Sent to authority", note: "Complaint lodged.", actor: "Sunita Meena", source: "resident", createdAt: ago(26) },
  { id: 16, issueId: 4, stage: 4, label: "Authority acknowledged", note: "Acknowledged.", actor: "Authority (as reported by resident)", source: "authority-reported", createdAt: ago(22) },
  { id: 17, issueId: 4, stage: 5, label: "Work in progress", note: "Desilting started.", actor: "Authority (as reported by resident)", source: "authority-reported", createdAt: ago(15) },
  { id: 18, issueId: 4, stage: 6, label: "Authority reported resolved", note: "Authority marked work complete.", actor: "Authority (as reported by resident)", source: "authority-reported", createdAt: ago(9) },
  { id: 19, issueId: 4, stage: 7, label: "Community verified resolved", note: "Residents confirmed the road stayed clear after rain.", actor: "Community", source: "community", createdAt: ago(5) },
  { id: 20, issueId: 5, stage: 1, label: "Notice shared", note: "Resident shared a local update.", actor: "Anita Joshi", source: "resident", createdAt: ago(2) },
];

const seedComments: CommentRecord[] = [
  { id: 1, issueId: 1, author: "Anita Joshi", body: "My scooter slipped here yesterday. Please prioritise this before the next rain.", createdAt: ago(8) },
  { id: 2, issueId: 1, author: "Dev Agarwal", body: "A crew was marking the road this morning. Hopefully the patching follows soon.", createdAt: ago(1) },
  { id: 3, issueId: 2, author: "Sunita Meena", body: "Lane 4 is unsafe after dark. Confirming from my side.", createdAt: ago(6) },
  { id: 4, issueId: 3, author: "Kavita Singh", body: "Block D is facing the same problem since Tuesday.", createdAt: ago(3) },
  { id: 5, issueId: 4, author: "Imran Khan", body: "It rained heavily last night and the road stayed clear. Great outcome.", createdAt: ago(5) },
];

const seedEvidence: EvidenceRecord[] = [
  { id: 1, issueId: 1, phase: "before", caption: "Pothole at the turn before the circle", imageUrl: "/evidence/pothole.jpg", addedBy: "Rohit Verma", createdAt: ago(12) },
  { id: 2, issueId: 2, phase: "before", caption: "Lane 4 after 7 pm", imageUrl: "/evidence/streetlight.jpg", addedBy: "Anita Joshi", createdAt: ago(7) },
  { id: 3, issueId: 3, phase: "before", caption: "Overflowing bins at Block C", imageUrl: "/evidence/garbage.jpg", addedBy: CURRENT_RESIDENT, createdAt: ago(5) },
  { id: 4, issueId: 4, phase: "before", caption: "60 Feet Road flooded after rain", imageUrl: "/evidence/waterlogging-before.jpg", addedBy: "Sunita Meena", createdAt: ago(30) },
  { id: 5, issueId: 4, phase: "after", caption: "Road clear after drain desilting", imageUrl: "/evidence/waterlogging-after.jpg", addedBy: "Sunita Meena", createdAt: ago(5) },
];

const seedConfirmations: ConfirmationRecord[] = [
  { id: 1, issueId: 1, resident: CURRENT_RESIDENT, createdAt: ago(1) },
  { id: 2, issueId: 2, resident: CURRENT_RESIDENT, createdAt: ago(1) },
  { id: 3, issueId: 3, resident: CURRENT_RESIDENT, createdAt: ago(1) },
];

const seedVerifications: VerificationRecord[] = [
  { id: 1, issueId: 4, resident: "Rohit Verma", verdict: "fixed", note: "Water is no longer spilling on my side of the lane.", createdAt: ago(1) },
  { id: 2, issueId: 4, resident: "Anita Joshi", verdict: "fixed", note: null, createdAt: ago(1) },
  { id: 3, issueId: 4, resident: CURRENT_RESIDENT, verdict: "fixed", note: null, createdAt: ago(1) },
];

const createSeedStore = (): StoreShape => ({
  issues: seedIssues,
  comments: seedComments,
  confirmations: seedConfirmations,
  evidence: seedEvidence,
  timelineEvents: seedTimelineEvents,
  verifications: seedVerifications,
});

export function getFirebaseStore(): StoreShape {
  const globalState = globalThis as typeof globalThis & {
    __sewakFirebaseStore?: StoreShape;
  };

  if (!globalState.__sewakFirebaseStore) {
    globalState.__sewakFirebaseStore = createSeedStore();
  }

  return globalState.__sewakFirebaseStore;
}

export function ensureSeeded() {
  return getFirebaseStore();
}

export function nextId<T extends keyof StoreShape>(collection: T): number {
  const docs = getFirebaseStore()[collection];
  return docs.reduce((max, doc) => Math.max(max, Number((doc as { id: number }).id ?? 0)), 0) + 1;
}

export function listCollection<T extends keyof StoreShape>(collection: T): StoreShape[T] {
  return getFirebaseStore()[collection] as StoreShape[T];
}

export function addDocument<T extends keyof StoreShape>(collection: T, document: StoreShape[T][number]) {
  const store = getFirebaseStore();
  store[collection].push(document as never);
  return document;
}

export function updateDocument<T extends keyof StoreShape>(collection: T, id: number, updates: Partial<StoreShape[T][number]>) {
  const store = getFirebaseStore();
  const target = (store[collection] as Array<Record<string, unknown>>).find((item) => item.id === id) as Record<string, unknown> | undefined;
  if (!target) return null;
  Object.assign(target, updates);
  return target;
}

export function removeDocument<T extends keyof StoreShape>(collection: T, id: number) {
  const store = getFirebaseStore();
  const index = store[collection].findIndex((item) => item.id === id);
  if (index === -1) return false;
  store[collection].splice(index, 1);
  return true;
}

export function findDocument<T extends keyof StoreShape>(collection: T, predicate: (item: StoreShape[T][number]) => boolean) {
  return (getFirebaseStore()[collection] as StoreShape[T]).find(predicate) ?? null;
}

export function filterDocuments<T extends keyof StoreShape>(collection: T, predicate: (item: StoreShape[T][number]) => boolean) {
  return (getFirebaseStore()[collection] as StoreShape[T]).filter(predicate);
}
