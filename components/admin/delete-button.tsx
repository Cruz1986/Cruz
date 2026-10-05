import { getLocale, getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Delete form for an admin item (the action re-checks the role). */
export async function DeleteButton({
  id,
  action,
  label,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  label?: string;
}) {
  const t = await getTranslations("adminCommon");
  const locale = await getLocale();
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" variant="ghost" size="sm" className="text-lit-red">
        <Trash2 aria-hidden className="size-4" />
        {label ?? t("delete")}
      </Button>
    </form>
  );
}
