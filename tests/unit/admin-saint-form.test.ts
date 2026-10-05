import { describe, expect, it } from "vitest";
import { parseSaintForm, saintRow } from "@/lib/admin/saint-form";

const ID = "00000000-0000-4000-8000-000000000001";

function form(values: Record<string, string>) {
  const data = new FormData();
  const base = {
    slug: "francis-xavier",
    sourceId: ID,
    status: "draft",
    nameEn: "Saint Francis Xavier",
    nameTa: "புனித பிரான்சிஸ் சவேரியார்",
    feastMonth: "12",
    feastDay: "3",
    birthYear: "1506",
    deathYear: "1552",
    biographyEn: "A Basque nobleman…",
  };
  for (const [k, v] of Object.entries({ ...base, ...values })) data.set(k, v);
  return data;
}

describe("saint form", () => {
  it("accepts a complete saint and maps it to a row", () => {
    const parsed = parseSaintForm(form({}));
    expect(parsed.success).toBe(true);
    expect(saintRow(parsed.data!)).toMatchObject({
      slug: "francis-xavier",
      feast_month: 12,
      feast_day: 3,
      birth_year: 1506,
      death_year: 1552,
      title_en: null,
      biography_ta: null,
    });
  });

  it("requires names in both languages", () => {
    expect(parseSaintForm(form({ nameTa: "" })).success).toBe(false);
  });

  it("allows no feast day but not half of one", () => {
    expect(parseSaintForm(form({ feastMonth: "", feastDay: "" })).success).toBe(true);
    const half = parseSaintForm(form({ feastDay: "" }));
    expect(half.error?.issues[0].message).toBe("feast_incomplete");
  });

  it("rejects days that do not exist", () => {
    expect(parseSaintForm(form({ feastMonth: "2", feastDay: "30" })).error?.issues[0].message).toBe("feast_invalid");
    expect(parseSaintForm(form({ feastMonth: "2", feastDay: "29" })).success).toBe(true);
  });

  it("checks the order of the years", () => {
    expect(parseSaintForm(form({ birthYear: "1600" })).error?.issues[0].message).toBe("years_order");
  });

  it("needs a biography to publish", () => {
    expect(parseSaintForm(form({ biographyEn: "", status: "draft" })).success).toBe(true);
    expect(parseSaintForm(form({ biographyEn: "", status: "published" })).error?.issues[0].message).toBe(
      "biography_required",
    );
  });

  it("rejects bad slugs and statuses", () => {
    expect(parseSaintForm(form({ slug: "Francis Xavier" })).success).toBe(false);
    expect(parseSaintForm(form({ status: "live" })).success).toBe(false);
  });
});
