// Canonical site origin for SEO metadata and structured data.
// NEXT_PUBLIC_SITE_URL is inlined at build time, but *.vercel.app values are
// rejected: deployment hosts must never leak into canonicals, sitemaps, or
// structured data (production env still carried the legacy leadzip.vercel.app
// domain long after leadzipp.com went live).
const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

export const SITE_URL =
  envUrl.startsWith("https://") && !/\.vercel\.app(\/|$)/i.test(envUrl)
    ? envUrl
    : "https://leadzipp.com";

export const SITE_NAME = "LeadZipp";
