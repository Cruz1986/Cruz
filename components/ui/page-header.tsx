import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-fg text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="text-fg-muted mt-1">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}
