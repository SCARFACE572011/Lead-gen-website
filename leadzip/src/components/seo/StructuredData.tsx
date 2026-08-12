const SITE_URL = "https://leadzipp.com";

// Branded image produced by the dynamic /og route (carries the LeadZipp mark).
const LOGO_URL = `${SITE_URL}/og?title=LeadZipp`;

// Copy mirrors the homepage FAQ verbatim so the rich result matches on-page content.
const FAQ: { question: string; answer: string }[] = [
  {
    question: "Where does the lead data come from?",
    answer:
      "LeadZipp pulls live business listings from Google Places and Yelp: real names, addresses, phone numbers, ratings, and websites. Every search runs against current data.",
  },
  {
    question: "What makes a lead high-scoring?",
    answer:
      "We rank each business by how likely it is to need your services. No website, few reviews, or a low rating push a business up your list.",
  },
  {
    question: "Can I find email addresses?",
    answer:
      "Yes. For any business with a website, one tap runs the email finder and returns the best contact address with a confidence badge.",
  },
  {
    question: "How do exports work?",
    answer:
      "Export any result set to CSV or branded PDF, ready to import into HubSpot, Pipedrive, or GoHighLevel.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. The Starter plan is free forever and includes 25 searches a month against real data.",
  },
];

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LeadZipp",
  url: SITE_URL,
  logo: LOGO_URL,
  description:
    "LeadZipp finds local business leads by ZIP code from live Google Places and Yelp data, then scores, enriches, and exports them.",
  sameAs: [],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LeadZipp",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?zip={zip}`,
    },
    "query-input": "required name=zip",
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LeadZipp",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "Type a ZIP code and get the whole street: live, scored local business leads you can enrich and export.",
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "0",
      priceCurrency: "USD",
      description:
        "Free forever. 25 searches a month against real data, no credit card required.",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "25",
      priceCurrency: "USD",
      description: "Unlimited searches, email finder, and exports.",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "25",
        priceCurrency: "USD",
        unitText: "MONTH",
        billingDuration: 1,
      },
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

const SCHEMAS = [
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
  faqSchema,
];

/**
 * Server component that injects JSON-LD structured data for search engines.
 * Rendered once in the root layout so it applies site-wide.
 */
export default function StructuredData() {
  return (
    <>
      {SCHEMAS.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Content is static, build-time constant — safe to serialize inline.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
