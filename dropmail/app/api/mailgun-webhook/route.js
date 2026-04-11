import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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

    const toAddress = recipient?.toLowerCase().trim();

    const { data: mailbox, error: mailboxErr } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('address', toAddress)
      .single();

    if (mailboxErr || !mailbox) {
      console.log('Mailbox not found for:', toAddress);
      return Response.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    const fromName = from?.match(/^([^<]+)</)?.[1]?.trim() || sender;

    const { data: insertedEmail, error: insertErr } = await supabase
      .from('emails')
      .insert({
        mailbox_id: mailbox.id,
        from_address: sender,
        from_name: fromName,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        received_at: new Date().toISOString(),
        is_read: false,
      })
      .select('id')
      .single();

    if (insertErr || !insertedEmail) {
      console.error('Insert email error:', insertErr);
      return Response.json({ error: 'Failed to save email' }, { status: 500 });
    }

    const attachmentRows = [];
    const emailId = insertedEmail.id;

    for (const [key, value] of formData.entries()) {
      if (!(value instanceof File)) continue;
      if (!value.name || value.size === 0) continue;

      const safeName = value.name.replace(/[^\w.\-]/g, '_');
      const storagePath = `${mailbox.id}/${emailId}/${randomUUID()}-${safeName}`;

      const arrayBuffer = await value.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const { error: uploadErr } = await supabase.storage
        .from('attachments')
        .upload(storagePath, fileBuffer, {
          contentType: value.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadErr) {
        console.error('Attachment upload error:', uploadErr);
        continue;
      }

      attachmentRows.push({
        email_id: emailId,
        filename: value.name,
        mime_type: value.type || 'application/octet-stream',
        size_bytes: value.size || 0,
        storage_path: storagePath,
      });
    }

    if (attachmentRows.length > 0) {
      const { error: attachmentInsertErr } = await supabase
        .from('attachments')
        .insert(attachmentRows);

      if (attachmentInsertErr) {
        console.error('Attachment insert error:', attachmentInsertErr);
      }
    }

    return Response.json({
      success: true,
      email_id: emailId,
      attachments_saved: attachmentRows.length,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}