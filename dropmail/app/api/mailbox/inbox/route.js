import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePlan(plan) {
  const value = String(plan || 'free').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  return 'free';
}

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return Response.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    const plan = normalizePlan(profile?.plan);

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

    let effectiveMailbox = mailbox;

    if (plan === 'free') {
      // Guest inbox trying to be claimed by a free user:
      // allow only if they do NOT already have another active inbox.
      if (!mailbox.user_id) {
        const { data: activeOwnedMailboxes, error: activeOwnedErr } = await supabase
          .from('mailboxes')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString());

        if (activeOwnedErr) {
          console.error('Active mailbox check error:', activeOwnedErr);
          return Response.json(
            { error: 'Failed to check your active inboxes' },
            { status: 500 }
          );
        }

        if (activeOwnedMailboxes && activeOwnedMailboxes.length >= 1) {
          return Response.json(
            { error: 'You already have an active inbox. Delete it or wait until it expires.' }
            { status: 403 }
          );
        }

        const { data: updatedMailbox, error: claimErr } = await supabase
          .from('mailboxes')
          .update({ user_id: user.id })
          .eq('id', mailbox.id)
          .is('user_id', null)
          .select('id, address, expires_at, is_active, user_id')
          .single();

        if (claimErr || !updatedMailbox) {
          console.error('Mailbox claim error:', claimErr);
          return Response.json(
            { error: 'Failed to attach inbox to your account' },
            { status: 500 }
          );
        }

        effectiveMailbox = updatedMailbox;
      } else if (mailbox.user_id !== user.id) {
        return Response.json(
          { error: 'You do not have access to this inbox' },
          { status: 403 }
        );
      }
    } else {
      // Paid users can open their own inboxes, and can claim guest inboxes.
      if (!mailbox.user_id) {
        const { data: updatedMailbox, error: claimErr } = await supabase
          .from('mailboxes')
          .update({ user_id: user.id })
          .eq('id', mailbox.id)
          .is('user_id', null)
          .select('id, address, expires_at, is_active, user_id')
          .single();

        if (claimErr || !updatedMailbox) {
          console.error('Mailbox claim error:', claimErr);
          return Response.json(
            { error: 'Failed to attach inbox to your account' },
            { status: 500 }
          );
        }

        effectiveMailbox = updatedMailbox;
      } else if (mailbox.user_id !== user.id) {
        return Response.json(
          { error: 'You do not have access to this inbox' },
          { status: 403 }
        );
      }
    }

    const { data: emails, error: emailsErr } = await supabase
      .from('emails')
      .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
      .eq('mailbox_id', effectiveMailbox.id)
      .order('received_at', { ascending: false });

    if (emailsErr) {
      console.error('Emails fetch error:', emailsErr);
      return Response.json({ error: 'Failed to fetch emails' }, { status: 500 });
    }

    return Response.json({
      mailbox: {
        id: effectiveMailbox.id,
        address: effectiveMailbox.address,
        expires_at: effectiveMailbox.expires_at,
        is_active: effectiveMailbox.is_active,
      },
      emails: emails || [],
      plan,
    });
  } catch (err) {
    console.error('Inbox route error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}