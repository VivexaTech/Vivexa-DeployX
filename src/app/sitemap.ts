import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";
import { DOCS } from "@/lib/content/docs";

const STATIC_ROUTES = [
  "",
  "/features",
  "/pricing",
  "/docs",
  "/faq",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/acceptable-use",
  "/refund-policy",
  "/infrastructure",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...STATIC_ROUTES.map((route) => ({
      url: `${siteConfig.url}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.7,
    })),
    ...DOCS.map((doc) => ({
      url: `${siteConfig.url}/docs/${doc.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
