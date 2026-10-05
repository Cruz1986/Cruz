"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

const noopSubscribe = () => () => {};

/**
 * The reader's own calendar date. Rendered on the client because "today"
 * depends on the device time zone, not the server's.
 */
export function TodayDate() {
  const locale = useLocale();
  const label = useSyncExternalStore(
    noopSubscribe,
    () =>
      new Intl.DateTimeFormat(`${locale}-IN`, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    () => null,
  );

  if (!label) return <Skeleton className="h-7 w-56" />;
  return <p className="text-fg text-xl font-semibold sm:text-2xl">{label}</p>;
}
