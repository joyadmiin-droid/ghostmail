// app/api/mailbox/create/route.js

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADJECTIVES = ['swift', 'quiet', 'lucky', 'brave', 'sharp', 'calm', 'wild', 'cool', 'slim', 'bold'];
const NOUNS = ['fox', 'hawk', 'wolf', 'bear', 'lynx', 'crow', 'dart', 'ember', 'flux', 'storm'];

function normalizePlan(plan) {
  const value = String(plan || 'free').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  return 'free';
}

function getPlanLifetimeMs(plan) {
  if (plan === 'spectre') return 365 * 24 * 60 * 60 * 1000;
  if (plan === 'phantom') return 24 * 60 * 60 * 1000;
  return 10 * 60 * 1000; // default free/guest
}

function generateUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

async function generateUniqueAddress(domainName, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const username = generateUsername();
    const address = `${username}@${domainName}`;

    const { data: existing } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('address', address)
      .limit(1);

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

    // ✅ OPTIONAL AUTH (NOT REQUIRED ANYMORE)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();

      const {
        data: { user },
      } = await supabase.auth.getUser(token);

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

    const nowIso = new Date().toISOString();

    // ✅ ONLY APPLY LIMITS IF USER EXISTS
    if (userId && plan === 'free') {
      const { data: activeMailboxes } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', nowIso);

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

    // ✅ GET DOMAIN
    const { data: domains } = await supabase
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

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
          user_id: userId, // 👈 can be NULL now
          expires_at: expiresAt.toISOString(),
          is_active: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return Response.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return Response.json(mailbox);
  } catch (err) {
    return Response.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}