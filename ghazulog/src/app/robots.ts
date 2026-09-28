import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/journal', '/admin', '/api/'],
    },
    sitemap: 'https://ghazulog.com/sitemap.xml',
  }
}
