import { publicSaints } from "@/lib/content/saints";
import { saintSummaryJson } from "@/lib/saints/api";
import { apiError, json } from "@/lib/api";

/** GET /api/saints[?month=1-12] — published saints in calendar order. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("month");
  const month = raw === null ? null : Number(raw);
  if (month !== null && !(Number.isInteger(month) && month >= 1 && month <= 12))
    return apiError(400, "invalid_month", "month must be 1-12.");
  const saints = await publicSaints.list();
  return json(
    { saints: saints.filter((s) => month === null || s.feastMonth === month).map(saintSummaryJson) },
    { maxAge: 3600 },
  );
}
