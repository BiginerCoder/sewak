import { db } from "@/db";
import {
  comments,
  confirmations,
  evidence,
  issues,
  timelineEvents,
  verifications,
} from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { CURRENT_RESIDENT, isResolved, isUnresolved } from "./constants";

/* ------------------------------------------------------------------ */
/* Demo seed. Runs once when the issues table is empty.                */
/* ------------------------------------------------------------------ */

const ago = (days: number, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600 * 1000);

let seeding: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seeding) seeding = seed().catch((e) => {
    seeding = null;
    throw e;
  });
  return seeding;
}

async function seed() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(issues);
    if (n > 0) return;

    type Seed = {
      kind?: string;
      title: string;
      description: string;
      category: string;
      stage: number;
      author: string;
      location: string;
      department: string | null;
      ref?: string;
      note?: string;
      affected: number;
      days: number;
    };

    const rows: Seed[] = [
      {
        title: "Deep pothole on Gandhi Path near Shastri Nagar Circle",
        description:
          "A pothole roughly a foot deep has formed at the turn before the circle. Two-wheelers swerve into the oncoming lane to avoid it, especially after dark. It has been growing since the last rain.",
        category: "roads", stage: 5, author: "Rohit Verma", location: "Gandhi Path, near Shastri Nagar Circle",
        department: "Roads & Public Works (Municipal Corporation)", ref: "DEMO-RD-20417",
        note: "Crew visit reported by residents: pothole marked for patching.", affected: 34, days: 12,
      },
      {
        title: "Six streetlights out on Lane 4",
        description:
          "Six consecutive streetlights have not worked for over a week. The lane is completely dark after 7 pm and women and senior residents have stopped using it to walk home.",
        category: "streetlights", stage: 4, author: "Anita Joshi", location: "Lane 4, Shastri Nagar",
        department: "Street Lighting (Municipal Corporation)", ref: "DEMO-SL-11882",
        note: "Complaint acknowledged; inspection date not shared yet.", affected: 18, days: 7,
      },
      {
        title: "Garbage not collected for five days in Block C",
        description:
          "The collection vehicle has skipped Block C since last Monday. Bins are overflowing onto the footpath and there is a strong smell. Stray animals are spreading the waste.",
        category: "sanitation", stage: 3, author: CURRENT_RESIDENT, location: "Block C, Shastri Nagar",
        department: "Sanitation & Solid Waste (Municipal Corporation)", ref: "DEMO-SW-77031",
        note: "Complaint lodged by the reporter; awaiting acknowledgement.", affected: 27, days: 5,
      },
      {
        title: "Sewage overflowing near the community water tank",
        description:
          "Sewage from a blocked line has been spilling onto the lane next to the community water tank. Children walk through it on the way to school and the smell reaches nearby homes.",
        category: "drainage", stage: 6, author: "Imran Khan", location: "Near community water tank, Sector 2",
        department: "Drainage & Sewerage (Municipal Corporation)", ref: "DEMO-DR-30519",
        note: "Authority reports the line as cleared. Residents have not verified it yet.", affected: 21, days: 16,
      },
      {
        title: "Waterlogging on 60 Feet Road after every rain",
        description:
          "The storm drain on 60 Feet Road was choked with silt, so the road flooded within an hour of rain and shops had to close. The drain needed desilting before the monsoon.",
        category: "drainage", stage: 7, author: "Sunita Meena", location: "60 Feet Road, Shastri Nagar",
        department: "Drainage & Sewerage (Municipal Corporation)", ref: "DEMO-DR-28804",
        note: "Desilting completed; residents verified after the next rain.", affected: 15, days: 30,
      },
      {
        title: "Broken swings and overgrown grass at Shastri Nagar Park",
        description:
          "Two swings are broken with exposed metal edges and the grass has grown above knee height near the play area. Children are still using the equipment.",
        category: "parks", stage: 2, author: "Dev Agarwal", location: "Shastri Nagar Park, play area",
        department: "Horticulture & Parks (Municipal Corporation)", affected: 9, days: 3,
      },
      {
        title: "Illegal dumping on the vacant plot behind Block F",
        description:
          "Construction debris and household waste are being dumped at night on the vacant plot behind Block F. The pile is spreading toward the lane.",
        category: "sanitation", stage: 1, author: "Kavita Singh", location: "Vacant plot behind Block F",
        department: "Sanitation & Solid Waste (Municipal Corporation)", affected: 2, days: 1,
      },
      {
        kind: "information",
        title: "Neighbour notice: water supply may pause on Saturday morning",
        description:
          "A resident shared that supply may be interrupted on Saturday morning for pipeline work. This notice is resident-shared and has not been confirmed with the water department. Store water as a precaution.",
        category: "water", stage: 1, author: "Anita Joshi", location: "Ward 24 (general notice)",
        department: null, affected: 0, days: 2,
      },
      {
        kind: "information",
        title: "Neighbour notice: residents meeting on monsoon preparedness",
        description:
          "Residents are planning an informal meeting at Shastri Nagar Park to list drains and low-lying lanes to report before the rains. Shared by a resident as a demo announcement; confirm any official event with the ward office.",
        category: "drainage", stage: 1, author: "Dev Agarwal", location: "Shastri Nagar Park",
        department: null, affected: 0, days: 4,
      },
      {
        title: "Open manhole cover near the school gate was replaced",
        description:
          "A missing manhole cover near the school gate was a hazard for children. After the complaint, a new cover was fitted and residents confirmed it is secure.",
        category: "drainage", stage: 7, author: "Rohit Verma", location: "School gate, Lane 2",
        department: "Drainage & Sewerage (Municipal Corporation)", ref: "DEMO-DR-25100",
        note: "Cover fitted; verified by residents.", affected: 12, days: 45,
      },
    ];

    const inserted = await tx
      .insert(issues)
      .values(
        rows.map((r) => ({
          kind: r.kind ?? "problem",
          title: r.title,
          description: r.description,
          category: r.category,
          stage: r.stage,
          author: r.author,
          locationText: r.location,
          locationSimulated: true,
          department: r.department,
          complaintRef: r.ref ?? null,
          authorityNote: r.note ?? null,
          affectedCount: r.affected,
          createdAt: ago(r.days),
          updatedAt: ago(Math.max(0, r.days - 2)),
        })),
      )
      .returning({ id: issues.id });
    const id = (n: number) => inserted[n - 1].id;

    type T = [number, number, string, string | null, string, "resident" | "authority-reported" | "community" | "system", number];
    const t: T[] = [
      [1, 1, "Reported", "Problem posted with a photo.", "Rohit Verma", "resident", 12],
      [1, 2, "Community confirmed", "Three or more neighbours confirmed they are affected.", "Community", "community", 10],
      [1, 3, "Sent to authority", "Complaint lodged with the roads department.", "Rohit Verma", "resident", 9],
      [1, 4, "Authority acknowledged", "Reference DEMO-RD-20417 recorded; inspection scheduled.", "Authority (as reported by resident)", "authority-reported", 6],
      [1, 5, "Work in progress", "A crew marked the pothole for patching.", "Authority (as reported by resident)", "authority-reported", 1],
      [2, 1, "Reported", "Problem posted.", "Anita Joshi", "resident", 7],
      [2, 2, "Community confirmed", "Neighbours on Lane 4 confirmed.", "Community", "community", 6],
      [2, 3, "Sent to authority", "Complaint lodged with street lighting.", "Anita Joshi", "resident", 5],
      [2, 4, "Authority acknowledged", "Acknowledgement received, no inspection date yet.", "Authority (as reported by resident)", "authority-reported", 3],
      [3, 1, "Reported", "Problem posted.", CURRENT_RESIDENT, "resident", 5],
      [3, 2, "Community confirmed", "Block C residents confirmed.", "Community", "community", 4],
      [3, 3, "Sent to authority", "Complaint lodged with sanitation.", CURRENT_RESIDENT, "resident", 3],
      [4, 1, "Reported", "Problem posted.", "Imran Khan", "resident", 16],
      [4, 2, "Community confirmed", "Neighbours confirmed.", "Community", "community", 14],
      [4, 3, "Sent to authority", "Complaint lodged with drainage.", "Imran Khan", "resident", 13],
      [4, 4, "Authority acknowledged", "Acknowledged by the department.", "Authority (as reported by resident)", "authority-reported", 10],
      [4, 5, "Work in progress", "Desilting crew visited.", "Authority (as reported by resident)", "authority-reported", 6],
      [4, 6, "Authority reported resolved", "Authority marked the work complete. Awaiting resident verification.", "Authority (as reported by resident)", "authority-reported", 2],
      [5, 1, "Reported", "Problem posted with photo.", "Sunita Meena", "resident", 30],
      [5, 2, "Community confirmed", "Shopkeepers and residents confirmed.", "Community", "community", 28],
      [5, 3, "Sent to authority", "Complaint lodged.", "Sunita Meena", "resident", 26],
      [5, 4, "Authority acknowledged", "Acknowledged.", "Authority (as reported by resident)", "authority-reported", 22],
      [5, 5, "Work in progress", "Desilting started.", "Authority (as reported by resident)", "authority-reported", 15],
      [5, 6, "Authority reported resolved", "Authority marked work complete.", "Authority (as reported by resident)", "authority-reported", 9],
      [5, 7, "Community verified resolved", "Residents confirmed the road stayed clear after rain.", "Community", "community", 5],
      [6, 1, "Reported", "Problem posted.", "Dev Agarwal", "resident", 3],
      [6, 2, "Community confirmed", "Parents and neighbours confirmed.", "Community", "community", 1],
      [7, 1, "Reported", "Problem posted.", "Kavita Singh", "resident", 1],
      [10, 1, "Reported", "Problem posted.", "Rohit Verma", "resident", 45],
      [10, 2, "Community confirmed", "Neighbours confirmed.", "Community", "community", 44],
      [10, 3, "Sent to authority", "Complaint lodged.", "Rohit Verma", "resident", 42],
      [10, 4, "Authority acknowledged", "Acknowledged.", "Authority (as reported by resident)", "authority-reported", 40],
      [10, 5, "Work in progress", "Replacement started.", "Authority (as reported by resident)", "authority-reported", 36],
      [10, 6, "Authority reported resolved", "New cover fitted.", "Authority (as reported by resident)", "authority-reported", 33],
      [10, 7, "Community verified resolved", "Residents confirmed the cover is secure.", "Community", "community", 30],
    ];
    await tx.insert(timelineEvents).values(
      t.map(([i, stage, label, note, actor, source, days]) => ({
        issueId: id(i), stage, label, note, actor, source, createdAt: ago(days),
      })),
    );

    await tx.insert(evidence).values([
      { issueId: id(1), phase: "before", caption: "Pothole at the turn before the circle", imageUrl: "/evidence/pothole.jpg", addedBy: "Rohit Verma", createdAt: ago(12) },
      { issueId: id(2), phase: "before", caption: "Lane 4 after 7 pm", imageUrl: "/evidence/streetlight.jpg", addedBy: "Anita Joshi", createdAt: ago(7) },
      { issueId: id(3), phase: "before", caption: "Overflowing bins at Block C", imageUrl: "/evidence/garbage.jpg", addedBy: CURRENT_RESIDENT, createdAt: ago(5) },
      { issueId: id(4), phase: "before", caption: "Photo not provided: description from the reporter only", imageUrl: null, addedBy: "Imran Khan", createdAt: ago(16) },
      { issueId: id(5), phase: "before", caption: "60 Feet Road flooded after rain", imageUrl: "/evidence/waterlogging-before.jpg", addedBy: "Sunita Meena", createdAt: ago(30) },
      { issueId: id(5), phase: "after", caption: "Road clear after drain desilting", imageUrl: "/evidence/waterlogging-after.jpg", addedBy: "Sunita Meena", createdAt: ago(5) },
    ]);

    await tx.insert(comments).values([
      { issueId: id(1), author: "Anita Joshi", body: "My scooter slipped here yesterday. Please prioritise this before the next rain.", createdAt: ago(8) },
      { issueId: id(1), author: "Dev Agarwal", body: "A crew was marking the road this morning. Hopefully the patching follows soon.", createdAt: ago(1) },
      { issueId: id(2), author: "Sunita Meena", body: "Lane 4 is unsafe after dark. Confirming from my side.", createdAt: ago(6) },
      { issueId: id(3), author: "Kavita Singh", body: "Block D is facing the same problem since Tuesday.", createdAt: ago(3) },
      { issueId: id(4), author: "Rohit Verma", body: "The smell has reduced a lot since the crew came.", createdAt: ago(2) },
      { issueId: id(5), author: "Imran Khan", body: "It rained heavily last night and the road stayed clear. Great outcome.", createdAt: ago(5) },
    ]);

    await tx.insert(confirmations).values(
      [1, 3, 5, 10].map((i) => ({ issueId: id(i), resident: CURRENT_RESIDENT, createdAt: ago(1) })),
    );

    await tx.insert(verifications).values([
      { issueId: id(4), resident: "Rohit Verma", verdict: "fixed", note: "Water is no longer spilling on my side of the lane.", createdAt: ago(1) },
      { issueId: id(4), resident: "Anita Joshi", verdict: "fixed", note: null, createdAt: ago(1) },
      { issueId: id(5), resident: CURRENT_RESIDENT, verdict: "fixed", note: null, createdAt: ago(5) },
      { issueId: id(5), resident: "Imran Khan", verdict: "fixed", note: null, createdAt: ago(5) },
      { issueId: id(5), resident: "Sunita Meena", verdict: "fixed", note: null, createdAt: ago(5) },
    ]);
  });
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export type IssueRow = Awaited<ReturnType<typeof getIssues>>[number];

export async function getIssues() {
  await ensureSeeded();
  return db
    .select({
      id: issues.id,
      kind: issues.kind,
      title: issues.title,
      description: issues.description,
      category: issues.category,
      stage: issues.stage,
      author: issues.author,
      locationText: issues.locationText,
      department: issues.department,
      complaintRef: issues.complaintRef,
      affectedCount: issues.affectedCount,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      commentCount: sql<number>`(select count(*)::int from comments c where c.issue_id = ${issues.id})`,
      thumbId: sql<number | null>`(select e.id from evidence e where e.issue_id = ${issues.id} and e.image_url is not null order by e.id limit 1)`,
      lastEventAt: sql<Date | null>`(select max(t.created_at) from timeline_events t where t.issue_id = ${issues.id})`,
    })
    .from(issues)
    .orderBy(desc(issues.createdAt));
}

export async function getStats() {
  const all = await getIssues();
  return {
    unresolved: all.filter(isUnresolved).length,
    resolved: all.filter(isResolved).length,
    total: all.length,
    confirmations: all.filter((i) => i.kind === "problem").reduce((s, i) => s + i.affectedCount, 0),
    awaiting: all.filter((i) => i.kind === "problem" && i.stage === 6).length,
  };
}

export async function getIssueDetail(id: number) {
  await ensureSeeded();
  const [issue] = await db.select().from(issues).where(eq(issues.id, id));
  if (!issue) return null;
  const [cs, ev, tl, vs, mine] = await Promise.all([
    db.select().from(comments).where(eq(comments.issueId, id)).orderBy(asc(comments.createdAt)),
    db.select().from(evidence).where(eq(evidence.issueId, id)).orderBy(asc(evidence.createdAt)),
    db.select().from(timelineEvents).where(eq(timelineEvents.issueId, id)).orderBy(asc(timelineEvents.createdAt), asc(timelineEvents.id)),
    db.select().from(verifications).where(eq(verifications.issueId, id)).orderBy(asc(verifications.createdAt)),
    db
      .select()
      .from(confirmations)
      .where(and(eq(confirmations.issueId, id), eq(confirmations.resident, CURRENT_RESIDENT))),
  ]);
  return {
    issue,
    comments: cs,
    evidence: ev.map((e) => ({ id: e.id, phase: e.phase, caption: e.caption, hasImage: !!e.imageUrl, addedBy: e.addedBy, createdAt: e.createdAt })),
    timeline: tl,
    verifications: vs,
    confirmed: mine.length > 0,
    myVerdict: vs.find((v) => v.resident === CURRENT_RESIDENT)?.verdict ?? null,
  };
}

export async function getContributions() {
  await ensureSeeded();
  const all = await getIssues();
  const mineConf = await db.select().from(confirmations).where(eq(confirmations.resident, CURRENT_RESIDENT));
  const mineVer = await db.select().from(verifications).where(eq(verifications.resident, CURRENT_RESIDENT));
  const [{ n: commentCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.author, CURRENT_RESIDENT));
  const byId = new Map(all.map((i) => [i.id, i]));
  return {
    reported: all.filter((i) => i.author === CURRENT_RESIDENT),
    confirmed: mineConf.map((c) => byId.get(c.issueId)).filter((i): i is IssueRow => !!i && i.author !== CURRENT_RESIDENT),
    verified: mineVer.map((v) => ({ verdict: v.verdict, issue: byId.get(v.issueId) })).filter((v) => !!v.issue) as { verdict: string; issue: IssueRow }[],
    commentCount,
  };
}

export async function getRecentUpdates(limit = 4) {
  await ensureSeeded();
  return db
    .select({
      id: timelineEvents.id,
      issueId: timelineEvents.issueId,
      label: timelineEvents.label,
      source: timelineEvents.source,
      createdAt: timelineEvents.createdAt,
      title: issues.title,
    })
    .from(timelineEvents)
    .innerJoin(issues, eq(issues.id, timelineEvents.issueId))
    .where(sql`${timelineEvents.stage} > 1`)
    .orderBy(desc(timelineEvents.createdAt), desc(timelineEvents.id))
    .limit(limit);
}
