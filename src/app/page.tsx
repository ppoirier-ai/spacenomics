import type { Metadata } from 'next';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import LandingPage from '@/components/landing';
import type { MarketplaceBrief, VentureBrief } from '@/lib/types';
import { enrichBriefs } from '@/lib/briefs';
import { SITE_URL } from '@/lib/site';

/** Revalidate the landing data every hour (ISR) — new briefs appear without a deploy. */
export const revalidate = 3600;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Spacenomics: Institutional Space Market Intelligence & Venture Briefs',
  description:
    'Institutional-grade commercial space market intelligence, unit economics models, and venture briefs. Sizing TAM, capital requirements, and ROI for space founders, operators, talent, and investors.',
  keywords: [
    'space economy', 'commercial space economy', 'venture brief', 'space unit economics', 'space startups',
    'in-space manufacturing', 'space venture capital', 'orbital infrastructure', 'space market research', 'spacenomics',
    'space startup financial model', 'space supply chain database'
  ],
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Spacenomics',
    title: 'Spacenomics: Commercial Space Market Intelligence & Unit Economics',
    description:
      'Institutional-grade commercial space market intelligence, unit economics models, and venture briefs for space founders, operators, talent, and investors.',
    images: [{ url: '/covers/zblan.jpg', width: 900, height: 1165, alt: 'Spacenomics Commercial Space Market Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Spacenomics: Commercial Space Market Intelligence & Unit Economics',
    description: 'Institutional-grade commercial space market intelligence, unit economics models, and venture briefs for founders, operators, talent, and investors.',
    images: ['/covers/zblan.jpg'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Spacenomics',
      url: `${SITE_URL}/`,
      description:
        'Institutional-grade commercial space market intelligence, unit economics models, and venture briefs for founders, operators, talent, and investors.',
      publisher: { '@type': 'Organization', name: 'Smooth Capital LLC' },
    },
    {
      '@type': 'Product',
      name: 'Spacenomics Venture Brief & Market Intelligence',
      description:
        'Commercial space market intelligence briefs covering market sizing (TAM/SAM/SOM), bottom-up unit economics ($/kg, BOM costs), competitive analysis, capital requirements, equity benchmarks, and ROI outlook.',
      brand: { '@type': 'Brand', name: 'Spacenomics' },
      offers: {
        '@type': 'Offer',
        price: '99.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE_URL}/opportunities`,
      },
    },
  ],
};

/** Server-side brief fetch — rendered into the HTML at build/ISR time (instant first paint). */
async function getBriefs(): Promise<MarketplaceBrief[]> {
  try {
    const supabase = await createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('venture_briefs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return enrichBriefs(data as VentureBrief[]);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const briefs = await getBriefs();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage initialBriefs={briefs} />
    </>
  );
}
