export function normalizePlan(plan) {
  return String(plan || 'ghost').toLowerCase();
}

export function getPlanConfig(plan) {
  const p = normalizePlan(plan);

  if (p === 'spectre') {
    return {
      name: 'Spectre',
      inboxLimit: 30,
      emailLimit: 600,
      expiry: '365 days',
    };
  }

  if (p === 'phantom') {
    return {
      name: 'Phantom',
      inboxLimit: 5,
      emailLimit: 200,
      expiry: '24 hours',
    };
  }

  return {
    name: 'Ghost',
    inboxLimit: 1,
    emailLimit: 5,
    expiry: '10 minutes',
  };
}

export function getPlanDisplayName(plan) {
  return getPlanConfig(plan).name;
}

export function getPlanMrr(plan) {
  const p = normalizePlan(plan);
  if (p === 'phantom') return 4.99;
  if (p === 'spectre') return 8.99;
  return 0;
}

export function getPlanArr(plan) {
  return getPlanMrr(plan) * 12;
}