import JsonLd from "./JsonLd";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * FAQPage schema. Render only on pages that visibly show the same
 * questions and answers, and pass that page's copy verbatim so the
 * markup always matches on-page content.
 */
export default function FaqSchema({ items }: { items: FaqItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return <JsonLd data={data} />;
}
