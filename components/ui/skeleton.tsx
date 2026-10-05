import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bg-surface-muted animate-pulse rounded-lg", className)} />;
}
