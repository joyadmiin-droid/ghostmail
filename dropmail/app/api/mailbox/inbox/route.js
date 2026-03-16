import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return Response.json({ error: 'Token is required' }, { status: 400 });
  }

  // Find the mailbox by token
  const { data: mailbox, error: mailboxErr } = await supabase
    .from('mailboxes')
    .select('id, address, expires_at, is_active')
    .eq('token', token)
    .single();

  if (mailboxErr || !mailbox) {
    return Response.json({ error: 'Inbox not found or expired' }, { status: 404 });
  }

  // Fetch emails for this mailbox, newest first
  const { data: emails, error: emailsErr } = await supabase
    .from('emails')
    .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
    .eq('mailbox_id', mailbox.id)
    .order('received_at', { ascending: false });

  if (emailsErr) {
    return Response.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }

  return Response.json({ mailbox, emails: emails || [] });
}
