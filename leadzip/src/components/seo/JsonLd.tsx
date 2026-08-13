/**
 * Renders a single JSON-LD structured-data script tag.
 * Safe to use from both server and client components; when imported by a
 * client page it is still serialized into the prerendered HTML.
 */

// JSON.stringify leaves '<' and '>' untouched, so a "</script>" anywhere in the
// data would close the tag early and turn the rest of the payload into markup.
// Rewriting them into their JSON unicode-escape form keeps the parsed value
// identical (a JSON-LD consumer still sees the original characters) while
// making the breakout impossible. '&' is escaped for the same reason in
// entity-decoding contexts. U+2028 / U+2029 are legal in JSON strings but were
// illegal raw in JS string literals before ES2019, so they are escaped too.
// '/' is deliberately NOT escaped: '<' alone already prevents "</script>", and
// escaping every slash would mangle the readable URLs throughout the schema.
const HTML_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

// These characters only ever appear inside JSON string literals (JSON's
// structural characters are {}[],:" plus numbers and bare true/false/null), so
// a blanket replace cannot corrupt the document structure.
function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(
    /[<>&\u2028\u2029]/g,
    (char) => HTML_ESCAPES[char]
  );
}

export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
