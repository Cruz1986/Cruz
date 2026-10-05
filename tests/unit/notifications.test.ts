import { describe, expect, it } from "vitest";
import { composeReminder, prayerFor, type DayInfo } from "@/lib/notifications/compose";

const day: DayInfo = {
  title: { en: "Saint Francis Xavier, priest", ta: "புனித பிரான்சிஸ் சவேரியார்" },
  season: "advent",
  gospel: { en: "Mark 16:15-20", ta: "மாற்16:15-20" },
  saints: [{ en: "Saint Francis Xavier", ta: "புனித பிரான்சிஸ் சவேரியார்" }],
  rosary: { en: "Joyful Mysteries", ta: "மகிழ்ச்சி மறைபொருள்கள்" },
};
const labels = { today: "Today", gospel: "Gospel", saint: "Saint", rosary: "Rosary", prayer: "Pray" };
const all = { dailyReading: true, saintOfDay: true, prayer: true, rosary: true };

describe("reminders", () => {
  it("suggests a prayer for the hour and season", () => {
    expect(prayerFor(6, "ordinary").slug).toBe("morning-offering");
    expect(prayerFor(12, "ordinary").slug).toBe("angelus");
    expect(prayerFor(12, "easter").slug).toBe("regina-caeli");
    expect(prayerFor(16, null).slug).toBe("memorare");
    expect(prayerFor(21, null).slug).toBe("act-of-contrition");
  });

  it("combines the chosen parts into one notification", () => {
    const p = composeReminder({ parts: all, day, locale: "en", localDate: "2026-12-03", localHour: 6, labels });
    expect(p.title).toBe("Saint Francis Xavier, priest");
    expect(p.body).toBe(
      "Gospel: Mark 16:15-20\nSaint: Saint Francis Xavier\nRosary: Joyful Mysteries\nPray: Morning Offering",
    );
    expect(p.url).toBe("/en/today/2026-12-03");
    expect(p.tag).toBe("daily-2026-12-03");
  });

  it("uses the reader's language and opens the first chosen part", () => {
    const p = composeReminder({
      parts: { dailyReading: false, saintOfDay: false, prayer: false, rosary: true },
      day,
      locale: "ta",
      localDate: "2026-12-03",
      localHour: 19,
      labels: { ...labels, rosary: "செபமாலை" },
    });
    expect(p.title).toBe("புனித பிரான்சிஸ் சவேரியார்");
    expect(p.body).toBe("செபமாலை: மகிழ்ச்சி மறைபொருள்கள்");
    expect(p.url).toBe("/ta/rosary");
  });

  it("leaves out parts with nothing to say and falls back to a plain title", () => {
    const p = composeReminder({
      parts: { dailyReading: true, saintOfDay: true, prayer: true, rosary: false },
      day: { title: null, season: null, gospel: null, saints: [], rosary: null },
      locale: "en",
      localDate: "2026-12-04",
      localHour: 12,
      labels,
    });
    expect(p.title).toBe("Today");
    expect(p.body).toBe("Pray: The Angelus");
  });
});
