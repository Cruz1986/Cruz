/** Marks each query word in a text (case-insensitive, Unicode-normalised). */
export function Highlighted({ text, words }: { text: string; words: string[] }) {
  const flat = text.replace(/\n/g, " ").normalize("NFC");
  if (!words.length) return <>{flat}</>;
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return (
    <>
      {flat.split(pattern).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="bg-gold/25 text-fg rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
