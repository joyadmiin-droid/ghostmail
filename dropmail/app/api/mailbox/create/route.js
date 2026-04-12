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

// Tighter for anonymous users, looser for authenticated users
const LIMITS = {
  guest: {
    perMinute: 5,
    perHour: 20,
  },
  user: {
    perMinute: 10,
    perHour: 50,
  },
};

function normalizePlan(plan) {
  const value = String(plan || 'free').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  return 'free';
}

function getPlanLifetimeMs(plan) {
  if (plan === 'spectre') return 365 * 24 * 60 * 60 * 1000;
  if (plan === 'phantom') return 24 * 60 * 60 * 1000;
  return 10 * 60 * 1000; // free/guest
}

function generateUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  return 'unknown';
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

async function enforceRateLimit({ request, userId }) {
  const rawIp = getClientIp(request);
  const ipHash = hashIp(rawIp);
  const now = Date.now();

  const oneMinuteAgoIso = new Date(now - 60 * 1000).toISOString();
  const oneHourAgoIso = new Date(now - 60 * 60 * 1000).toISOString();

  const tier = userId ? 'user' : 'guest';
  const limits = LIMITS[tier];

  const [{ count: minuteCount, error: minuteError }, { count: hourCount, error: hourError }] =
    await Promise.all([
      supabase
        .from('api_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('route', ROUTE_NAME)
        .eq('ip_hash', ipHash)
        .gte('created_at', oneMinuteAgoIso),

      supabase
        .from('api_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('route', ROUTE_NAME)
        .eq('ip_hash', ipHash)
        .gte('created_at', oneHourAgoIso),
    ]);

  if (minuteError || hourError) {
    console.error('Rate limit count error:', minuteError || hourError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Rate limit check failed' },
    };
  }

  if ((minuteCount || 0) >= limits.perMinute) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Too many requests. Please wait a minute and try again.',
        code: 'RATE_LIMIT_MINUTE',
      },
    };
  }

  if ((hourCount || 0) >= limits.perHour) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_HOUR',
      },
    };
  }

  const { error: insertError } = await supabase
    .from('api_rate_limits')
    .insert([
      {
        route: ROUTE_NAME,
        ip_hash: ipHash,
        user_id: userId,
      },
    ]);

  if (insertError) {
    console.error('Rate limit insert error:', insertError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Rate limit logging failed' },
    };
  }

  return { ok: true };
}

async function generateUniqueAddress(domainName, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const username = generateUsername();
    const address = `${username}@${domainName}`;

    const { data: existing, error } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('address', address)
      .limit(1);

    if (error) {
      throw new Error('Failed checking address uniqueness');
    }

    if (!existing || existing.length === 0) {
      return { username, address };
    }
  }

  throw new Error('Failed to generate unique address');
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    let userId = null;
    let plan = 'free';

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);

      if (authError) {
        console.error('Auth lookup error:', authError);
      }

      if (user) {
        userId = user.id;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile lookup error:', profileError);
        }

        plan = normalizePlan(profile?.plan);
      }
    }

    const rateLimit = await enforceRateLimit({ request, userId });

    if (!rateLimit.ok) {
      return Response.json(rateLimit.body, { status: rateLimit.status });
    }

    const nowIso = new Date().toISOString();

    if (userId && plan === 'free') {
      const { data: activeMailboxes, error: activeMailboxesError } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', nowIso);

      if (activeMailboxesError) {
        console.error('Active mailbox check error:', activeMailboxesError);
        return Response.json(
          { error: 'Failed to validate plan limits' },
          { status: 500 }
        );
      }

      if (activeMailboxes && activeMailboxes.length >= 1) {
        return Response.json(
          {
            error: 'Free plan allows 1 active inbox at a time.',
            code: 'FREE_PLAN_LIMIT',
          },
          { status: 403 }
        );
      }
    }

    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (domainsError) {
      console.error('Domain lookup error:', domainsError);
      return Response.json(
        { error: 'Failed to load active domain' },
        { status: 500 }
      );
    }

    if (!domains || domains.length === 0) {
      return Response.json(
        { error: 'No active domain available' },
        { status: 500 }
      );
    }

    const domainRow = domains[0];
    const { username, address } = await generateUniqueAddress(domainRow.name);
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + getPlanLifetimeMs(plan));

    const { data: mailbox, error: insertError } = await supabase
      .from('mailboxes')
      .insert([
        {
          username,
          address,
          domain_id: domainRow.id,
          token,
          user_id: userId,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Mailbox insert error:', insertError);
      return Response.json(
        { error: insertError.message || 'Failed to create mailbox' },
        { status: 500 }
      );
    }

    return Response.json(mailbox);
  } catch (err) {
    console.error('Mailbox create error:', err);
    return Response.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}