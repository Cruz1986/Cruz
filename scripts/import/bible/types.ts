/** Normalised output of every Bible source parser, ready for validation and loading. */

export type ParsedVerse = {
  book: string; // our USFM book code, e.g. GEN
  chapter: number;
  verse: number;
  part: string; // "" unless a verse is split (e.g. "a")
  label: string | null; // printed label when it differs, e.g. "4-5"
  text: string; // plain text; "\n" separates poetry lines
  isPoetry: boolean;
  paragraphEnd: boolean;
  /** Canonical (reference-versification) coordinates; filled by the versification step. */
  canonical?: { book: string; chapter: number; verse: number };
};

export type ParsedHeading = {
  book: string;
  chapter: number;
  beforeVerse: number;
  level: 1 | 2 | 3;
  text: string;
};

export type ParsedBook = { book: string; order: number; intro: string | null };

export type ParsedTranslation = {
  books: ParsedBook[];
  verses: ParsedVerse[];
  headings: ParsedHeading[];
};
