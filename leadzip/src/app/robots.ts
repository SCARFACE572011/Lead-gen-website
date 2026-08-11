import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/search',
          '/saved',
          '/history',
          '/exports',
          '/settings',
          '/admin',
        ],
      },
    ],
    sitemap: 'https://leadzip.vercel.app/sitemap.xml',
    host: 'https://leadzip.vercel.app',
  }
}
