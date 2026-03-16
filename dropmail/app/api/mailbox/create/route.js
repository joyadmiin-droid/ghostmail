import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // use service role here (server-only)
);

// Adjectives + nouns for readable random usernames
const ADJECTIVES = ['swift', 'quiet', 'lucky', 'brave', 'sharp', 'calm', 'wild', 'cool', 'slim', 'bold'];
const NOUNS      = ['fox', 'hawk', 'wolf', 'bear', 'lynx', 'crow', 'dart', 'ember', 'flux', 'storm'];

function generateUsername() {
  const adj  = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num  = Math.floor(100 + Math.random() * 900); // 3-digit number
  return `${adj}${noun}${num}`;
}

function generateToken() {
  return randomBytes(32).toString('hex'); // 64-char hex string
}

export async function POST() {
  try {
    // 1. Pick an active domain from DB
    const { data: domains, error: domainErr } = await supabase
      .from('domains')
      .select('id, name')
      .eq('is_active', true)
      .limit(10);

    if (domainErr || !domains?.length) {
      return Response.json({ error: 'No active domains available' }, { status: 503 });
    }

    // Pick a random domain from the list
    const domain = domains[Math.floor(Math.random() * domains.length)];

    // 2. Generate unique username (retry up to 5 times on collision)
    let username, address, existing;
    let attempts = 0;

    do {
      username = generateUsername();
      address  = `${username}@${domain.name}`;

      const { data } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('address', address)
        .maybeSingle();

      existing = data;
      attempts++;
    } while (existing && attempts < 5);

    if (existing) {
      return Response.json({ error: 'Could not generate unique address, try again' }, { status: 500 });
    }

    // 3. Create the mailbox
    const token     = generateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes

    const { data: mailbox, error: insertErr } = await supabase
      .from('mailboxes')
      .insert({
        address,
        username,
        domain_id:  domain.id,
        token,
        expires_at: expiresAt.toISOString(),
        is_active:  true,
      })
      .select('id, address, token, expires_at, created_at')
      .single();

    if (insertErr) {
      console.error('Mailbox insert error:', insertErr);
      return Response.json({ error: 'Failed to create mailbox' }, { status: 500 });
    }

    // 4. Return only what the client needs
    return Response.json({
      id:         mailbox.id,
      address:    mailbox.address,
      token:      mailbox.token,
      expires_at: mailbox.expires_at,
      created_at: mailbox.created_at,
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Only POST is allowed
export async function GET() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
