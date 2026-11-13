import type { MetadataRoute } from "next";

const routes = ["", "/citizen", "/ops", "/worker", "/inspector", "/green", "/dashboard", "/public"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((r) => ({ url: `${process.env.SITE_URL ?? "http://localhost:3210"}${r}`, changeFrequency: "daily", priority: r ? 0.6 : 1 }));
}
