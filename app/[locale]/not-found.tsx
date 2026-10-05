import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("states");
  return (
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
  );
}
