import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";
import { isProductionSite, robotsFor } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsFor(getSiteUrl(), isProductionSite());
}
