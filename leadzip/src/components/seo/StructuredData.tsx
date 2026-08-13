import JsonLd from "./JsonLd";
import { SITE_NAME, SITE_URL } from "./site";

// Branded image produced by the dynamic /og route (carries the LeadZipp mark).
const LOGO_URL = `${SITE_URL}/og?title=${encodeURIComponent(SITE_NAME)}`;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: LOGO_URL,
  description:
    "LeadZipp finds local business leads by ZIP code from live Google Places and Yelp data, then scores, enriches, and exports them.",
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};

/**
 * Site-wide JSON-LD rendered once from the root layout.
 * Only schemas that are valid on every page live here (Organization,
 * WebSite). Page-scoped schemas (SoftwareApplication, FAQPage,
 * BlogPosting, BreadcrumbList) are rendered by the pages whose visible
 * content they describe.
 */
export default function StructuredData() {
  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
    </>
  );
}
