import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { countryForHost } from "@/lib/i18n";
import { originFor } from "@/lib/urls";

// Host-aware: each public host (majstr.xyz, fr.majstr.xyz) advertises its own
// origin + sitemap, so crawlers consolidate per-country signals on that host.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") || "";
  const origin = originFor(countryForHost(host));
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/login", "/profile", "/admin", "/add", "/onboard"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
