import crypto from "node:crypto";
import type { BrowserContext } from "@playwright/test";

/**
 * Signs a session cookie as @supabase/ssr stores it, for a local stack whose JWT secret is known
 * (E2E_JWT_SECRET). The auth endpoint must accept the token (see docs/ARCHITECTURE.md › Testing).
 */
export async function signInAs(context: BrowserContext, baseURL: string, userId: string) {
  const secret = process.env.E2E_JWT_SECRET!;
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ sub: userId, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now });
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  const session = {
    access_token: `${head}.${body}.${sig}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "e2e",
    user: { id: userId, aud: "authenticated", role: "authenticated" },
  };
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  await context.addCookies([{ name: `sb-${host}-auth-token`, value: `base64-${b64(session)}`, url: baseURL }]);
}
