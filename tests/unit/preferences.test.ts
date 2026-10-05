import { describe, expect, it } from "vitest";
import { FONT_SCALE, clampFontScale, parseFontScale, parseTheme, resolveTheme } from "@/lib/preferences";

describe("parseTheme", () => {
  it("accepts known themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to system for anything else", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
    expect(parseTheme(1)).toBe("system");
  });
});

describe("font scale", () => {
  it("clamps to the allowed range", () => {
    expect(clampFontScale(0.1)).toBe(FONT_SCALE.min);
    expect(clampFontScale(9)).toBe(FONT_SCALE.max);
  });

  it("snaps to the nearest step", () => {
    expect(clampFontScale(1.06)).toBe(1);
    expect(clampFontScale(1.07)).toBe(1.125);
  });

  it("parses stored values and rejects garbage", () => {
    expect(parseFontScale("1.25")).toBe(1.25);
    expect(parseFontScale("abc")).toBe(FONT_SCALE.default);
    expect(parseFontScale("")).toBe(FONT_SCALE.default);
    expect(parseFontScale(null)).toBe(FONT_SCALE.default);
  });
});

describe("resolveTheme", () => {
  it("follows the OS only for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
