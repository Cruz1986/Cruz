/**
 * The constrained text format used for prayers (and later other devotional texts):
 *  - blank line = new paragraph, newline = new line (prayers are laid out in lines)
 *  - lines starting with ℣. / ℟. are versicles and responses
 *  - *italic* (rubrics such as "Hail Mary…") and **bold**
 * Everything else is literal text. There is no HTML, so nothing can be injected.
 */

export type Inline = { text: string; em?: boolean; strong?: boolean };
export type Line = { kind: "text" | "versicle" | "response"; parts: Inline[] };
export type Paragraph = Line[];

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

function parseInline(text: string): Inline[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? { text: part.slice(2, -2), strong: true }
        : part.startsWith("*") && part.endsWith("*") && part.length > 2
          ? { text: part.slice(1, -1), em: true }
          : { text: part },
    );
}

export function parsePrayerText(input: string): Paragraph[] {
  return input
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line): Line => {
          const kind = line.startsWith("℣") ? "versicle" : line.startsWith("℟") ? "response" : "text";
          return { kind, parts: parseInline(line) };
        }),
    )
    .filter((p) => p.length > 0);
}

/** Plain text for copying and sharing (markup removed, layout kept). */
export function prayerPlainText(input: string): string {
  return parsePrayerText(input)
    .map((p) => p.map((l) => l.parts.map((i) => i.text).join("")).join("\n"))
    .join("\n\n");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
