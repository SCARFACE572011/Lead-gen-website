import JsonLd from "./JsonLd";
import { SITE_NAME, SITE_URL } from "./site";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const LOGO_URL = `${SITE_URL}/apple-icon.png`;

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  alternateName: ["LeadZip", "Lead Zipp"],
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
    width: 180,
    height: 180,
  },
  description:
    "LeadZipp finds local business leads by ZIP code from live Google Places and Yelp data, then scores, enriches, and exports them.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  alternateName: ["LeadZip", "Lead Zipp"],
  url: SITE_URL,
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en-US",
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
