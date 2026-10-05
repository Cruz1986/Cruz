/** URL helpers for Bible routes (book codes are lower-case in URLs: /bible/en-drc/jhn/3). */

export function bookSlug(code: string): string {
  return code.toLowerCase();
}

export function bookFromSlug(slug: string): string | null {
  return /^[1-3]?[a-z]{2,3}$/.test(slug) ? slug.toUpperCase() : null;
}

export function chapterFromSlug(slug: string): number | null {
  return /^\d{1,3}$/.test(slug) ? Number(slug) : null;
}

export function biblePath(translation: string, book?: string, chapter?: number, verse?: number | null): string {
  let path = `/bible/${translation}`;
  if (book) path += `/${bookSlug(book)}`;
  if (book && chapter !== undefined) path += `/${chapter}`;
  if (book && chapter !== undefined && verse) path += `#v${verse}`;
  return path;
}

export function parallelPath(translation: string, book: string, chapter: number, other: string): string {
  return `${biblePath(translation, book, chapter)}/${other}`;
}

export const publicBiblePaths = {
  chapter: (translation: string, book: string, chapter: number) => biblePath(translation, book, chapter),
  book: (translation: string, book: string) => biblePath(translation, book),
  parallel: parallelPath,
};
