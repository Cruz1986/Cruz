/** Liturgical (vestment) colours used by the calendar, Today and badges. */
export const LITURGICAL_COLORS = ["green", "violet", "white", "red", "rose", "black", "gold"] as const;
export type LiturgicalColor = (typeof LITURGICAL_COLORS)[number];

export function isLiturgicalColor(value: unknown): value is LiturgicalColor {
  return LITURGICAL_COLORS.includes(value as LiturgicalColor);
}
