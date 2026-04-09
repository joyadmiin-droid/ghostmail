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
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
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
      } = await supabase.auth.getUser(token);

      if (user) {
        userId = user.id;

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();

        plan = profile?.plan || 'free';
      }
    }

    // 🔥 IMPORTANT: Restrict FREE users to 1 active inbox
    if (userId && plan === 'free') {
      const { data: activeMailboxes } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

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

    const username = generateUsername();
    const domain = 'ghostmails.org';
    const address = `${username}@${domain}`;
    const token = randomBytes(24).toString('hex');

    let expiresAt;

    if (plan === 'spectre') {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    } else if (plan === 'phantom') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    } else {
      expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    }

    const { data: mailbox, error } = await supabase
      .from('mailboxes')
      .insert([
        {
          address,
          token,
          user_id: userId,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return Response.json(
  { error: error.message || error },
  { status: 500 }
);
    }

    return Response.json(mailbox);
  } catch (err) {
    console.error('Create mailbox error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}