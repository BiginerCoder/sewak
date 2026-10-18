import "server-only";
import { getAuthPool } from "@/lib/auth-profiles";

export type ActivityInput = {
  type: string;
  issueId: number | null;
  payload: Record<string, unknown>;
};

export type StoredActivity = {
  id: number;
  email: string;
  type: string;
  issueId: number | null;
  payload: Record<string, unknown>;
  createdAt: Date;
};

type ActivityRow = {
  id: number;
  email: string;
  event_type: string;
  issue_id: number | null;
  payload: Record<string, unknown>;
  created_at: Date;
};

export async function getResidentActivities(): Promise<StoredActivity[]> {
  const result = await getAuthPool().query<ActivityRow>(
    `SELECT id, email, event_type, issue_id, payload, created_at
     FROM resident_activity
     ORDER BY id`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    type: row.event_type,
    issueId: row.issue_id,
    payload: row.payload,
    createdAt: row.created_at,
  }));
}

export async function recordResidentActivity(
  email: string,
  activity: ActivityInput,
): Promise<number> {
  const [id] = await recordResidentActivities(email, [activity]);
  if (!id) throw new Error("Resident activity was not saved.");
  return id;
}

export async function recordResidentActivities(
  email: string,
  activities: ActivityInput[],
): Promise<number[]> {
  const client = await getAuthPool().connect();
  try {
    await client.query("BEGIN");
    const ids: number[] = [];
    for (const activity of activities) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO resident_activity (email, event_type, issue_id, payload)
         VALUES ($1, $2, $3, $4::jsonb)
         RETURNING id`,
        [email, activity.type, activity.issueId, JSON.stringify(activity.payload)],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error("Resident activity was not saved.");
      ids.push(id);
    }
    await client.query("COMMIT");
    return ids;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordResidentIssue(
  email: string,
  issue: Record<string, unknown>,
  related: Array<Omit<ActivityInput, "issueId">>,
): Promise<number> {
  const client = await getAuthPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO resident_activity (email, event_type, payload)
       VALUES ($1, 'issue_created', '{}'::jsonb)
       RETURNING id`,
      [email],
    );
    const issueId = inserted.rows[0]?.id;
    if (!issueId) throw new Error("The resident report was not created.");
    await client.query(
      `UPDATE resident_activity
       SET issue_id = $1, payload = $2::jsonb
       WHERE id = $1`,
      [issueId, JSON.stringify({ ...issue, id: issueId })],
    );
    for (const activity of related) {
      await client.query(
        `INSERT INTO resident_activity (email, event_type, issue_id, payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [email, activity.type, issueId, JSON.stringify(activity.payload)],
      );
    }
    await client.query("COMMIT");
    return issueId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
