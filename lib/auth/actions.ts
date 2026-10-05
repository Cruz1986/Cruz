"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hasLocale } from "next-intl";
import { routing } from "@/lib/i18n/routing";
import { createSupabaseServerClient } from "@/lib/db/server";
import { getSiteUrl } from "@/lib/env";
import { safeNextPath } from "./redirect";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; error: "invalid_email" | "not_configured" | "failed" };

const signInSchema = z.object({
  email: z.email().max(254),
  locale: z.string(),
  next: z.string().optional(),
});

function localeOf(value: string) {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function callbackUrl(next: string) {
  return `${getSiteUrl()}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Sends a one-time sign-in link (creates the account on first use). */
export async function signInWithEmail(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    locale: formData.get("locale"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { status: "error", error: "invalid_email" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { status: "error", error: "not_configured" };

  const locale = localeOf(parsed.data.locale);
  const next = safeNextPath(parsed.data.next, `/${locale}`);
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  if (error) return { status: "error", error: "failed" };

  return { status: "sent", email: parsed.data.email };
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const locale = localeOf(String(formData.get("locale") ?? ""));
  const next = safeNextPath(formData.get("next"), `/${locale}`);

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`/${locale}/login?error=not_configured`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
  if (error || !data.url) redirect(`/${locale}/login?error=failed`);
  redirect(data.url);
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = localeOf(String(formData.get("locale") ?? ""));
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect(`/${locale}`);
}
