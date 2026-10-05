import { publicRosary } from "@/lib/content/rosary";
import { buildSequence } from "@/lib/rosary/sequence";
import { todaysMysteries } from "@/lib/rosary/today";
import { apiError, json } from "@/lib/api";

/** GET /api/rosary/{joyful|luminous|sorrowful|glorious|today} — mysteries and the guided sequence. */
export async function GET(_request: Request, ctx: RouteContext<"/api/rosary/[set]">) {
  const data = await publicRosary();
  if (!data) return apiError(503, "rosary_unavailable", "The Rosary is not available.");
  const { set: requested } = await ctx.params;
  const key = requested === "today" ? todaysMysteries(data.sets) : requested;
  const set = data.sets.find((s) => s.key === key);
  if (!set) return apiError(404, "set_not_found", "Unknown mystery set.");
  return json(
    {
      set: { key: set.key, name: { en: set.nameEn, ta: set.nameTa }, weekdays: set.weekdays },
      mysteries: data.mysteries[set.key].map((m) => ({
        number: m.number,
        title: { en: m.titleEn, ta: m.titleTa },
        scripture: m.scripture,
        fruit: { en: m.fruitEn, ta: m.fruitTa },
        meditation: { en: m.meditationEn, ta: m.meditationTa },
      })),
      sequence: buildSequence(data.steps).map(({ index, phase, decade, prayerSlug, count, of }) => ({
        index,
        phase,
        decade,
        prayer: prayerSlug,
        count,
        of,
      })),
    },
    { maxAge: requested === "today" ? 300 : 3600 },
  );
}
