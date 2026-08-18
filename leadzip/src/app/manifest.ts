import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LeadZipp',
    short_name: 'LeadZipp',
    description:
      'Find and score local business leads by ZIP code with live Google and Yelp data.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FBFAF6',
    theme_color: '#0C2B24',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
