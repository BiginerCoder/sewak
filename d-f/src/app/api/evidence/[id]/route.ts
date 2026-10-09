import { db } from "@/db";
import { evidence } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new Response("Not found", { status: 404 });
  const [row] = await db.select({ url: evidence.imageUrl }).from(evidence).where(eq(evidence.id, n));
  if (!row?.url) return new Response("Not found", { status: 404 });

  if (row.url.startsWith("/")) {
    return Response.redirect(new URL(row.url, req.url), 307);
  }
  const m = row.url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600" },
  });
}
