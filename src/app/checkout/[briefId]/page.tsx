'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRole } from '@/lib/auth';
import { BRIEF_PRICE } from '@/lib/types';
import {
  ArrowLeft, Lock, ShieldCheck, CheckCircle2, Eye, BookOpen, Loader2,
} from 'lucide-react';
import { useBriefWithOwnership } from '@/lib/use-brief-ownership';
import { Spinner } from '@/components/spinner';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CheckoutInner />
    </Suspense>
  );
}

function CheckoutInner() {
  const params = useParams<{ briefId: string }>();
  const briefId = params.briefId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: roleLoading } = useRole();

  const { brief, owned, loading, error, refresh } = useBriefWithOwnership(
    briefId,
    'This venture brief is not available for purchase.'
  );

  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [formError, setFormError] = useState('');
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);

  // We are back from Stripe's hosted Checkout with a confirmed session.
  const isReturning = searchParams.get('session_id') !== null;
  // The customer left Checkout without paying.
  const cancelled = searchParams.get('cancelled') === '1';
  // The webhook normally lands in a few seconds — give it up to 30s.
  const [grantTimeout, setGrantTimeout] = useState(false);

  // Signed-out users → login first, then come back here.
  useEffect(() => {
    if (!roleLoading && !user) {
      router.push(`/auth/login?next=/checkout/${briefId}`);
    }
  }, [roleLoading, user, router, briefId]);

  // Poll for the webhook to grant access after returning from Stripe.
  useEffect(() => {
    if (!isReturning || owned) return;
    setGrantTimeout(false);
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 30000) {
        clearInterval(id);
        setGrantTimeout(true);
        return;
      }
      refresh();
    }, 1500);
    return () => clearInterval(id);
  }, [isReturning, owned, refresh]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setPaying(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief_id: briefId }),
      });
      const data = await res.json().catch(() => null);
      if (data?.alreadyOwned) {
        setAlreadyOwned(true);
        setDone(true);
        return;
      }
      if (!res.ok) {
        setFormError(data?.error || 'Checkout failed. Please try again.');
        setPaying(false);
        return;
      }
      if (data?.url) {
        // Redirect to Stripe's hosted Checkout page.
        window.location.assign(data.url);
        return;
      }
      setFormError('Checkout could not be started. Please try again.');
      setPaying(false);
    } catch {
      setFormError('Network error: please try again.');
      setPaying(false);
    }
  };

  if (loading || roleLoading) return <Spinner />;

  if (error && !brief) {
    return (
      <div className="max-w-lg mx-auto text-center py-24">
        <p className="text-sm text-gray-500">{error}</p>
        <Link href="/opportunities">
          <Button variant="outline" className="mt-5 border-gray-700/50 text-gray-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Opportunities
          </Button>
        </Link>
      </div>
    );
  }

  const showSuccess = done || isReturning;
  const effectiveOwned = owned || alreadyOwned;

  // Post-payment screen(s): confirmed, still unlocking, or timed out.
  if (showSuccess) {
    // Confirmed + already granted (or already owned before checkout).
    if (effectiveOwned) {
      return (
        <div className="max-w-lg mx-auto">
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                {alreadyOwned ? 'You already own this brief' : 'Purchase confirmed'}
              </h1>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {brief?.title} is now in your library: view or download it any time, no further payment needed.
              </p>
              <div className="flex flex-col gap-2 mt-6">
                <Link href="/library">
                  <Button className="w-full bg-[#2EC4C6] hover:bg-[#28B0B2] text-black font-medium h-10 rounded-lg">
                    <BookOpen className="w-4 h-4 mr-2" /> Go to My Library
                  </Button>
                </Link>
                {brief?.pdf_url && brief?.id && (
                  <a href={`/api/brief-pdf?id=${brief.id}`} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="w-full border-gray-700/50 text-gray-300 hover:text-white h-10 rounded-lg">
                      <Eye className="w-4 h-4 mr-2" /> View Brief Now
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Payment received, webhook still granting access.
    if (!grantTimeout) {
      return (
        <div className="max-w-lg mx-auto">
          <Card className="bg-gray-900/60 border-gray-800/50">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-[#2EC4C6]/15 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-7 h-7 text-[#2EC4C6] animate-spin" />
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">Payment received</h1>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                {brief?.title} is being unlocked in your library. This only takes a moment.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Webhook took longer than 30s (rare) — don't leave the customer stuck.
    return (
      <div className="max-w-lg mx-auto">
        <Card className="bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">Payment received</h1>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">
              {brief?.title} will appear in your library shortly. If it does not appear, refresh this page or check again in a minute.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button
                className="w-full bg-[#2EC4C6] hover:bg-[#28B0B2] text-black font-medium h-10 rounded-lg"
                onClick={() => { setGrantTimeout(false); refresh(); }}
              >
                <BookOpen className="w-4 h-4 mr-2" /> Check My Library
              </Button>
              <Link href="/library">
                <Button variant="outline" className="w-full border-gray-700/50 text-gray-300 hover:text-white h-10 rounded-lg">
                  Go to My Library
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunities
      </Link>

      <h1 className="text-xl font-bold text-white tracking-tight">Checkout</h1>

      {cancelled && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg px-4 py-3">
          Payment was not completed and no charge was made. You can try again below.
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-5">
        {/* Order summary */}
        <Card className="md:col-span-2 bg-gray-900/60 border-gray-800/50 h-fit">
          <CardContent className="p-5 space-y-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Order Summary</p>
            {brief?.cover_image_url && (
              <div className="aspect-[3/4] overflow-hidden rounded-lg">
                <img src={brief.cover_image_url} alt={brief.title} className="w-full h-full object-cover object-top" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-white leading-snug">{brief?.title}</h3>
            {brief?.subtitle && <p className="text-[11px] text-gray-500">{brief.subtitle}</p>}
            <div className="flex items-center justify-between border-t border-gray-800/60 pt-3">
              <span className="text-xs text-gray-400">Venture brief</span>
              <span className="text-xs text-gray-300">{BRIEF_PRICE}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white">Total</span>
              <span className="text-base font-bold text-[#2EC4C6]">{BRIEF_PRICE}</span>
            </div>
            <p className="text-[9px] text-gray-700 leading-relaxed">
              One-time purchase. Includes lifetime access to this brief's PDF: view and download without limits.
            </p>
          </CardContent>
        </Card>

        {/* Payment: redirect to Stripe's hosted Checkout */}
        <Card className="md:col-span-3 bg-gray-900/60 border-gray-800/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Payment</p>
              <span className="flex items-center gap-1 text-[9px] text-emerald-400/80">
                <ShieldCheck className="w-3 h-3" /> Secured by Stripe
              </span>
            </div>

            <form onSubmit={handlePay} className="space-y-4">
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4 flex items-start gap-3">
                <Lock className="w-4 h-4 text-[#2EC4C6] mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  You'll be redirected to Stripe's secure checkout to complete payment with card or Apple Pay.
                  Your card details never touch this website.
                </p>
              </div>

              {formError && <p className="text-[11px] text-red-400">{formError}</p>}

              <Button type="submit" disabled={paying}
                className="w-full bg-[#2EC4C6] hover:bg-[#28B0B2] text-black font-medium h-11 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50">
                {paying ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                    Redirecting to secure checkout…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Pay {BRIEF_PRICE}
                  </span>
                )}
              </Button>
              <p className="text-[9px] text-gray-700 text-center">
                Powered by Stripe. A payment confirmation email will be sent after purchase.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
