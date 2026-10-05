"use server";

import { z } from "zod";
import {
  LICENSE_TYPES,
  PERMISSION_STATUSES,
  optionalText,
  optionalUrl,
  requiredText,
  type AdminFormState,
} from "./fields";
import { adminDelete, adminSave } from "./save";

const schema = z.object({
  id: z.uuid().optional(),
  name: requiredText(200),
  copyrightHolder: optionalText(200),
  licenseType: z.enum(LICENSE_TYPES),
  permissionStatus: z.enum(PERMISSION_STATUSES),
  attribution: optionalText(500),
  approval: optionalText(300),
  licenseUrl: optionalUrl,
  notes: optionalText(4000),
});

/** Sources decide what may be published, so every page is refreshed after a change. */
export async function saveSource(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  return adminSave({
    formData,
    schema,
    role: "publisher",
    write: (db, s, user) => {
      const row = {
        name: s.name,
        copyright_holder: s.copyrightHolder,
        license_type: s.licenseType,
        permission_status: s.permissionStatus,
        attribution_text: s.attribution,
        ecclesiastical_approval: s.approval,
        license_url: s.licenseUrl,
        notes: s.notes,
        ...(s.permissionStatus === "verified" ? { reviewed_by: user.id, reviewed_at: new Date().toISOString() } : {}),
      };
      return s.id
        ? db.from("content_sources").update(row).eq("id", s.id).select("id").maybeSingle()
        : db.from("content_sources").insert(row).select("id").single();
    },
    revalidate: () => ["*"],
    created: (id) => `/admin/sources/${id}`,
  });
}

export async function deleteSource(formData: FormData) {
  await adminDelete(formData, "content_sources", "/admin/sources", ["*"]);
}
