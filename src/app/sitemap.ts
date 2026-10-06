import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/projects", "/blog", "/contact"].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));
}
