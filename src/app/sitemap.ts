import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms"].map(path => ({ url: `https://duitlo.vercel.app${path}`, changeFrequency: "monthly" as const, priority: path ? 0.3 : 1 }));
}
