import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createPublicClient } from "@/lib/db/public";
import { buildSafe } from "./build-safe";

/** A verified content source as readers see it (the `credits` view: no internal notes or permission state). */
export type Credit = {
  id: string;
  name: string;
  copyrightHolder: string | null;
  licenseType: "public_domain" | "licensed" | "permission_granted" | "original";
  attribution: string | null;
  approval: string | null;
  licenseUrl: string | null;
};

const creditSchema = z.object({
  id: z.string(),
  name: z.string(),
  copyright_holder: z.string().nullable(),
  license_type: z.enum(["public_domain", "licensed", "permission_granted", "original"]),
  attribution_text: z.string().nullable(),
  ecclesiastical_approval: z.string().nullable(),
  license_url: z.string().nullable(),
});

export const publicCredits = cache(async (): Promise<Credit[]> => {
  const db = createPublicClient();
  if (!db) return [];
  return buildSafe(async () => {
    const { data, error } = await db.from("credits").select("*").order("name");
    if (error) throw new Error(`Failed to load credits: ${error.message}`);
    return z
      .array(creditSchema)
      .parse(data)
      .map((c) => ({
        id: c.id,
        name: c.name,
        copyrightHolder: c.copyright_holder,
        licenseType: c.license_type,
        attribution: c.attribution_text,
        approval: c.ecclesiastical_approval,
        // Only web links are shown.
        licenseUrl: c.license_url && /^https?:\/\//.test(c.license_url) ? c.license_url : null,
      }));
  }, []);
});
