export const PLANS = {
  ghost: {
    id: 'ghost',
    label: 'GHOST',
    displayName: 'Ghost',
    badge: 'Free Tier',
    priceMonthly: 0,
    emailLimit: 5,
    inboxLimit: 1,
    expiryLabel: '10 min',
  },

  phantom: {
    id: 'phantom',
    label: 'PHANTOM',
    displayName: 'Phantom',
    badge: 'Premium',
    priceMonthly: 4.99,
    emailLimit: 200,
    inboxLimit: 5,
    expiryLabel: '24h',
  },

  spectre: {
    id: 'spectre',
    label: 'SPECTRE',
    displayName: 'Spectre',
    badge: 'Premium',
    priceMonthly: 8.99,
    emailLimit: 600,
    inboxLimit: 50,
    expiryLabel: '365 days',
  },
};

export function normalizePlan(value) {
  const v = String(value || 'ghost').toLowerCase();

  if (v === 'spectre') return 'spectre';
  if (v === 'phantom') return 'phantom';
  if (v === 'ghost' || v === 'free') return 'ghost';

  return 'ghost';
}

export function getPlanConfig(value) {
  return PLANS[normalizePlan(value)] || PLANS.ghost;
}

export function getPlanDisplayName(value) {
  return getPlanConfig(value).label;
}

export function getPlanMrr(value) {
  return getPlanConfig(value).priceMonthly || 0;
}