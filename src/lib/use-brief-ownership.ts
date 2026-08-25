'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MarketplaceBrief, PurchaseWithBrief } from '@/lib/types';

/**
 * Load a marketplace brief (published/public) plus the signed-in user's
 * ownership record, if any. Shared by /preview/[id] and /checkout/[briefId].
 *
 * `refresh` re-runs the fetch — used by the checkout page to poll for the
 * Stripe webhook to land the purchase after the customer returns from the
 * hosted Checkout page.
 */
export function useBriefWithOwnership(
  briefId: string | undefined,
  notFoundMessage = 'This venture brief is not available.'
) {
  const [brief, setBrief] = useState<MarketplaceBrief | null>(null);
  const [owned, setOwned] = useState<PurchaseWithBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!briefId) return;
    let active = true;
    (async () => {
      try {
        const briefRes = await fetch(`/api/public-briefs?id=${briefId}`);
        const briefData = await briefRes.json().catch(() => null);
        if (!active) return;
        if (briefRes.ok && briefData?.id) {
          setBrief(briefData);
        } else {
          setError(notFoundMessage);
        }

        // my-library is session-protected — a signed-out visitor gets a
        // redirect (HTML), so tolerate non-JSON responses as "not owned".
        const libRes = await fetch('/api/my-library').catch(() => null);
        if (!active) return;
        if (libRes && libRes.ok) {
          const libData = await libRes.json().catch(() => ({ purchases: [] }));
          const ownedEntry = (libData?.purchases ?? []).find(
            (p: PurchaseWithBrief) => p.brief?.id === briefId
          );
          if (ownedEntry) setOwned(ownedEntry);
        }
      } catch {
        if (active) setError('Could not load this brief. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [briefId, notFoundMessage, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { brief, owned, loading, error, refresh };
}
