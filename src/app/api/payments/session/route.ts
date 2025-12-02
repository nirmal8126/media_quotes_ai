import { NextResponse } from 'next/server';
import { normalizePlanTier } from '@/lib/plan';
import { createCheckoutSession, persistSubscriptionRecord } from '@/lib/payments';
import { requireUser } from '@/lib/api-auth';

export async function POST(request: Request) {
  const sessionResult = await requireUser(request);
  if ('errorResponse' in sessionResult) {
    return sessionResult.errorResponse;
  }

  const { user, applyCookies } = sessionResult;
  const body = await request.json().catch(() => ({}));
  const desiredPlan = normalizePlanTier(body.plan);
  const provider = body.provider === 'stripe' ? 'stripe' : 'razorpay';

  const checkoutSession = await createCheckoutSession({
    userId: user.id,
    planTier: desiredPlan,
    provider,
  });

  await persistSubscriptionRecord({
    userId: user.id,
    provider,
    planTier: desiredPlan,
    providerSessionId: checkoutSession.sessionId,
    status: 'pending',
    metadata: { plan: checkoutSession.planTier, amount: checkoutSession.amount },
  });

  const response = NextResponse.json({
    message: 'Checkout session created',
    session: checkoutSession,
  });
  applyCookies(response);
  return response;
}
