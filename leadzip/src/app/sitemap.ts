import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { SITE_URL } from '@/components/seo/site'
import { LEADS_INDEX_PATH, getAllLocationPaths } from '@/lib/seoPages'
import { COMPARE_INDEX_PATH, getAllComparisonPaths } from '@/lib/comparePages'

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
  const now = new Date()

  const allPosts = getAllPosts()

  const locationPages: MetadataRoute.Sitemap = getAllLocationPaths().map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const comparisonPages: MetadataRoute.Sitemap = getAllComparisonPaths().map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const posts: MetadataRoute.Sitemap = allPosts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.date ? new Date(p.date + 'T12:00:00Z') : now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  // The blog index changes whenever the newest post does.
  const newestPostDate = allPosts[0]?.date
    ? new Date(allPosts[0].date + 'T12:00:00Z')
    : now

  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/lead-scoring-methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: newestPostDate, changeFrequency: 'weekly', priority: 0.8 },
    ...posts,
    { url: `${baseUrl}${LEADS_INDEX_PATH}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ...locationPages,
    { url: `${baseUrl}${COMPARE_INDEX_PATH}`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...comparisonPages,
    { url: `${baseUrl}/api-docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
