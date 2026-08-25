import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { BRIEF_PRICE_CENTS } from '@/lib/types';
import { SITE_URL } from '@/lib/site';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Real Stripe Checkout flow.
 * Creates a hosted Checkout Session for a $99.99 venture brief and returns the
 * redirect URL. The purchase row is created server-side by the webhook
 * (src/app/api/webhooks/stripe) when Stripe confirms the payment.
 */
export async function POST(request: Request) {
  // Throttle checkout attempts per IP (defense against abuse).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown';
  const rl = checkRateLimit(`checkout:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  let body: { brief_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const briefId = (body.brief_id ?? '').trim();
  if (!UUID_RE.test(briefId)) {
    return NextResponse.json({ error: 'Invalid brief id.' }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // Unconfigured (e.g. local dev without keys) — fail loudly, not silently.
    return NextResponse.json(
      { error: 'Payments are not configured yet. Please try again later.' },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to purchase.' }, { status: 401 });
  }

  const service = await createSupabaseServiceClient();

  const { data: brief, error: briefError } = await service
    .from('venture_briefs')
    .select('id,title,status,price_cents')
    .eq('id', briefId)
    .maybeSingle();

  if (briefError || !brief) {
    return NextResponse.json({ error: 'This venture brief is not available.' }, { status: 404 });
  }
  if (brief.status !== 'published') {
    return NextResponse.json({ error: 'This venture brief is not available for purchase yet.' }, { status: 404 });
  }

  // Already owned → no double charge, no new session.
  const { data: existing } = await service
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('brief_id', briefId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ alreadyOwned: true, brief_id: briefId });
  }

  const amountCents = brief.price_cents ?? BRIEF_PRICE_CENTS;

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      // Let Stripe's dashboard link back to the customer + brief.
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        brief_id: briefId,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: brief.title,
              description: 'Spacenomics venture brief — one-time purchase with lifetime access.',
            },
          },
        },
      ],
      success_url: `${SITE_URL}/checkout/${briefId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout/${briefId}?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Checkout could not be started. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe Checkout Session creation failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}
