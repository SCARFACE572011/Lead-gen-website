import type { Metadata } from "next";
import { SITE_URL } from "@/components/seo/site";

const TITLE = "API Documentation";
const DESCRIPTION =
  "Integrate LeadZipp into your stack. REST API reference for searching local businesses by ZIP code and pulling scored leads with phones, websites, and emails into your own tools.";
const OG_IMAGE =
  "/og?title=LeadZipp+API&subtitle=Scored+local+business+leads,+by+ZIP+code,+over+REST";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/api-docs` },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: `${SITE_URL}/api-docs`,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "LeadZipp API documentation" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
