import { NextRequest } from "next/server";

const API_METHODS: Record<string, string> = {
  health: "GET",
  wards: "GET",
  categories: "GET",
  recommendations: "POST",
  visits: "POST",
  outcomes: "POST",
  votes: "POST",
  feedback: "POST",
  flags: "POST",
  "dev/user": "POST",
};

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const { path: segments } = await context.params;
  const path = segments.join("/");
  const isGoPath = segments.length === 2 && segments[0] === "go" && /^\d+$/.test(segments[1]);
  if (isGoPath ? request.method !== "GET" : API_METHODS[path] !== request.method) {
    return Response.json({ error: "Govlinks endpoint not found." }, { status: 404 });
  }

  let base: URL;
  try {
    base = new URL(process.env.GOVLINKS_API_URL?.trim() || "http://127.0.0.1:8080");
  } catch {
    return Response.json({ error: "GOVLINKS_API_URL must be a valid HTTP(S) origin." }, { status: 500 });
  }
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    return Response.json({ error: "GOVLINKS_API_URL must be a valid HTTP(S) origin." }, { status: 500 });
  }

  const target = new URL(isGoPath ? `/go/${segments[1]}` : `/api/${path}`, base.origin);
  if (isGoPath) target.search = new URL(request.url).search;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: request.method === "POST" ? { "Content-Type": request.headers.get("content-type") ?? "application/json" } : undefined,
      body: request.method === "POST" ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return Response.json({ error: "Cannot reach the Govlinks API. Check that it is running." }, { status: 502 });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-type", "location", "x-visit-id"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const POST = proxy;
