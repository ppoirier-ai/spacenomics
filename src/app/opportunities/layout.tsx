import type { Metadata } from 'next';

/**
 * /opportunities is a client page (interactive marketplace filters), so its
 * metadata lives on this server layout. Canonical SEO surface for the
 * "commercial space business opportunities" query cluster.
 */
export const metadata: Metadata = {
  title: 'Commercial Space Business Opportunities — Market Briefs & Unit Economics',
  description:
    'Browse institutional-grade commercial space opportunity briefs: Earth observation, orbital refueling, in-space manufacturing, and more. Bottom-up TAM, capital requirements, and ROI outlooks for founders and investors. $99.99 per brief, lifetime access.',
  alternates: { canonical: '/opportunities' },
  openGraph: {
    title: 'Commercial Space Business Opportunities — Spacenomics Briefs',
    description:
      'Institutional-grade teardowns of real commercial space opportunities: market sizing, capital requirements, and ROI outlooks. $99.99 per brief, lifetime access.',
    url: '/opportunities',
  },
};

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
