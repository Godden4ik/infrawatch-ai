import type { MetadataRoute } from "next";

/**
 * Private demo deployment — keep crawlers out entirely. Drops a
 * Disallow: / rule for every UA. Pair with the meta robots tag set
 * in app/layout.tsx (noindex, nofollow).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
