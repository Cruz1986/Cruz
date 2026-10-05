import type { Instrumentation } from "next";

/**
 * Server errors as one JSON line each, so the hosting logs (Vercel → Logs) can be searched by digest — the
 * identifier readers see on the error page. Request headers are not logged: they carry session cookies.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      digest: typeof error === "object" && error && "digest" in error ? String(error.digest) : undefined,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
    }),
  );
};
