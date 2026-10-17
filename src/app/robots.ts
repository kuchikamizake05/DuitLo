import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/design/", "/onboarding", "/shared-receipt"] },
    sitemap: "https://duitlo.vercel.app/sitemap.xml",
  };
}
