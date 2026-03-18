import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const formData = await request.formData();

    const recipient = formData.get('recipient');
    const sender = formData.get('sender');
    const from = formData.get('from');
    const subject = formData.get('subject') || '(no subject)';
    const bodyHtml = formData.get('body-html') || '';
    const bodyText = formData.get('body-plain') || '';

    // Extract the email address part only
    const toAddress = recipient?.toLowerCase().trim();

    // Find the mailbox by address
    const { data: mailbox, error: mailboxErr } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('address', toAddress)
      .single();

    if (mailboxErr || !mailbox) {
      console.log('Mailbox not found for:', toAddress);
      return Response.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // Extract from name
    const fromName = from?.match(/^([^<]+)</)?.[1]?.trim() || sender;

    // Save email to database
    const { error: insertErr } = await supabase
      .from('emails')
      .insert({
        mailbox_id: mailbox.id,
        from_address: sender,
        from_name: fromName,
        subject: subject,
        body_html: bodyHtml,
        body_text: bodyText,
        received_at: new Date().toISOString(),
        is_read: false,
      });

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return Response.json({ error: 'Failed to save email' }, { status: 500 });
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}