/**
 * Writes generated liturgical days into the database.
 *
 *   pnpm calendar:generate --calendar in --from 2025 --to 2030
 *
 * Days marked is_override are left untouched. Lectionary sets must be imported first so each
 * day can point at its readings; days whose sets are missing are reported.
 */
import { parseArgs } from "node:util";
import postgres from "postgres";
import { CALENDARS, liturgicalYear, type CalendarCode, type LiturgicalDay } from "@/lib/liturgy";
import { FIXED_FEASTS } from "@/lib/liturgy/data/fixed-feasts";
import { MASS_SETS, lectionaryCandidates } from "@/lib/liturgy/lectionary";
import { rankOf } from "@/lib/liturgy/ranks";
import { colorOf } from "@/lib/liturgy/generate";
import { dayTitle } from "@/lib/liturgy/titles";
import { toIso } from "@/lib/liturgy/plain-date";

const KIND_FOR_TYPE = (type: string): string =>
  type.startsWith("Solemnity")
    ? "solemnity"
    : type.startsWith("Feast")
      ? "feast"
      : type.startsWith("OpMem")
        ? "optional_memorial"
        : "memorial";

const NAMED_MEMORIALS = [
  { code: "OW00-ImmaculateHeart", type: "Mem-Mary" },
  { code: "OW00-MaryMotherofChurch", type: "Mem-Mary" },
  { code: "Mem-Mary-Sat", type: "Mem-Mary-Sat" },
];

/** One definition per code: the current entry wins over ones removed from the calendar. */
function currentFeasts(calendar: CalendarCode) {
  const byCode = new Map<string, (typeof FIXED_FEASTS)[number]>();
  for (const f of FIXED_FEASTS) {
    if (calendar !== "in" && f.code.startsWith("IN ")) continue;
    const existing = byCode.get(f.code);
    if (!existing || (existing.removed !== undefined && (f.removed === undefined || f.removed > existing.removed)))
      byCode.set(f.code, f);
  }
  return [...byCode.values()];
}

async function main() {
  const { values } = parseArgs({
    options: { calendar: { type: "string", default: "in" }, from: { type: "string" }, to: { type: "string" } },
  });
  const calendar = values.calendar as CalendarCode;
  if (!(calendar in CALENDARS)) throw new Error(`Unknown calendar ${calendar}`);
  const from = Number(values.from ?? new Date().getFullYear());
  const to = Number(values.to ?? from);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await sql.begin(async (tx) => {
      const [cal] = await tx<
        { id: string; parent_id: string | null }[]
      >`select id, parent_id from public.liturgical_calendars where code = ${calendar}`;
      if (!cal) throw new Error(`Calendar ${calendar} is not seeded`);
      const generalId = cal.parent_id ?? cal.id;

      // Celebration definitions (fixed feasts and named memorials), upserted by code.
      const celebrationRows = [
        ...currentFeasts(calendar).map((f) => ({
          code: f.code,
          calendar_id: f.code.startsWith("IN ") ? cal.id : generalId,
          name_en: f.code.replace(/^IN /, ""),
          name_ta: f.nameTa,
          rank: KIND_FOR_TYPE(f.type),
          precedence: rankOf(f.month === 11 && f.day === 2 ? "All Souls" : f.type),
          color: colorOf(f.code, f.type),
          month: f.month,
          day: f.day,
          added_year: f.added ?? null,
          removed_year: f.removed ?? null,
          type_code: f.type,
        })),
        ...NAMED_MEMORIALS.map((m) => ({
          code: m.code,
          calendar_id: generalId,
          name_en: dayTitle(m.code, false).en,
          name_ta: dayTitle(m.code, false).ta,
          rank: "memorial",
          precedence: rankOf(m.type),
          color: "white",
          month: null,
          day: null,
          added_year: null,
          removed_year: null,
          type_code: m.type,
        })),
      ];
      const celebrations = await tx<{ id: string; code: string }[]>`
        insert into public.celebrations ${tx(celebrationRows)}
        on conflict (code) do update set
          name_en = excluded.name_en, name_ta = excluded.name_ta, rank = excluded.rank, precedence = excluded.precedence,
          color = excluded.color, month = excluded.month, day = excluded.day, added_year = excluded.added_year,
          removed_year = excluded.removed_year, type_code = excluded.type_code
        returning id, code`;
      const celebrationIds = new Map(celebrations.map((c) => [c.code, c.id]));
      const setIds = new Map(
        (await tx<{ id: string; code: string }[]>`select id, code from public.lectionary_sets`).map((s) => [
          s.code,
          s.id,
        ]),
      );
      const missing = new Set<string>();

      const setsFor = (code: string, day: LiturgicalDay) =>
        lectionaryCandidates(code, day).filter((c) => setIds.has(c));

      for (let year = from; year <= to; year++) {
        const days = liturgicalYear(year, calendar);
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        await tx`delete from public.liturgical_days where calendar_id = ${cal.id} and date between ${start} and ${end} and not is_override`;
        const overrides = new Set(
          (
            await tx<
              { date: Date }[]
            >`select date from public.liturgical_days where calendar_id = ${cal.id} and date between ${start} and ${end}`
          ).map((r) => r.date.toISOString().slice(0, 10)),
        );

        const dayRows = days
          .filter((d) => !overrides.has(toIso(d.date)))
          .map((d) => ({
            calendar_id: cal.id,
            date: toIso(d.date),
            season: d.season,
            week_number: d.week,
            sunday_cycle: d.sundayCycle,
            weekday_cycle: d.weekdayCycle,
            color: d.color,
            day_code: d.celebrations[0].code,
            ferial_code: d.ferialCode,
            title_en: d.celebrations[0].titleEn,
            title_ta: d.celebrations[0].titleTa,
            precedence: d.celebrations[0].rank,
            kind: d.celebrations[0].kind,
          }));
        const inserted = await tx<
          { id: string; date: Date }[]
        >`insert into public.liturgical_days ${tx(dayRows)} returning id, date`;
        const dayIds = new Map(inserted.map((r) => [r.date.toISOString().slice(0, 10), r.id]));

        const links: { day_id: string; celebration_id: string; is_primary: boolean; sort_order: number }[] = [];
        const masses: {
          day_id: string;
          lectionary_set_id: string;
          celebration_id: string | null;
          mass_key: string;
          role: string;
          sort_order: number;
        }[] = [];
        for (const d of days) {
          const dayId = dayIds.get(toIso(d.date));
          if (!dayId) continue;
          d.celebrations.forEach((c, i) => {
            const id = celebrationIds.get(c.code);
            if (id) links.push({ day_id: dayId, celebration_id: id, is_primary: i === 0, sort_order: i });
          });

          const main = d.celebrations[0];
          const special = MASS_SETS[main.code];
          if (special) {
            special.forEach((m, i) => {
              const set = setIds.get(m.set);
              if (set)
                masses.push({
                  day_id: dayId,
                  lectionary_set_id: set,
                  celebration_id: celebrationIds.get(main.code) ?? null,
                  mass_key: m.key,
                  role: "base",
                  sort_order: i,
                });
            });
          } else {
            const sets = setsFor(main.code, d);
            if (sets.length === 0) missing.add(main.code);
            sets.forEach((s, i) =>
              masses.push({
                day_id: dayId,
                lectionary_set_id: setIds.get(s)!,
                celebration_id: celebrationIds.get(main.code) ?? null,
                mass_key: "day",
                role: "base",
                sort_order: i,
              }),
            );
            const vigil = setIds.get(`${main.code} - Vigil`);
            if (vigil)
              masses.push({
                day_id: dayId,
                lectionary_set_id: vigil,
                celebration_id: celebrationIds.get(main.code) ?? null,
                mass_key: "vigil",
                role: "base",
                sort_order: 0,
              });
            if (main.code === "LW06-4Thu" && setIds.has("LW06-4Thu~Chrism")) {
              masses.push({
                day_id: dayId,
                lectionary_set_id: setIds.get("LW06-4Thu~Chrism")!,
                celebration_id: null,
                mass_key: "chrism",
                role: "base",
                sort_order: 0,
              });
            }
          }
          d.celebrations.slice(1).forEach((c, i) => {
            for (const s of setsFor(c.code, d)) {
              masses.push({
                day_id: dayId,
                lectionary_set_id: setIds.get(s)!,
                celebration_id: celebrationIds.get(c.code) ?? null,
                mass_key: "day",
                role: "memorial",
                sort_order: 10 + i,
              });
            }
          });
        }
        for (let i = 0; i < links.length; i += 1000)
          await tx`insert into public.liturgical_day_celebrations ${tx(links.slice(i, i + 1000))} on conflict do nothing`;
        for (let i = 0; i < masses.length; i += 1000)
          await tx`insert into public.liturgical_day_masses ${tx(masses.slice(i, i + 1000))} on conflict do nothing`;
        console.log(
          `${calendar} ${year}: ${dayRows.length} days, ${links.length} celebrations, ${masses.length} reading sets`,
        );
      }
      if (missing.size) console.log(`No lectionary readings for: ${[...missing].sort().join(", ")}`);
    });
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
