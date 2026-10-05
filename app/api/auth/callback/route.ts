import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/db/server";
import { safeNextPath } from "@/lib/auth/redirect";
import { routing } from "@/lib/i18n/routing";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = ["magiclink", "signup", "email", "invite", "recovery", "email_change"];

/**
 * Completes sign-in: exchanges an OAuth / PKCE `code`, or verifies an email `token_hash`,
 * then sends the user to the (same-origin) `next` path.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), `/${routing.defaultLocale}`);
  const locale = routing.locales.find((l) => next === `/${l}` || next.startsWith(`/${l}/`)) ?? routing.defaultLocale;
  const failure = NextResponse.redirect(new URL(`/${locale}/login?error=callback`, origin));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  return ok ? NextResponse.redirect(new URL(next, origin)) : failure;
}
