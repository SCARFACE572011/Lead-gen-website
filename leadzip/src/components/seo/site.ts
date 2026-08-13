// Canonical site origin for SEO metadata and structured data.
// The resolution rule (and why *.vercel.app values are rejected) lives in
// @/lib/siteUrl, which the Stripe, auth, and email routes share.
export { SITE_URL } from "@/lib/siteUrl";

export const SITE_NAME = "LeadZipp";
