import { NextResponse } from "next/server";

/** JSON helpers for the public API (PRD §15). */
export function json(data: unknown, { maxAge = 0 }: { maxAge?: number } = {}) {
  return NextResponse.json(data, {
    headers: maxAge ? { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 24}` } : {},
  });
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
