import { describe, expect, it } from "vitest";
import { monthKey, parseMonth, shiftMonth } from "@/lib/liturgy/months";

describe("month helpers", () => {
  it("parses YYYY-MM", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("26-10")).toBeNull();
    expect(parseMonth("2026-1")).toBeNull();
  });

  it("moves across year boundaries", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthKey(2026, 3)).toBe("2026-03");
  });
});
