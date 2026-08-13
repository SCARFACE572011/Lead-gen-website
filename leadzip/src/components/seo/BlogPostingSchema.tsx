import JsonLd from "./JsonLd";
import { SITE_NAME, SITE_URL } from "./site";
import type { PostMeta } from "@/lib/blog";

/** BlogPosting schema for a single blog post. */
export default function BlogPostingSchema({ post }: { post: PostMeta }) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: post.cover
      ? `${SITE_URL}${post.cover}`
      : `${SITE_URL}/og?title=${encodeURIComponent(post.title)}`,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: post.author, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/og?title=${encodeURIComponent(SITE_NAME)}`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.keywords.join(", "),
  };
  return <JsonLd data={data} />;
}
