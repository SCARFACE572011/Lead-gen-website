import JsonLd from "./JsonLd";

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/** BreadcrumbList schema, e.g. Home > Blog > Post title. */
export default function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return <JsonLd data={data} />;
}
