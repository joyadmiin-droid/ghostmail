import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADJECTIVES = ['swift', 'quiet', 'lucky', 'brave', 'sharp', 'calm', 'wild', 'cool', 'slim', 'bold'];
const NOUNS = ['fox', 'hawk', 'wolf', 'bear', 'lynx', 'crow', 'dart', 'ember', 'flux', 'storm'];

function generateUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    let userId = null;
    let plan = 'free';

    if (authHeader?.startsWith('Bearer ')) {
      const bearerToken = authHeader.replace('Bearer ', '').trim();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(bearerToken);

      if (authError) {
        console.error('Auth error:', authError);
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

        plan = profile?.plan || 'free';
      }
    }

    // Free plan = 1 active inbox at a time
    if (userId && plan === 'free') {
      const { data: activeMailboxes, error: activeError } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      if (activeError) {
        console.error('Active mailbox check error:', activeError);
        return Response.json(
          { error: 'Failed to check active inboxes' },
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

    // Load one active domain from DB
    const { data: domains, error: domainsError } = await supabase
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (domainsError) {
      console.error('Domains fetch error:', domainsError);
      return Response.json(
        { error: domainsError.message || 'Failed to load domains' },
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

    const username = generateUsername();
    const address = `${username}@${domainRow.name}`;
    const token = crypto.randomBytes(24).toString('hex');

    let expiresAt;

    if (plan === 'spectre') {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else if (plan === 'phantom') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    }

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
      console.error('Insert error:', insertError);
      return Response.json(
        { error: insertError.message || 'Failed to create mailbox' },
        { status: 500 }
      );
    }

    return Response.json(mailbox);
  } catch (err) {
    console.error('Create mailbox error:', err);
    return Response.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}