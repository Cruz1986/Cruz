import { publicSaints } from "@/lib/content/saints";
import { DEFAULT_CALENDAR } from "@/lib/content/today";
import { DEFAULT_TIME_ZONE } from "@/lib/i18n/request";
import { parseIsoDate, todayIn, toIso } from "@/lib/liturgy/plain-date";
import { saintSummaryJson } from "@/lib/saints/api";
import { apiError, json } from "@/lib/api";

/** GET /api/saints/today[?date=YYYY-MM-DD] — the saints of the day (India's date by default). */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("date");
  const date = raw ? parseIsoDate(raw) : todayIn(DEFAULT_TIME_ZONE);
  if (!date) return apiError(400, "invalid_date", "date must be YYYY-MM-DD.");
  const iso = toIso(date);
  const saints = await publicSaints.ofDay(DEFAULT_CALENDAR, iso);
  return json({ date: iso, saints: saints.map(saintSummaryJson) }, { maxAge: raw ? 3600 : 300 });
}
