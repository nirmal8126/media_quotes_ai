const planLimits = {
  basic: 15,
  standard: 30,
  pro: 60,
} as const;

export type PlanTier = keyof typeof planLimits;

export interface QuotaStatus {
  planTier: PlanTier;
  limit: number;
  used: number;
  remaining: number;
  allowsGeneration: boolean;
  nextUsed: number;
}

export function normalizePlanTier(planTier?: string): PlanTier {
  if (planTier && planTier in planLimits) {
    return planTier as PlanTier;
  }
  return 'standard';
}

export function evaluateQuota(planTier?: string, quotaUsed?: number): QuotaStatus {
  const normalized = normalizePlanTier(planTier);
  const used = Math.max(0, quotaUsed ?? 0);
  const limit = planLimits[normalized];
  const allowsGeneration = used < limit;
  const remaining = Math.max(limit - used, 0);

  return {
    planTier: normalized,
    limit,
    used,
    remaining,
    allowsGeneration,
    nextUsed: Math.min(limit, used + 1),
  };
}

export function limitForTier(planTier?: string): number {
  const normalized = normalizePlanTier(planTier);
  return planLimits[normalized];
}

export function checkoutUrlForTier(planTier: PlanTier): string {
  return `https://pay.mediaquotes.ai/checkout/${planTier}`;
}
