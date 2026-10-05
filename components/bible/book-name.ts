import type { Book } from "@/lib/content/bible";

export function bookName(book: Pick<Book, "nameEn" | "nameTa">, locale: string): string {
  return locale === "ta" ? book.nameTa : book.nameEn;
}

export function bookAbbr(book: Pick<Book, "abbrEn" | "abbrTa">, locale: string): string {
  return locale === "ta" ? book.abbrTa : book.abbrEn;
}
