import type { Metadata } from "next";
import FaqSchema from "@/components/seo/FaqSchema";
import SoftwareApplicationSchema from "@/components/seo/SoftwareApplicationSchema";
import { SITE_URL } from "@/components/seo/site";

const TITLE = "Pricing: Local Lead Generation Plans from $0";
const DESCRIPTION =
  "Start free with 25 live searches a month, no card required. Pro is $25/mo with 100 searches and email credits; Agency is $50/mo with 300 pooled searches.";
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
    question: "How does the 7-day free trial work?",
    answer:
      "Both Pro and Agency start with a 7-day free trial. Pro trials include 25 live searches and 20 email credits; Agency trials include 75 pooled live searches and 50 pooled email credits. Cached reruns stay free. A card is required and checkout is handled securely by Stripe, but nothing is charged during the trial. Cancel before day 7 and you pay nothing. Full plan limits apply once paid access begins.",
  },
  {
    question: "What if I only decide it is not for me after I have been charged?",
    answer:
      "That is what the money-back guarantee covers. The trial protects you before your first payment, and the guarantee protects you after it. If you are not satisfied within 14 days of that first charge, email us and we refund it in full, no questions asked.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "All major credit and debit cards, processed by Stripe. Checkout is card only.",
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
