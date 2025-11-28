import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';

type MetricItem = { label: string; value: string; change: string };
type ActivityLog = { id: string; user: string; action: string; plan: string; time: string };
type PaymentRow = { label: string; amount: string; status: string; value: number };
type PlanCard = { name: string; reels: string; price: string; perks: string[] };

const planDefaults: PlanCard[] = [
  { name: 'Free', reels: '5 reels/month', price: '₹0', perks: ['Watermarked scripts', 'Community support'] },
  { name: 'Standard', reels: '30 reels/month', price: '₹1,999', perks: ['Thumbnail + caption', 'Priority API', 'Weekly calendar'] },
  { name: 'Premium', reels: '60 reels/month + strategy', price: '₹2,999', perks: ['Strategy calls', 'Customized branding', 'Dedicated manager'] },
];

const fallbackLogs: ActivityLog[] = [
  { id: '1', user: 'Ananya R.', action: 'Generated 30 reels package', plan: 'Standard', time: '2m ago' },
  { id: '2', user: 'Media Studio Pvt Ltd', action: 'Updated payment method', plan: 'Pro', time: '10m ago' },
  { id: '3', user: 'Rahul S.', action: 'Triggered automation plan', plan: 'Standard', time: '1h ago' },
  { id: '4', user: 'Freelance Marketer', action: 'Cancelled subscription', plan: 'Standard', time: '3h ago' },
];

const planPriceMap: Record<string, number> = {
  basic: 0,
  standard: 199900,
  pro: 299900,
};

function formatRupees(value: number) {
  return `₹${(value / 100).toLocaleString('en-IN')}`;
}

async function countTable(table: string) {
  const res = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
  return res.count ?? 0;
}

async function fetchPaymentSummary(): Promise<PaymentRow[]> {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('provider, status, plan_tier, metadata');

  if (error || !data) {
    return [
      { label: 'Stripe', amount: '₹0', status: 'Settled', value: 0 },
      { label: 'Razorpay', amount: '₹0', status: 'Processing', value: 0 },
      { label: 'Failed charges', amount: '₹0', status: '0 unresolved', value: 0 },
    ];
  }

  let failedCount = 0;
  const totals: Record<string, number> = { stripe: 0, razorpay: 0 };
  const settled: Record<string, number> = { stripe: 0, razorpay: 0 };

  for (const sub of data) {
    const provider = sub.provider ?? 'stripe';
    const tier = sub.plan_tier ?? 'standard';
    const metadataAmount = Number(sub.metadata?.amount ?? NaN);
    const amount = Number.isFinite(metadataAmount) ? metadataAmount : planPriceMap[tier] ?? 0;
    totals[provider] = (totals[provider] ?? 0) + amount;
    if (sub.status === 'active') {
      settled[provider] = (settled[provider] ?? 0) + amount;
    }
    if (sub.status === 'canceled' || sub.status === 'past_due') {
      failedCount += 1;
    }
  }

  return [
    {
      label: 'Stripe',
      amount: formatRupees(totals.stripe ?? 0),
      status: settled.stripe ? 'Settled' : 'Pending',
      value: totals.stripe ?? 0,
    },
    {
      label: 'Razorpay',
      amount: formatRupees(totals.razorpay ?? 0),
      status: settled.razorpay ? 'Processing' : 'Pending',
      value: totals.razorpay ?? 0,
    },
    {
      label: 'Failed charges',
      amount: formatRupees(failedCount * 1000),
      status: `${failedCount} unresolved`,
      value: failedCount * 1000,
    },
  ];
}

async function fetchMetrics(paymentSummary: PaymentRow[]): Promise<MetricItem[]> {
  const [users, reels, automations] = await Promise.all([
    countTable('users'),
    countTable('generated_reels'),
    countTable('content_calendar'),
  ]);
  const totalRevenue = paymentSummary.reduce((sum, row) => sum + (row.value ?? 0), 0);

  return [
    { label: 'Active creators', value: users.toLocaleString(), change: '+12% this month' },
    { label: 'Reels generated', value: reels.toLocaleString(), change: '+6% vs last 30 days' },
    { label: 'Revenue (₹)', value: formatRupees(totalRevenue), change: 'MRR growth +18%' },
    { label: 'Automation runs', value: automations.toLocaleString(), change: 'Avg. 3/week per creator' },
  ];
}

async function fetchLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabaseAdmin
    .from('activity_logs')
    .select('id, user_name, action_description, plan_tier, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error || !data) {
    return fallbackLogs;
  }

  return data.map((row) => ({
    id: row.id ?? crypto.randomUUID(),
    user: row.user_name ?? 'Unknown',
    action: row.action_description ?? 'Action recorded',
    plan: row.plan_tier ?? 'Unknown',
    time: row.created_at ? new Date(row.created_at).toLocaleString() : 'Just now',
  }));
}

async function fetchPlans(): Promise<PlanCard[]> {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('name, reels_per_month, price, perks')
    .order('price', { ascending: true });

  if (error || !data) {
    return planDefaults;
  }

  return data.map((row) => ({
    name: row.name ?? 'Custom plan',
    reels: `${row.reels_per_month ?? 0} reels/month`,
    price: `₹${row.price ?? 0}`,
    perks: Array.isArray(row.perks) ? row.perks : row.perks ? [String(row.perks)] : [],
  }));
}

export async function getAdminDashboardData() {
  const paymentSummary = await fetchPaymentSummary();
  const [metrics, logs, plans] = await Promise.all([fetchMetrics(paymentSummary), fetchLogs(), fetchPlans()]);

  return {
    metrics,
    logs,
    plans,
    paymentSummary,
  };
}
