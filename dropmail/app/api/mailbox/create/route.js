import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADJECTIVES = ['swift', 'quiet', 'lucky', 'brave', 'sharp', 'calm', 'wild', 'cool', 'slim', 'bold'];
const NOUNS = ['fox', 'hawk', 'wolf', 'bear', 'lynx', 'crow', 'dart', 'ember', 'flux', 'storm'];

function generateUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}${num}`;
}

function generateToken() {
  return randomBytes(32).toString('hex');
}

function getExpiryForPlan(plan) {
  switch (plan) {
    case 'spectre':
      return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    case 'phantom':
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    default:
      return new Date(Date.now() + 10 * 60 * 1000);
  }
}

export async function POST(request) {
  try {
    let plan = 'free';
    let userId = null;

    const authHeader = request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();

      if (token) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (userError) {
          console.error('Auth getUser error:', userError);
        }

        if (user) {
          userId = user.id;

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', user.id)
            .maybeSingle();

          if (profileError) {
            console.error('Profile fetch error:', profileError);
          }

          if (profile?.plan) {
            plan = profile.plan;
          }
        }
      }
    }

    const { data: domains, error: domainErr } = await supabase
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(10);

    if (domainErr) {
      console.error('Domain fetch error:', domainErr);
      return Response.json({ error: 'Failed to load active domains' }, { status: 500 });
    }

    if (!domains?.length) {
      return Response.json({ error: 'No active domains available' }, { status: 503 });
    }

    const domain = domains[Math.floor(Math.random() * domains.length)];

    let username;
    let address;
    let existing = null;
    let attempts = 0;

    do {
      username = generateUsername();
      address = `${username}@${domain.name}`;

      const { data, error: existingErr } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('address', address)
        .maybeSingle();

      if (existingErr) {
        console.error('Mailbox uniqueness check error:', existingErr);
        return Response.json({ error: 'Failed to verify mailbox uniqueness' }, { status: 500 });
      }

      existing = data;
      attempts++;
    } while (existing && attempts < 5);

    if (existing) {
      return Response.json({ error: 'Could not generate unique address, try again' }, { status: 500 });
    }

    const token = generateToken();
    const expiresAt = getExpiryForPlan(plan);

    const { data: mailbox, error: insertErr } = await supabase
      .from('mailboxes')
      .insert({
        address,
        username,
        domain_id: domain.id,
        token,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        user_id: userId,
      })
      .select('id, address, token, expires_at, created_at')
      .single();

    if (insertErr) {
      console.error('Mailbox insert error:', insertErr);
      return Response.json(
        { error: insertErr.message || 'Failed to create mailbox' },
        { status: 500 }
      );
    }

    return Response.json({
      id: mailbox.id,
      address: mailbox.address,
      token: mailbox.token,
      expires_at: mailbox.expires_at,
      created_at: mailbox.created_at,
      plan,
    });
  } catch (err) {
    console.error('Unexpected mailbox route error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}