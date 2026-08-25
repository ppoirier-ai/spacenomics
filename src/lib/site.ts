/**
 * Canonical production site URL.
 *
 * Single source of truth for the SEO metadataBase / canonical links (see
 * src/app/page.tsx) and for the Stripe Checkout success/cancel redirect URLs
 * (see src/app/api/checkout/route.ts).
 *
 * Resolution order:
 *   1. SITE_URL             (explicit, if ever set)
 *   2. STRIPE_SITE_URL      (the variable set for the Stripe integration)
 *   3. Production fallback  so the app works even with no env var
 *
 * Server-only module — do not import from client components (it reads
 * process.env at module scope).
 */
export const SITE_URL =
  process.env.SITE_URL ||
  process.env.STRIPE_SITE_URL ||
  'https://spacenomics.smooth.fund';
