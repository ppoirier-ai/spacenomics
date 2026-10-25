import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Public pages only. Brief previews (/preview/[id]) are discovered through
 * /opportunities and the homepage links; add them here dynamically once the
 * brief catalog API is callable at build time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1, lastModified: new Date('2026-10-25') },
    { url: `${SITE_URL}/opportunities`, changeFrequency: 'weekly', priority: 0.9, lastModified: new Date('2026-10-25') },
  ];
}
