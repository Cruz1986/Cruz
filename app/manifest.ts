import type { MetadataRoute } from "next";
import en from "@/messages/en.json";
import ta from "@/messages/ta.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${ta.app.name} · ${en.app.name}`,
    short_name: ta.app.shortName,
    description: en.app.description,
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#1f4e8c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
