import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BRIEF_PRICE_CENTS } from '@/lib/types';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook endpoint.
 *
 * Listens for checkout.session.completed and grants the customer a purchase
 * row in the `purchases` table, which is what /library and the ownership hook
 * read. Idempotent: the unique index (user_id, brief_id) makes a duplicate
 * webhook delivery a no-op, so a customer can never be double charged or
 * double granted.
 *
 * The route is public in src/proxy.ts (Stripe has no user session); trust is
 * established by verifying the Stripe-Signature header against
 * STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('Stripe webhook hit but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET are not configured.');
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header.' }, { status: 400 });
  }

  // Must use the raw body — Stripe signs the exact bytes, not parsed JSON.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(secretKey);
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const briefId = session.metadata?.brief_id;

    // Only grant access once Stripe has actually captured the payment.
    if (userId && briefId && session.payment_status === 'paid') {
      const service = await createSupabaseServiceClient();
      const amountCents = session.amount_total ?? BRIEF_PRICE_CENTS;

      const { error } = await service.from('purchases').upsert(
        {
          user_id: userId,
          brief_id: briefId,
          amount_cents: amountCents,
          status: 'paid',
        },
        { onConflict: 'user_id,brief_id', ignoreDuplicates: true }
      );

      if (error) {
        // Transient DB failure → let Stripe retry the delivery.
        console.error('Webhook purchase insert failed:', error.message, { userId, briefId });
        return NextResponse.json({ error: 'Failed to record purchase.' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
