import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/api/', '/search/', '/saved/', '/history/', '/exports/', '/settings/'],
      },
    ],
    sitemap: 'https://leadzip.vercel.app/sitemap.xml',
  }
}
