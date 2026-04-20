// app/api/mailbox/create/route.js

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { rateLimit } from '@/app/lib/rate-limit';

const limiter = rateLimit({ limit: 20, windowMs: 60 * 1000 });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const ADJECTIVES = [
  'swift',
  'quiet',
  'lucky',
  'brave',
  'sharp',
  'calm',
  'wild',
  'cool',
  'slim',
  'bold',
];

const NOUNS = [
  'fox',
  'hawk',
  'wolf',
  'bear',
  'lynx',
  'crow',
  'dart',
  'ember',
  'flux',
  'storm',
];

const ROUTE_NAME = 'mailbox_create';
const ADDRESS_ATTEMPTS = 12;

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

function getBearerToken(request) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function getUserClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function isUniqueViolation(error) {
  return error?.code === '23505';
}

async function verifyTurnstileToken({ token, ip }) {
  if (!TURNSTILE_SECRET_KEY) {
    console.error('Missing TURNSTILE_SECRET_KEY');
    return { ok: false, reason: 'turnstile_not_configured' };
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_turnstile_token' };
  }

  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
  });

  if (ip && ip !== 'unknown') {
    body.set('remoteip', ip);
  }

  let response;
  let data;

  try {
    response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    });

    data = await response.json();
  } catch (error) {
    console.error('Turnstile verification request failed:', error);
    return { ok: false, reason: 'turnstile_request_failed' };
  }

  if (!response.ok) {
    console.error('Turnstile verification HTTP error:', response.status, data);
    return { ok: false, reason: 'turnstile_http_error' };
  }

  if (!data?.success) {
    console.error('Turnstile verification failed:', data);
    return { ok: false, reason: 'turnstile_invalid' };
  }

  return { ok: true };
}

async function enforceRateLimit({ request, userId }) {
  const ipHash = hashIp(getClientIp(request));
  const now = Date.now();

  const minuteAgo = new Date(now - 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const tier = userId ? 'user' : 'guest';
  const limits = LIMITS[tier];

  const [minuteResult, hourResult] = await Promise.all([
    supabaseAdmin
      .from('api_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', minuteAgo),

    supabaseAdmin
      .from('api_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', hourAgo),
  ]);

  if (minuteResult.error || hourResult.error) {
    console.error('Rate limit lookup error:', minuteResult.error || hourResult.error);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to verify rate limit' },
    };
  }

  const minute = minuteResult.count || 0;
  const hour = hourResult.count || 0;

  if (minute >= limits.perMinute) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Slow down (1 min limit)' },
    };
  }

  if (hour >= limits.perHour) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many requests (1h limit)' },
    };
  }

  const { error: insertError } = await supabaseAdmin.from('api_rate_limits').insert({
    route: ROUTE_NAME,
    ip_hash: ipHash,
    user_id: userId,
  });

  if (insertError) {
    console.error('Rate limit insert error:', insertError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to record rate limit' },
    };
  }

  return { ok: true };
}

async function enforcePlanInboxLimit({ userId, plan }) {
  if (!userId) return { ok: true };

  const rules = getPlanRules(plan);

  const { count, error } = await supabaseAdmin
    .from('mailboxes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Inbox limit check error:', error);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to check inbox limits' },
    };
  }

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

async function preventBurstCreation(userId) {
  if (!userId) return { ok: true };

  const recent = new Date(Date.now() - 10 * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from('mailboxes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', recent);

  if (error) {
    console.error('Burst creation check error:', error);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to verify recent inbox creation' },
    };
  }

  if ((count || 0) >= 2) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too fast. Wait a few seconds.' },
    };
  }

  return { ok: true };
}

async function createMailboxWithRetries({ domain, userId, expiresAt }) {
  for (let i = 0; i < ADDRESS_ATTEMPTS; i += 1) {
    const username = generateUsername();
    const address = `${username}@${domain.name}`;

    const { data, error } = await supabaseAdmin
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
      .select('id, username, address, token, expires_at, is_active, created_at')
      .single();

    if (!error && data) {
      return data;
    }

    if (isUniqueViolation(error)) {
      continue;
    }

    console.error('Mailbox insert error:', error);
    throw new Error('Failed to create mailbox');
  }

  throw new Error('Failed to generate unique address');
}

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const { success } = limiter(ip);

    if (!success) {
      return Response.json({ error: 'Too many requests' }, { status: 429 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const turnstileToken = formData.get('turnstileToken');

    const turnstileCheck = await verifyTurnstileToken({
      token: turnstileToken,
      ip,
    });

    if (!turnstileCheck.ok) {
      return Response.json(
        { error: 'Security verification failed. Please try again.' },
        { status: 403 }
      );
    }

    let userId = null;
    let plan = 'ghost';
    let extraEmailCredits = 0;

    const accessToken = getBearerToken(request);

    if (accessToken) {
      const supabaseUser = getUserClient(accessToken);

      const {
        data: { user },
        error: authError,
      } = await supabaseUser.auth.getUser();

      if (authError) {
        console.error('Mailbox create auth error:', authError);
        return Response.json({ error: 'Invalid auth' }, { status: 401 });
      }

      if (user) {
        userId = user.id;

        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('plan, extra_email_credits')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Mailbox create profile load error:', profileError);
          return Response.json(
            { error: 'Failed to load profile' },
            { status: 500 }
          );
        }

        plan = normalizePlan(profile?.plan);
        extraEmailCredits = Math.max(0, Number(profile?.extra_email_credits || 0));
      }
    }

    const rate = await enforceRateLimit({ request, userId });
    if (!rate.ok) return Response.json(rate.body, { status: rate.status });

    const burst = await preventBurstCreation(userId);
    if (!burst.ok) return Response.json(burst.body, { status: burst.status });

    const limit = await enforcePlanInboxLimit({ userId, plan });
    if (!limit.ok) return Response.json(limit.body, { status: limit.status });

    const { data: domains, error: domainsError } = await supabaseAdmin
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (domainsError) {
      console.error('Domain load error:', domainsError);
      return Response.json({ error: 'Failed to load domain' }, { status: 500 });
    }

    if (!domains?.length) {
      return Response.json({ error: 'No domain available' }, { status: 500 });
    }

    const domain = domains[0];
    const rules = getPlanRules(plan);
    const expiresAt = new Date(Date.now() + rules.lifetimeMs);

    const mailbox = await createMailboxWithRetries({
      domain,
      userId,
      expiresAt,
    });

    return Response.json({
      id: mailbox.id,
      username: mailbox.username,
      address: mailbox.address,
      token: mailbox.token,
      expires_at: mailbox.expires_at,
      is_active: mailbox.is_active,
      created_at: mailbox.created_at,
      plan,
      extra_email_credits: extraEmailCredits,
    });
  } catch (err) {
    console.error('CREATE ERROR:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}