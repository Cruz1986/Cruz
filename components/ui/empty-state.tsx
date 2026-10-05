import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden className="text-fg-muted mb-3 size-8" /> : null}
      <p className="text-fg font-semibold">{title}</p>
      {body ? <p className="text-fg-muted mt-1 max-w-prose">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
