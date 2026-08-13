import type { Metadata } from "next";
import FaqSchema from "@/components/seo/FaqSchema";
import SoftwareApplicationSchema from "@/components/seo/SoftwareApplicationSchema";
import { SITE_URL } from "@/components/seo/site";

const TITLE = "Pricing: Local Lead Generation Plans from $0";
const DESCRIPTION =
  "Simple plans that scale with you. Start free with 25 searches a month, then upgrade to Pro ($25/mo) or Agency ($50/mo) for unlimited searches, email finder, and exports. 7-day free trial on paid plans.";
const OG_IMAGE =
  "/og?title=Simple+plans+that+scale+with+you&subtitle=Start+free.+Upgrade+when+the+deals+roll+in.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: {
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    url: `${SITE_URL}/pricing`,
    type: "website",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "LeadZipp pricing plans" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} | LeadZipp`,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/**
 * Copy mirrors the pricing page FAQ verbatim (PRICING_FAQS in
 * src/app/pricing/page.tsx) so the FAQPage rich result matches on-page
 * content. If that copy changes, update this list to match.
 */
const PRICING_FAQ = [
  {
    question: "Can I switch plans later?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Yes. Both Pro and Agency come with a 7-day free trial. A card is required at signup and checkout is handled securely by Stripe. Cancel anytime before day 7 and you will not be charged.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards via Stripe. ACH transfers are available for Agency annual plans.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "If you're not satisfied within the first 14 days of a paid plan, contact us and we'll issue a full refund, no questions asked.",
  },
];

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SoftwareApplicationSchema />
      <FaqSchema items={PRICING_FAQ} />
      {children}
    </>
  );
}
