import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import type { TranslationBook } from "@/lib/content/bible";
import { biblePath } from "@/lib/bible/paths";
import { bookName } from "./book-name";

export async function BookList({ translation, books }: { translation: string; books: TranslationBook[] }) {
  const t = await getTranslations("bible");
  const locale = await getLocale();
  const groups = [
    { key: "old", title: t("oldTestament"), books: books.filter((b) => b.testament === "old") },
    { key: "new", title: t("newTestament"), books: books.filter((b) => b.testament === "new") },
  ];

  return (
    <div className="space-y-8">
      {groups.map((group) =>
        group.books.length ? (
          <section key={group.key} aria-labelledby={`books-${group.key}`}>
            <h2 id={`books-${group.key}`} className="mb-3 text-lg font-semibold">
              {group.title}
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {group.books.map((book) => (
                <li key={book.code}>
                  <Link
                    href={biblePath(translation, book.code)}
                    className="border-border bg-surface text-fg hover:border-accent hover:text-accent flex min-h-12 items-center rounded-xl border px-3 py-2"
                  >
                    {bookName(book, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
