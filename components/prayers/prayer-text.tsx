import { parsePrayerText } from "@/lib/prayers/markup";
import { cn } from "@/lib/cn";

/** Renders the constrained prayer format (see lib/prayers/markup.ts). */
export function PrayerText({ text, language, className }: { text: string; language: string; className?: string }) {
  return (
    <div lang={language} className={cn("reading space-y-4", className)}>
      {parsePrayerText(text).map((paragraph, p) => (
        <p key={p}>
          {paragraph.map((line, l) => (
            <span key={l} className={cn("block", line.kind === "response" && "font-semibold")}>
              {line.parts.map((part, i) =>
                part.strong ? (
                  <strong key={i}>{part.text}</strong>
                ) : part.em ? (
                  <em key={i} className="text-fg-muted">
                    {part.text}
                  </em>
                ) : line.kind !== "text" && i === 0 ? (
                  // Only the ℣ / ℟ sign is red (as in printed books).
                  <span key={i}>
                    <span className="text-lit-red">{part.text.slice(0, 2)}</span>
                    {part.text.slice(2)}
                  </span>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
