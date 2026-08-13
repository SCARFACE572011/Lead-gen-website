import { MetadataRoute } from 'next'
import { SITE_URL } from '@/components/seo/site'

/**
 * Private app surfaces are disallowed outright. Auth entry pages
 * (/login, /signup, password reset) stay crawlable but carry a noindex
 * robots meta tag, so Google can see the noindex directive.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/search',
          '/saved',
          '/saved-searches',
          '/market-gaps',
          '/history',
          '/exports',
          '/settings',
          '/admin',
          '/invite/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
