import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { SITE_URL } from '@/components/seo/site'
import { LEADS_INDEX_PATH, getAllLocationPaths } from '@/lib/seoPages'
import { COMPARE_INDEX_PATH, getAllComparisonPaths } from '@/lib/comparePages'

/**
 * Last material change to the hand-listed and programmatic page content.
 * Bump this in the commit that changes the content. Stamping a fresh
 * request-time date on every URL made lastModified meaningless to
 * crawlers; blog posts keep their own per-post dates below.
 */
const CONTENT_UPDATED = new Date('2026-08-18')

/**
 * Public pages only. Auth (login/signup/password), dashboard, admin, and
 * invite routes are deliberately excluded: they are noindexed and most are
 * disallowed in robots.ts.
 *
 * The programmatic /leads and /compare families are imported from their data
 * modules rather than listed by hand, so adding a category or a city to
 * src/lib/seoPages.ts updates the sitemap in the same commit.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL

  const allPosts = getAllPosts()

  const locationPages: MetadataRoute.Sitemap = getAllLocationPaths().map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const comparisonPages: MetadataRoute.Sitemap = getAllComparisonPaths().map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const posts: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date + 'T12:00:00Z') : CONTENT_UPDATED,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  // The blog index changes whenever the newest post does.
  const newestPostDate = allPosts[0]?.date
    ? new Date(allPosts[0].date + 'T12:00:00Z')
    : CONTENT_UPDATED

  return [
    { url: baseUrl, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/lead-scoring-methodology`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/web-design-leads`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/free-audit`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/first-territory`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/sample-territory`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/resources/web-design-outreach-kit`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: newestPostDate, changeFrequency: 'weekly', priority: 0.8 },
    ...posts,
    { url: `${baseUrl}${LEADS_INDEX_PATH}`, lastModified: CONTENT_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    ...locationPages,
    { url: `${baseUrl}${COMPARE_INDEX_PATH}`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    ...comparisonPages,
    { url: `${baseUrl}/api-docs`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: CONTENT_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: CONTENT_UPDATED, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
