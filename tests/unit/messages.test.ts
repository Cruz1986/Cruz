import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ta from "@/messages/ta.json";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { LITURGICAL_COLORS } from "@/lib/design/liturgical-colors";

type Tree = { [key: string]: string | Tree };

function leafPaths(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : leafPaths(value, `${prefix}${key}.`),
  );
}

function leafValues(tree: Tree): string[] {
  return Object.values(tree).flatMap((value) => (typeof value === "string" ? [value] : leafValues(value)));
}

describe("message catalogs", () => {
  it("Tamil and English define exactly the same keys", () => {
    expect(leafPaths(ta).sort()).toEqual(leafPaths(en).sort());
  });

  it("have no empty strings", () => {
    for (const value of [...leafValues(ta), ...leafValues(en)]) expect(value.trim()).not.toBe("");
  });

  it("label every navigation item and liturgical colour", () => {
    for (const key of Object.keys(NAV_ITEMS)) expect(en.nav).toHaveProperty(key);
    for (const color of LITURGICAL_COLORS) expect(en.liturgicalColor).toHaveProperty(color);
  });

  it("Tamil strings are stored as Unicode Tamil", () => {
    expect(ta.nav.bible).toMatch(/[஀-௿]/);
  });
});
