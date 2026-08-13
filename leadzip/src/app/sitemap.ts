import { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { SITE_URL } from '@/components/seo/site'

/**
 * Public pages only. Auth (login/signup/password), dashboard, admin, and
 * invite routes are deliberately excluded: they are noindexed and most are
 * disallowed in robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL
  const now = new Date()

  const allPosts = getAllPosts()

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
    { url: `${baseUrl}/blog`, lastModified: newestPostDate, changeFrequency: 'weekly', priority: 0.8 },
    ...posts,
    { url: `${baseUrl}/api-docs`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
