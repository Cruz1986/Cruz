import { describe, expect, it } from "vitest";
import { parsePrayerText, prayerPlainText } from "@/lib/prayers/markup";

describe("prayer markup", () => {
  it("splits paragraphs and lines", () => {
    expect(parsePrayerText("One\nTwo\n\nThree").map((p) => p.length)).toEqual([2, 1]);
  });

  it("recognises versicles, responses and emphasis", () => {
    const [p] = parsePrayerText("℣. Pray for us.\n℟. That we may be made worthy.\n*Hail Mary…* and **Amen**");
    expect(p.map((l) => l.kind)).toEqual(["versicle", "response", "text"]);
    expect(p[2].parts).toEqual([{ text: "Hail Mary…", em: true }, { text: " and " }, { text: "Amen", strong: true }]);
  });

  it("treats HTML as plain text", () => {
    const [[line]] = parsePrayerText("<script>alert(1)</script>");
    expect(line.parts).toEqual([{ text: "<script>alert(1)</script>" }]);
  });

  it("produces plain text for copying", () => {
    expect(prayerPlainText("*Hail Mary…*\r\n\r\n\r\nAmen.")).toBe("Hail Mary…\n\nAmen.");
  });
});
