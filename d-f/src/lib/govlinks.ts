export type GovlinksHealth = { ok: boolean; demo: boolean };

export type GovlinksWard = {
  ward_id: number;
  ward_number: string;
  ward_name: string | null;
  local_body_id: number;
  local_body: string;
  district_id: number;
  district: string;
  state_id: number;
  state: string;
};

export type GovlinksCategory = {
  category_id: number;
  category_name: string;
  parent: string | null;
  is_fallback: boolean;
};

export type GovlinksResult = {
  link_id: number;
  title: string;
  url: string;
  go_url: string;
  website_name?: string;
  domain?: string;
  action?: string;
  state?: string;
  trust_label?: string;
  official_status?: boolean;
  score: number;
  reason: string;
  multiplier: number;
  c_feedback: number;
  c_usage: number;
  c_relevance: number;
  c_location: number;
  c_trust: number;
};

export type GovlinksRecommendation = {
  query_id: number;
  problem_category: string | null;
  category_source?: string;
  confidence_score?: number;
  used_fallback: boolean;
  results: GovlinksResult[];
  recommended_link: { title: string; url: string; score: number; go_url: string; reason: string } | null;
};

export type GovlinksOutcome = "success" | "failed" | "broken" | "wrong_page";
export type GovlinksFlagReason = "broken" | "wrong_page" | "outdated" | "unsafe" | "spam" | "other";

export class GovlinksApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GovlinksApiError";
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/govlinks/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new GovlinksApiError(0, "Cannot reach the Govlinks API. Check that it is running.");
  }

  const text = await response.text();
  let data: { error?: string } | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string };
    } catch {
      if (response.ok) throw new GovlinksApiError(response.status, "The Govlinks API returned an invalid response.");
    }
  }
  if (!response.ok) {
    throw new GovlinksApiError(response.status, data?.error ?? `Govlinks request failed (${response.status}).`);
  }
  if (data === null) throw new GovlinksApiError(response.status, "The Govlinks API returned an empty response.");
  return data as T;
}

function score(value: number | string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new GovlinksApiError(502, "The Govlinks API returned an invalid ranking score.");
  return numeric;
}

type RawResult = Omit<GovlinksResult, "score" | "multiplier" | "c_feedback" | "c_usage" | "c_relevance" | "c_location" | "c_trust"> & {
  score: number | string;
  multiplier: number | string;
  c_feedback: number | string;
  c_usage: number | string;
  c_relevance: number | string;
  c_location: number | string;
  c_trust: number | string;
};

type RawRecommendation = Omit<GovlinksRecommendation, "recommended_link" | "results"> & {
  results: RawResult[];
  recommended_link: null | (Omit<NonNullable<GovlinksRecommendation["recommended_link"]>, "score"> & { score: number | string });
};

export const govlinks = {
  health: () => request<GovlinksHealth>("health"),
  wards: () => request<GovlinksWard[]>("wards"),
  categories: () => request<GovlinksCategory[]>("categories"),
  recommend: async (input: { query: string; ward_id: number; user_id?: number; category?: string }) => {
    const result = await request<RawRecommendation>("recommendations", { ...input, limit: 5 });
    return {
      ...result,
      results: result.results.map((item) => ({
        ...item,
        score: score(item.score),
        multiplier: score(item.multiplier),
        c_feedback: score(item.c_feedback),
        c_usage: score(item.c_usage),
        c_relevance: score(item.c_relevance),
        c_location: score(item.c_location),
        c_trust: score(item.c_trust),
      })),
      recommended_link: result.recommended_link
        ? { ...result.recommended_link, score: score(result.recommended_link.score) }
        : null,
    };
  },
  visit: (user_id: number, link_id: number, query_id?: number) =>
    request<{ visit_id: number; url: string }>("visits", { user_id, link_id, query_id }),
  outcome: (visit_id: number, outcome: GovlinksOutcome, final_url?: string) =>
    request<{ link_id: number; proposed: unknown }>("outcomes", {
      visit_id,
      outcome,
      ...(final_url ? { final_url } : {}),
    }),
  vote: (user_id: number, link_id: number, vote: 1 | -1, query_id?: number) =>
    request<{ ok: boolean }>("votes", { user_id, link_id, vote, query_id }),
  feedback: (input: {
    user_id: number;
    link_id: number;
    query_id?: number;
    useful?: boolean;
    rating?: number;
    comment?: string;
  }) => request<{ ok: boolean }>("feedback", input),
  flag: (user_id: number, link_id: number, reason: GovlinksFlagReason) =>
    request<{ ok: boolean }>("flags", { user_id, link_id, reason }),
  devUser: (established: boolean) =>
    request<{ user_id: number; established: boolean }>("dev/user", { established }),
};
