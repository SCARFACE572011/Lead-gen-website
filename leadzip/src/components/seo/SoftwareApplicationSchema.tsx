import JsonLd from "./JsonLd";
import { SITE_NAME, SITE_URL } from "./site";

/**
 * SoftwareApplication schema with offers mirroring the real plans on
 * /pricing (Free $0; Pro $25/mo or $240/yr; Agency $50/mo or $480/yr).
 * Rendered on the landing and pricing pages.
 */
const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#software`,
  name: SITE_NAME,
  alternateName: ["LeadZip", "Lead Zipp"],
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Lead generation software",
  operatingSystem: "Web",
  url: SITE_URL,
  brand: { "@id": `${SITE_URL}/#organization` },
  description:
    "Type a ZIP code and get a scored list of real local businesses from live listing data, with phones, websites, and business contact emails, ready to export to CSV, PDF, or your CRM.",
  featureList: [
    "Local business search by ZIP code, city, category, and radius",
    "Opportunity scoring from 0 to 100",
    "Business phone, website, rating, and review data",
    "Business contact email finder",
    "CSV, PDF, HubSpot, Pipedrive, and GoHighLevel export",
  ],
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description:
        "Free forever. 25 searches per month against real data, no credit card required.",
    },
    {
      "@type": "Offer",
      name: "Pro (monthly)",
      price: "25",
      priceCurrency: "USD",
      description:
        "100 new live territory searches and 100 business-email credits per billing period, bulk ZIP search, full CSV export, and CRM push.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "25",
        priceCurrency: "USD",
        unitText: "MONTH",
      },
    },
    {
      "@type": "Offer",
      name: "Pro (annual)",
      price: "240",
      priceCurrency: "USD",
      description: "Pro billed annually at $20 per month.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "240",
        priceCurrency: "USD",
        unitText: "YEAR",
      },
    },
    {
      "@type": "Offer",
      name: "Agency (monthly)",
      price: "50",
      priceCurrency: "USD",
      description:
        "Everything in Pro plus 300 pooled live searches, 500 pooled email credits, 10,000 saved leads, five seats, and API access.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "50",
        priceCurrency: "USD",
        unitText: "MONTH",
      },
    },
    {
      "@type": "Offer",
      name: "Agency (annual)",
      price: "480",
      priceCurrency: "USD",
      description: "Agency billed annually at $40 per month.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "480",
        priceCurrency: "USD",
        unitText: "YEAR",
      },
    },
  ],
};

export default function SoftwareApplicationSchema() {
  return <JsonLd data={schema} />;
}
