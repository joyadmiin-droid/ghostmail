import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return Response.json({ error: 'Token is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return Response.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    const plan = profile?.plan || 'free';

    const { data: mailbox, error: mailboxErr } = await supabase
      .from('mailboxes')
      .select('id, address, expires_at, is_active, user_id')
      .eq('token', token)
      .single();

    if (mailboxErr || !mailbox) {
      return Response.json({ error: 'Inbox not found or expired' }, { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ error: 'Inbox not found or expired' }, { status: 404 });
    }

    if (plan === 'free' && mailbox.user_id !== user.id) {
      return Response.json({ error: 'You do not have access to this inbox' }, { status: 403 });
    }

    const { data: emails, error: emailsErr } = await supabase
      .from('emails')
      .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
      .eq('mailbox_id', mailbox.id)
      .order('received_at', { ascending: false });

    if (emailsErr) {
      return Response.json({ error: 'Failed to fetch emails' }, { status: 500 });
    }

    return Response.json({
      mailbox: {
        id: mailbox.id,
        address: mailbox.address,
        expires_at: mailbox.expires_at,
        is_active: mailbox.is_active,
      },
      emails: emails || [],
      plan,
    });
  } catch (err) {
    console.error('Inbox route error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}