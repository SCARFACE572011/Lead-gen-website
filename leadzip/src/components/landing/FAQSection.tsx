"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    question: "What data sources do you use?",
    answer:
      "LeadZipp pulls from publicly available business data including Google Places, Yelp, and other open business directories. We only surface information that businesses have voluntarily made public online.",
  },
  {
    question: "How is the lead score calculated?",
    answer:
      "Each lead receives a score from 0 to 100 based on multiple factors: online presence (website, social profiles), Google rating and review count, distance from your target ZIP code, and completeness of public contact information. Higher scores indicate leads with stronger digital footprints and closer proximity.",
  },
  {
    question: "Can I export leads?",
    answer:
      "Yes — Pro and Agency plans include CSV export. You can export all saved leads or filter by status, category, or score range before exporting. CSV files include all available fields: name, address, phone, website, rating, score, and any notes you've added.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The free plan gives you 25 searches per month and lets you save up to 25 leads. It's a great way to evaluate LeadZipp before upgrading. No credit card is required to sign up.",
  },
  {
    question: "How do I connect my email for outreach?",
    answer:
      "Email integration is on our roadmap and coming soon. For now, you can export leads to CSV and import them into your existing email tool (Gmail, Mailchimp, HubSpot, etc.). We'll notify you when native email integration is available.",
  },
  {
    question: "Is this compliant with privacy laws?",
    answer:
      "LeadZipp surfaces only publicly available business information — not personal consumer data. However, how you use that information for outreach is your responsibility. We strongly recommend complying with CAN-SPAM (US), GDPR (EU), and any other applicable privacy regulations when contacting businesses.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            className={cn(
              "rounded-xl border bg-white transition-all duration-200",
              isOpen ? "border-[#FF4D23]/30 shadow-card" : "border-[#E2E8F0]"
            )}
          >
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-[#17130E]">{faq.question}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[#94A3B8] transition-transform duration-200",
                  isOpen && "rotate-180 text-[#FF4D23]"
                )}
              />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-200",
                isOpen ? "max-h-96" : "max-h-0"
              )}
            >
              <p className="px-5 pb-4 text-sm leading-relaxed text-[#64748B]">{faq.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
