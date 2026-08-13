/**
 * Renders a single JSON-LD structured-data script tag.
 * Safe to use from both server and client components; when imported by a
 * client page it is still serialized into the prerendered HTML.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
