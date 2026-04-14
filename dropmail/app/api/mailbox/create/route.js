// app/api/mailbox/create/route.js

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADJECTIVES = ['swift', 'quiet', 'lucky', 'brave', 'sharp', 'calm', 'wild', 'cool', 'slim', 'bold'];
const NOUNS = ['fox', 'hawk', 'wolf', 'bear', 'lynx', 'crow', 'dart', 'ember', 'flux', 'storm'];

const ROUTE_NAME = 'mailbox_create';

const LIMITS = {
  guest: { perMinute: 5, perHour: 20 },
  user: { perMinute: 10, perHour: 50 },
};

const PLAN_RULES = {
  ghost: {
    maxInboxes: 1,
    lifetimeMs: 10 * 60 * 1000,
    limitCode: 'GHOST_PLAN_LIMIT',
    limitMessage: 'Ghost plan allows 1 active inbox.',
  },
  phantom: {
    maxInboxes: 5,
    lifetimeMs: 24 * 60 * 60 * 1000,
    limitCode: 'PHANTOM_PLAN_LIMIT',
    limitMessage: 'Phantom allows up to 5 inboxes.',
  },
  spectre: {
    maxInboxes: 50,
    lifetimeMs: 365 * 24 * 60 * 60 * 1000,
    limitCode: 'SPECTRE_PLAN_LIMIT',
    limitMessage: 'Spectre allows up to 50 inboxes.',
  },
};

function normalizePlan(plan) {
  const p = String(plan || 'ghost').toLowerCase();
  if (p === 'spectre') return 'spectre';
  if (p === 'phantom') return 'phantom';
  return 'ghost';
}

function getPlanRules(plan) {
  return PLAN_RULES[normalizePlan(plan)];
}

function generateUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

// 🔥 IMPROVED RATE LIMIT (IP + USER SAFE)
async function enforceRateLimit({ request, userId }) {
  const ipHash = hashIp(getClientIp(request));
  const now = Date.now();

  const minuteAgo = new Date(now - 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const tier = userId ? 'user' : 'guest';
  const limits = LIMITS[tier];

  const [{ count: minute }, { count: hour }] = await Promise.all([
    supabase.from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', minuteAgo),

    supabase.from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', hourAgo),
  ]);

  if ((minute || 0) >= limits.perMinute) {
    return { ok: false, status: 429, body: { error: 'Slow down (1 min limit)' } };
  }

  if ((hour || 0) >= limits.perHour) {
    return { ok: false, status: 429, body: { error: 'Too many requests (1h limit)' } };
  }

  await supabase.from('api_rate_limits').insert({
    route: ROUTE_NAME,
    ip_hash: ipHash,
    user_id: userId,
  });

  return { ok: true };
}

// 🔥 STRONGER INBOX LIMIT CHECK
async function enforcePlanInboxLimit({ userId, plan }) {
  if (!userId) return { ok: true };

  const rules = getPlanRules(plan);

  const { count } = await supabase
    .from('mailboxes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString());

  if ((count || 0) >= rules.maxInboxes) {
    return {
      ok: false,
      status: 403,
      body: {
        error: rules.limitMessage,
        code: rules.limitCode,
      },
    };
  }

  return { ok: true };
}

// 🔥 ANTI-SPAM (PREVENT MASS CREATION BURST)
async function preventBurstCreation(userId) {
  if (!userId) return { ok: true };

  const recent = new Date(Date.now() - 10 * 1000).toISOString();

  const { count } = await supabase
    .from('mailboxes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', recent);

  if ((count || 0) >= 2) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too fast. Wait a few seconds.' },
    };
  }

  return { ok: true };
}

// 🔥 UNIQUE ADDRESS SAFE
async function generateUniqueAddress(domain, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const username = generateUsername();
    const address = `${username}@${domain}`;

    const { data } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('address', address)
      .limit(1);

    if (!data || data.length === 0) {
      return { username, address };
    }
  }

  throw new Error('Failed to generate unique address');
}

export async function POST(request) {
  try {
    let userId = null;
    let plan = 'ghost';

    const auth = request.headers.get('Authorization');

    if (auth?.startsWith('Bearer ')) {
      const token = auth.replace('Bearer ', '').trim();

      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        userId = user.id;

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();

        plan = normalizePlan(profile?.plan);
      }
    }

    // 🔒 RATE LIMIT
    const rate = await enforceRateLimit({ request, userId });
    if (!rate.ok) return Response.json(rate.body, { status: rate.status });

    // 🔒 BURST PROTECTION
    const burst = await preventBurstCreation(userId);
    if (!burst.ok) return Response.json(burst.body, { status: burst.status });

    // 🔒 PLAN LIMIT
    const limit = await enforcePlanInboxLimit({ userId, plan });
    if (!limit.ok) return Response.json(limit.body, { status: limit.status });

    const { data: domains } = await supabase
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (!domains?.length) {
      return Response.json({ error: 'No domain available' }, { status: 500 });
    }

    const domain = domains[0];

    const { username, address } = await generateUniqueAddress(domain.name);

    const rules = getPlanRules(plan);
    const expiresAt = new Date(Date.now() + rules.lifetimeMs);

    const { data, error } = await supabase
      .from('mailboxes')
      .insert({
        username,
        address,
        domain_id: domain.id,
        token: crypto.randomBytes(24).toString('hex'),
        user_id: userId,
        expires_at: expiresAt.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);

  } catch (err) {
    console.error('CREATE ERROR:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}