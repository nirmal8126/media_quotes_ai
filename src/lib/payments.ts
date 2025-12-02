import Stripe from 'stripe';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { PlanTier } from '@/lib/plan';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable for payments`);
  }
  return value;
}

const RAZORPAY_KEY_ID = requiredEnv('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = requiredEnv('RAZORPAY_KEY_SECRET');
const STRIPE_SECRET_KEY = requiredEnv('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = requiredEnv('STRIPE_WEBHOOK_SECRET');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://creator.mediaquotes.ai';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20' });

export const planCatalog: Record<PlanTier, { displayName: string; amount: number; summary: string }> = {
  basic: { displayName: 'Basic', amount: 99900, summary: '15 reels / month' },
  standard: { displayName: 'Standard', amount: 199900, summary: '30 reels / month' },
  pro: { displayName: 'Pro', amount: 299900, summary: '60 reels + strategy' },
};

export interface CheckoutSessionResult {
  provider: 'razorpay' | 'stripe';
  checkoutUrl: string;
  sessionId: string;
  amount: number;
  planTier: PlanTier;
}

export async function createCheckoutSession(options: {
  userId: string;
  planTier: PlanTier;
  provider: 'razorpay' | 'stripe';
}): Promise<CheckoutSessionResult> {
  const { provider, planTier, userId } = options;
  const plan = planCatalog[planTier];

  if (provider === 'razorpay') {
    const body = {
      amount: plan.amount,
      currency: 'INR',
      receipt: `rq_${Date.now()}`,
      payment_capture: 1,
      notes: { userId, planTier },
    };

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to create Razorpay order.');
    }

    const data = await response.json();
    return {
      provider,
      checkoutUrl: `https://checkout.razorpay.com/v1/checkout.js?order_id=${data.id}`,
      sessionId: data.id,
      amount: plan.amount,
      planTier,
    };
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'INR',
          product_data: {
            name: `MediaQuotes AI ${plan.displayName}`,
            description: plan.summary,
          },
          recurring: { interval: 'month' },
          unit_amount: plan.amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/dashboard`,
    metadata: { userId, planTier },
  });

  if (!session.url) {
    throw new Error('Stripe checkout session created without URL.');
  }

  return {
    provider,
    checkoutUrl: session.url,
    sessionId: session.id,
    amount: plan.amount,
    planTier,
  };
}

export async function persistSubscriptionRecord(payload: {
  userId: string;
  provider: 'razorpay' | 'stripe';
  planTier: PlanTier;
  providerSessionId: string;
  status: 'pending' | 'active' | 'past_due' | 'canceled';
  metadata?: Record<string, unknown>;
}) {
  const { userId, provider, planTier, status, providerSessionId, metadata } = payload;
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        provider,
        plan_tier: planTier,
        provider_subscription_id: providerSessionId,
        status,
        metadata,
        valid_until: null,
      },
      { onConflict: 'provider_subscription_id' }
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to persist subscription record', error);
    throw error;
  }

  return data;
}

export async function applyPlanToUser(userId: string, planTier: PlanTier) {
  await supabaseAdmin.from('users').update({ plan_tier: planTier, quota_used: 0 }).eq('id', userId);
}

export function verifyRazorpaySignature(payload: string, signature: string) {
  const expected = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(payload).digest('hex');
  return expected === signature;
}

export function constructStripeEvent(payload: string, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}
