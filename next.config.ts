import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { contentSecurityPolicy } from "./lib/security/csp";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const dev = process.env.NODE_ENV !== "production";
// HTTPS-only once deployed (not for local http servers).
const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
const csp = contentSecurityPolicy({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, dev, https });

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
