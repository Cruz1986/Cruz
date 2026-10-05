import { describe, expect, it } from "vitest";
import { adminPath, changedFields, displayValue, rowLabel } from "@/lib/admin/audit";

describe("change history", () => {
  it("lists the fields that changed, ignoring bookkeeping columns", () => {
    const before = { id: "1", title_en: "Memorare", status: "draft", updated_at: "a", search_norm: "x" };
    const after = { id: "1", title_en: "The Memorare", status: "published", updated_at: "b", search_norm: "y" };
    expect(changedFields(before, after)).toEqual([
      { field: "status", before: "draft", after: "published" },
      { field: "title_en", before: "Memorare", after: "The Memorare" },
    ]);
  });

  it("treats a created row as changes from nothing", () => {
    expect(changedFields(null, { id: "1", name: "X", notes: null })).toEqual([
      { field: "name", before: null, after: "X" },
    ]);
  });

  it("shortens long values and shows empty ones as a dash", () => {
    expect(displayValue("x".repeat(200), 10)).toBe("xxxxxxxxx…");
    expect(displayValue(null)).toBe("—");
    expect(displayValue({ a: 1 })).toBe('{"a":1}');
  });

  it("names a row and links to its admin page", () => {
    expect(rowLabel({ slug: "memorare", title_en: "Memorare" })).toBe("Memorare");
    expect(rowLabel({ date: "2026-10-05" })).toBe("2026-10-05");
    expect(adminPath("saints", "abc")).toBe("/admin/saints/abc");
    expect(adminPath("lectionary_sets", "abc")).toBeNull();
  });
});
