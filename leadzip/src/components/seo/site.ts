// Canonical site origin for SEO metadata and structured data.
// NEXT_PUBLIC_SITE_URL is inlined at build time; the fallback keeps local
// builds and previews producing valid absolute URLs.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://leadzipp.com"
).replace(/\/$/, "");

export const SITE_NAME = "LeadZipp";
