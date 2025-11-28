import { NextResponse } from 'next/server';
import { applyPlanToUser, constructStripeEvent, persistSubscriptionRecord, verifyRazorpaySignature } from '@/lib/payments';
import { normalizePlanTier } from '@/lib/plan';

export async function POST(req: Request) {
  const payload = await req.text();
  const razorSig = req.headers.get('x-razorpay-signature');
  const stripeSig = req.headers.get('stripe-signature');

  if (stripeSig) {
    const event = constructStripeEvent(payload, stripeSig);
    const metadata = event.data.object.metadata ?? {};
    const userId = metadata.userId as string;
    const planTier = normalizePlanTier(metadata.planTier as string);
    const sessionId = event.data.object.id as string;
    const status = event.type === 'checkout.session.completed' ? 'active' : 'past_due';

    await persistSubscriptionRecord({
      userId,
      provider: 'stripe',
      planTier,
      providerSessionId: sessionId,
      status,
      metadata: { eventType: event.type, raw: event },
    });

    if (status === 'active' && userId) {
      await applyPlanToUser(userId, planTier);
    }

    return NextResponse.json({ message: 'Stripe webhook processed', event: event.type });
  }

  if (razorSig) {
    if (!verifyRazorpaySignature(payload, razorSig)) {
      return NextResponse.json({ error: 'Invalid Razorpay signature' }, { status: 400 });
    }

    const event = JSON.parse(payload);
    const notes = event.payload?.subscription?.entity?.notes ?? event.payload?.payment?.entity?.notes ?? {};
    const userId = notes.userId as string;
    const planTier = normalizePlanTier(notes.planTier as string);
    const subscriptionId = event.payload?.subscription?.entity?.id ?? `razorpay_${Date.now()}`;
    const eventType = event.event || 'razorpay.payment.captured';

    await persistSubscriptionRecord({
      userId,
      provider: 'razorpay',
      planTier,
      providerSessionId: subscriptionId,
      status: 'active',
      metadata: { eventType, raw: event },
    });

    if (userId) {
      await applyPlanToUser(userId, normalizePlanTier(planTier));
    }

    return NextResponse.json({ message: 'Razorpay webhook processed', event: eventType });
  }

  return NextResponse.json({ error: 'Missing payment provider signature' }, { status: 400 });
}
