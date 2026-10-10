import { CURRENT_RESIDENT, categoryOf, isResolved, isUnresolved } from "./constants";

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

export type DemoIssue = {
  id: number;
  kind: string;
  title: string;
  description: string;
  category: string;
  stage: number;
  author: string;
  locationText: string;
  locationSimulated: boolean;
  department: string | null;
  complaintRef: string | null;
  authorityNote: string | null;
  affectedCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoComment = { id: number; issueId: number; author: string; body: string; createdAt: Date };
export type DemoEvidence = { id: number; issueId: number; phase: string; caption: string; imageUrl: string | null; addedBy: string; createdAt: Date };
export type DemoTimelineEvent = {
  id: number;
  issueId: number;
  stage: number;
  label: string;
  note: string | null;
  actor: string;
  source: string;
  createdAt: Date;
};
export type DemoVerification = { id: number; issueId: number; resident: string; verdict: string; note: string | null; createdAt: Date };
export type DemoConfirmation = { id: number; issueId: number; resident: string; createdAt: Date };

export type DemoData = {
  issues: DemoIssue[];
  comments: DemoComment[];
  evidence: DemoEvidence[];
  timeline: DemoTimelineEvent[];
  verifications: DemoVerification[];
  confirmations: DemoConfirmation[];
};

const issueSeeds = [
  ["Deep pothole on Gandhi Path near Shastri Nagar Circle", "A pothole roughly a foot deep has formed at the turn before the circle. Two-wheelers swerve into the oncoming lane to avoid it, especially after dark.", "roads", 5, "Rohit Verma", "Gandhi Path, near Shastri Nagar Circle", 34, 12],
  ["Six streetlights out on Lane 4", "Six consecutive streetlights have not worked for over a week. The lane is completely dark after 7 pm and residents have stopped using it to walk home.", "streetlights", 4, "Anita Joshi", "Lane 4, Shastri Nagar", 18, 7],
  ["Garbage not collected for five days in Block C", "The collection vehicle has skipped Block C since last Monday. Bins are overflowing onto the footpath and there is a strong smell.", "sanitation", 3, CURRENT_RESIDENT, "Block C, Shastri Nagar", 27, 5],
  ["Sewage overflowing near the community water tank", "Sewage from a blocked line has been spilling onto the lane next to the community water tank. Children walk through it on the way to school.", "drainage", 6, "Imran Khan", "Near community water tank, Sector 2", 21, 16],
  ["Waterlogging on 60 Feet Road after every rain", "The storm drain on 60 Feet Road was choked with silt, so the road flooded within an hour of rain and shops had to close.", "drainage", 7, "Sunita Meena", "60 Feet Road, Shastri Nagar", 15, 30],
  ["Broken swings and overgrown grass at Shastri Nagar Park", "Two swings are broken with exposed metal edges and the grass has grown above knee height near the play area.", "parks", 2, "Dev Agarwal", "Shastri Nagar Park, play area", 9, 3],
  ["Illegal dumping on the vacant plot behind Block F", "Construction debris and household waste are being dumped at night on the vacant plot behind Block F.", "sanitation", 1, "Kavita Singh", "Vacant plot behind Block F", 2, 1],
  ["Neighbour notice: water supply may pause on Saturday morning", "A resident shared that supply may be interrupted on Saturday morning for pipeline work. This notice has not been confirmed with the water department.", "water", 1, "Anita Joshi", "Ward 24 (general notice)", 0, 2, "information"],
  ["Neighbour notice: residents meeting on monsoon preparedness", "Residents are planning an informal meeting at Shastri Nagar Park to list drains and low-lying lanes to report before the rains.", "drainage", 1, "Dev Agarwal", "Shastri Nagar Park", 0, 4, "information"],
  ["Open manhole cover near the school gate was replaced", "A missing manhole cover near the school gate was a hazard for children. A new cover was fitted and residents confirmed it is secure.", "drainage", 7, "Rohit Verma", "School gate, Lane 2", 12, 45],
] as const;

function makeInitialDemoData(): DemoData {
  const issues = issueSeeds.map((seed, index): DemoIssue => {
    const [title, description, category, stage, author, locationText, affectedCount, days, kind] = seed;
    return {
      id: index + 1,
      kind: kind ?? "problem",
      title,
      description,
      category,
      stage,
      author,
      locationText,
      locationSimulated: true,
      department: kind === "information" ? null : categoryOf(category).department,
      complaintRef: null,
      authorityNote: null,
      affectedCount,
      createdAt: ago(days),
      updatedAt: ago(Math.max(0, days - 2)),
    };
  });

  const timeline: DemoTimelineEvent[] = [];
  for (const issue of issues.filter((item) => item.kind === "problem")) {
    for (let stage = 1; stage <= issue.stage; stage += 1) {
      timeline.push({
        id: timeline.length + 1,
        issueId: issue.id,
        stage,
        label: [
          "Reported",
          "Community confirmed",
          "Sent to authority",
          "Authority acknowledged",
          "Work in progress",
          "Authority reported resolved",
          "Community verified resolved",
        ][stage - 1],
        note: stage === 1 ? "Problem posted in the Ward 24 demo." : null,
        actor: stage === 1 ? issue.author : stage === 2 || stage === 7 ? "Community" : "Resident-reported",
        source: stage === 2 || stage === 7 ? "community" : stage >= 4 ? "authority-reported" : "resident",
        createdAt: new Date(issue.createdAt.getTime() + (issue.stage - stage) * 86_400_000),
      });
    }
  }

  const evidence: DemoEvidence[] = issues
    .filter((issue) => issue.id === 1 || issue.id === 3 || issue.id === 5)
    .map((issue, index) => ({
      id: index + 1,
      issueId: issue.id,
      phase: "before",
      caption: `Demo evidence for ${issue.title}`,
      imageUrl: null,
      addedBy: issue.author,
      createdAt: issue.createdAt,
    }));

  const comments: DemoComment[] = [
    { id: 1, issueId: 1, author: "Anita Joshi", body: "My scooter slipped here yesterday. Please prioritise this before the next rain.", createdAt: ago(8) },
    { id: 2, issueId: 3, author: "Meera Sharma", body: "The overflowing bins are blocking the footpath.", createdAt: ago(3) },
  ];
  const verifications: DemoVerification[] = [
    { id: 1, issueId: 4, resident: "Rohit Verma", verdict: "fixed", note: "Water is no longer spilling on my side of the lane.", createdAt: ago(1) },
    { id: 2, issueId: 4, resident: "Anita Joshi", verdict: "fixed", note: null, createdAt: ago(1) },
    { id: 3, issueId: 5, resident: CURRENT_RESIDENT, verdict: "fixed", note: null, createdAt: ago(5) },
    { id: 4, issueId: 5, resident: "Imran Khan", verdict: "fixed", note: null, createdAt: ago(5) },
    { id: 5, issueId: 5, resident: "Sunita Meena", verdict: "fixed", note: null, createdAt: ago(5) },
  ];
  const confirmations = issues.filter((issue) => issue.kind === "problem").map((issue, index) => ({
    id: index + 1,
    issueId: issue.id,
    resident: issue.author,
    createdAt: issue.createdAt,
  }));

  return { issues, comments, evidence, timeline, verifications, confirmations };
}

export const INITIAL_DEMO_DATA = makeInitialDemoData();

export type IssueRow = DemoIssue & {
  commentCount: number;
  thumbId: number | null;
  thumbUrl: string | null;
  lastEventAt: Date | null;
};

export function getIssues(data: DemoData): IssueRow[] {
  return [...data.issues]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((issue) => ({
      ...issue,
      commentCount: data.comments.filter((comment) => comment.issueId === issue.id).length,
      thumbId: data.evidence.find((item) => item.issueId === issue.id && !!item.imageUrl)?.id ?? null,
      thumbUrl: data.evidence.find((item) => item.issueId === issue.id && !!item.imageUrl)?.imageUrl ?? null,
      lastEventAt: data.timeline.filter((event) => event.issueId === issue.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.createdAt ?? null,
    }));
}

export function getStats(data: DemoData) {
  const all = getIssues(data);
  return {
    unresolved: all.filter(isUnresolved).length,
    resolved: all.filter(isResolved).length,
    total: all.length,
    confirmations: all.filter((issue) => issue.kind === "problem").reduce((sum, issue) => sum + issue.affectedCount, 0),
    awaiting: all.filter((issue) => issue.kind === "problem" && issue.stage === 6).length,
  };
}

export function getIssueDetail(data: DemoData, id: number) {
  const issue = data.issues.find((item) => item.id === id);
  if (!issue) return null;
  const comments = data.comments.filter((item) => item.issueId === id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const evidence = data.evidence.filter((item) => item.issueId === id).map((item) => ({ ...item, hasImage: !!item.imageUrl }));
  const timeline = data.timeline.filter((item) => item.issueId === id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
  const verifications = data.verifications.filter((item) => item.issueId === id);
  return {
    issue,
    comments,
    evidence,
    timeline,
    verifications,
    confirmed: data.confirmations.some((item) => item.issueId === id && item.resident === CURRENT_RESIDENT),
    myVerdict: verifications.find((item) => item.resident === CURRENT_RESIDENT)?.verdict ?? null,
  };
}

export function getContributions(data: DemoData) {
  const all = getIssues(data);
  const byId = new Map(all.map((issue) => [issue.id, issue]));
  return {
    reported: all.filter((issue) => issue.author === CURRENT_RESIDENT),
    confirmed: data.confirmations
      .filter((item) => item.resident === CURRENT_RESIDENT)
      .map((item) => byId.get(item.issueId))
      .filter((issue): issue is IssueRow => !!issue && issue.author !== CURRENT_RESIDENT),
    verified: data.verifications
      .filter((item) => item.resident === CURRENT_RESIDENT)
      .map((item) => ({ verdict: item.verdict, issue: byId.get(item.issueId) }))
      .filter((item): item is { verdict: string; issue: IssueRow } => !!item.issue),
    commentCount: data.comments.filter((item) => item.author === CURRENT_RESIDENT).length,
  };
}

export function getRecentUpdates(data: DemoData, limit = 4) {
  const byId = new Map(data.issues.map((issue) => [issue.id, issue]));
  return data.timeline
    .filter((event) => event.stage > 1 && byId.has(event.issueId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
    .slice(0, limit)
    .map((event) => ({ ...event, title: byId.get(event.issueId)!.title }));
}
