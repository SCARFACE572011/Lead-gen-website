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
    sitemap: 'https://leadzipp.com/sitemap.xml',
    host: 'https://leadzipp.com',
  }
}
