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
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "Type a ZIP code and get a scored list of real local businesses from live Google Places and Yelp data, with phones, websites, and owner emails, ready to export to CSV, PDF, or your CRM.",
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
        "Unlimited searches, email finder, lead scoring, CSV export, and search history.",
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
        "Everything in Pro plus unlimited saved leads, advanced filters, and priority support with onboarding.",
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
