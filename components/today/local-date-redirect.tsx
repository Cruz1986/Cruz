"use client";

import { useEffect } from "react";
import { useRouter } from "@/lib/i18n/navigation";

/**
 * /today is rendered for India's date. If the reader's device is on a different date
 * (another time zone, or shortly after midnight before the page refreshed), go to their day.
 */
export function LocalDateRedirect({ renderedDate }: { renderedDate: string }) {
  const router = useRouter();
  useEffect(() => {
    const now = new Date();
    const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (local !== renderedDate) router.replace(`/today/${local}`);
  }, [renderedDate, router]);
  return null;
}
