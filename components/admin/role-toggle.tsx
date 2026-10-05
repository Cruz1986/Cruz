"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { changeUserRole, type RoleChangeState } from "@/lib/admin/user-actions";
import type { RoleKey } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";

const initialState: RoleChangeState = { status: "idle" };

export function RoleToggle({ userId, role, granted }: { userId: string; role: RoleKey; granted: boolean }) {
  const t = useTranslations("admin");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(changeUserRole, initialState);
  const label = t(granted ? "revoke" : "grant", { role: tRoles(role) });

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="intent" value={granted ? "revoke" : "grant"} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" size="sm" variant={granted ? "secondary" : "ghost"} disabled={pending}>
        {label}
      </Button>
      {state.status !== "idle" && state.status !== "saved" ? (
        <span role="alert" className="text-lit-red text-sm">
          {t(`result.${state.status}`)}
        </span>
      ) : null}
    </form>
  );
}
