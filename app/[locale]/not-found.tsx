import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

/** Fallback for segments without their own shell (e.g. the admin area). */
export default function NotFound() {
  const t = useTranslations("states");
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        icon={SearchX}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/" className={buttonClasses()}>
            {t("backHome")}
          </Link>
        }
      />
    </main>
  );
}
