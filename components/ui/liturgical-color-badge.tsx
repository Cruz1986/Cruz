import { useTranslations } from "next-intl";
import type { LiturgicalColor } from "@/lib/design/liturgical-colors";
import { cn } from "@/lib/cn";

const swatch: Record<LiturgicalColor, string> = {
  green: "bg-lit-green",
  violet: "bg-lit-violet",
  white: "bg-lit-white",
  red: "bg-lit-red",
  rose: "bg-lit-rose",
  black: "bg-lit-black",
  gold: "bg-lit-gold",
};

export function LiturgicalColorBadge({ color, className }: { color: LiturgicalColor; className?: string }) {
  const t = useTranslations("liturgicalColor");
  return (
    <span className={cn("text-fg-muted inline-flex items-center gap-1.5 text-sm", className)}>
      <span aria-hidden className={cn("ring-border size-3 rounded-full ring-1", swatch[color])} />
      {t(color)}
    </span>
  );
}
