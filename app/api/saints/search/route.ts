import { publicSaints } from "@/lib/content/saints";
import { searchSaints } from "@/lib/saints/helpers";
import { saintSummaryJson } from "@/lib/saints/api";
import { apiError, json } from "@/lib/api";

const LIMIT = 20;

/** GET /api/saints/search?q= — saints by name, title or patronage (Tamil or English). */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return apiError(400, "query_too_short", "q must have at least 2 characters.");
  if (q.length > 100) return apiError(400, "query_too_long", "q must have at most 100 characters.");
  const results = searchSaints(await publicSaints.list(), q);
  return json(
    { query: q, total: results.length, results: results.slice(0, LIMIT).map(saintSummaryJson) },
    { maxAge: 3600 },
  );
}
