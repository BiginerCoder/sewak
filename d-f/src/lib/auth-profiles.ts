import "server-only";
import { Pool, type QueryResultRow } from "pg";

export type AuthProfile = {
  firebaseUid: string;
  email: string;
  displayName: string;
};

type StoredAuthProfile = AuthProfile & QueryResultRow;

const globalForAuth = globalThis as typeof globalThis & {
  __sewakAuthPool?: Pool;
};

export function getAuthPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to store resident profiles.");
  }

  globalForAuth.__sewakAuthPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  });
  return globalForAuth.__sewakAuthPool;
}

export async function upsertAuthProfile(profile: AuthProfile): Promise<AuthProfile> {
  const result = await getAuthPool().query<StoredAuthProfile>(
    `INSERT INTO auth_profiles (firebase_uid, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (firebase_uid) DO UPDATE
       SET email = EXCLUDED.email,
           display_name = EXCLUDED.display_name,
           updated_at = NOW()
     RETURNING firebase_uid AS "firebaseUid", email, display_name AS "displayName"`,
    [profile.firebaseUid, profile.email, profile.displayName],
  );
  const saved = result.rows[0];
  if (!saved) throw new Error("The resident profile was not saved.");
  return saved;
}

export async function getAuthProfile(firebaseUid: string): Promise<AuthProfile | null> {
  const result = await getAuthPool().query<StoredAuthProfile>(
    `SELECT firebase_uid AS "firebaseUid", email, display_name AS "displayName"
     FROM auth_profiles
     WHERE firebase_uid = $1`,
    [firebaseUid],
  );
  return result.rows[0] ?? null;
}
