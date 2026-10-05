import "server-only";

/**
 * During `next build`, a data error (e.g. database unreachable) renders the empty state instead
 * of failing the build; pages regenerate shortly after deploy. At runtime errors still throw, so
 * incremental regeneration keeps serving the last good page rather than caching an empty one.
 */
export async function buildSafe<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error;
    console.warn(
      `Build-time data load failed; rendering empty state: ${error instanceof Error ? error.message : error}`,
    );
    return fallback;
  }
}
