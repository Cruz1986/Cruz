import { describe, expect, it } from "vitest";
import { BOTTOM_NAV, isActive } from "@/components/layout/nav-items";

describe("isActive", () => {
  it("matches home only exactly", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/bible", "/")).toBe(false);
  });

  it("matches a section and its children but not look-alikes", () => {
    expect(isActive("/bible", "/bible")).toBe(true);
    expect(isActive("/bible/gen/1", "/bible")).toBe(true);
    expect(isActive("/bibleplus", "/bible")).toBe(false);
  });
});

describe("bottom navigation", () => {
  it("follows PRD §11: Home, Bible, Today, Prayers, More", () => {
    expect(BOTTOM_NAV.map((item) => item.key)).toEqual(["home", "bible", "today", "prayers", "more"]);
  });
});
