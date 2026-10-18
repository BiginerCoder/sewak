import { getCivicStore } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new Response("Not found", { status: 404 });
  const store = await getCivicStore();
  const row = store.evidence.find((item) => item.id === n);
  if (!row?.imageUrl) return new Response("Not found", { status: 404 });

  if (row.imageUrl.startsWith("/")) {
    return Response.redirect(new URL(row.imageUrl, req.url), 307);
  }
  const m = row.imageUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=3600" },
  });
}
