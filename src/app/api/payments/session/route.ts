import { NextResponse } from 'next/server';
import { normalizePlanTier } from '@/lib/plan';
import { createCheckoutSession, persistSubscriptionRecord } from '@/lib/payments';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const desiredPlan = normalizePlanTier(body.plan);
  const provider = body.provider === 'stripe' ? 'stripe' : 'razorpay';

  const session = await createCheckoutSession({
    userId,
    planTier: desiredPlan,
    provider,
  });

  await persistSubscriptionRecord({
    userId,
    provider,
    planTier: desiredPlan,
    providerSessionId: session.sessionId,
    status: 'pending',
    metadata: { plan: session.planTier, amount: session.amount },
  });

  return NextResponse.json({
    message: 'Checkout session created',
    session,
  });
}
