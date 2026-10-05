import { describe, expect, it } from "vitest";
import { allowedStatuses, parsePrayerForm, prayerErrorCode } from "@/lib/admin/prayer-form";

const ID = "00000000-0000-4000-8000-000000000001";

function form(values: Record<string, string>) {
  const data = new FormData();
  const base = {
    slug: "our-father",
    categoryId: ID,
    sourceId: ID,
    sortOrder: "1",
    status: "draft",
    titleEn: "Our Father",
    bodyEn: "Our Father…",
  };
  for (const [k, v] of Object.entries({ ...base, ...values })) data.set(k, v);
  return data;
}

describe("prayer form", () => {
  it("accepts a complete English prayer and normalises empty Tamil fields to null", () => {
    const parsed = parsePrayerForm(form({}));
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({ slug: "our-father", titleTa: null, bodyTa: null, sortOrder: 1 });
  });

  it("requires at least one complete language", () => {
    expect(parsePrayerForm(form({ titleEn: "", bodyEn: "" })).success).toBe(false);
  });

  it("requires title and text together", () => {
    expect(parsePrayerForm(form({ titleTa: "தலைப்பு" })).success).toBe(false);
  });

  it.each(["Our Father", "our_father", "-x", "x--y"])("rejects slug %s", (slug) => {
    expect(parsePrayerForm(form({ slug })).success).toBe(false);
  });

  it("lower-cases slugs", () => {
    expect(parsePrayerForm(form({ slug: "Hail-Mary" })).data?.slug).toBe("hail-mary");
  });
});

describe("statuses per role", () => {
  it("editors may only draft or submit for review", () => {
    expect(allowedStatuses(["editor"])).toEqual(["draft", "in_review"]);
    expect(allowedStatuses(["content_admin"])).toContain("published");
  });
});

describe("database error mapping", () => {
  it.each([
    ["23505", "slug_taken"],
    ["23514", "source_not_cleared"],
    ["42501", "forbidden"],
    ["XX000", "failed"],
  ])("%s → %s", (code, expected) => {
    expect(prayerErrorCode(code)).toBe(expected);
  });
});
