import { getAuthPool } from "@/lib/auth-profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getAuthPool().query(
      "SELECT to_regclass('public.resident_activity') IS NOT NULL AS activity_table_ready",
    );
    if (!result.rows[0]?.activity_table_ready) {
      return Response.json({ ok: false, mode: "postgres-persistent", error: "Resident activity migration is required." }, { status: 503 });
    }
    return Response.json({ ok: true, mode: "postgres-persistent" });
  } catch (error) {
    console.error("Application health check failed:", error);
    return Response.json({ ok: false, mode: "postgres-persistent", error: "Application database is unavailable." }, { status: 503 });
  }
}
