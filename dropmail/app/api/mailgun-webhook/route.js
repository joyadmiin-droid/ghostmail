import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const MAX_WEBHOOK_AGE_SECONDS = 15 * 60; // 15 minutes

function safeEqualHex(a, b) {
  try {
    const aBuf = Buffer.from(String(a || ''), 'hex');
    const bBuf = Buffer.from(String(b || ''), 'hex');

    if (aBuf.length === 0 || bBuf.length === 0) return false;
    if (aBuf.length !== bBuf.length) return false;

    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function verifyMailgunSignature({ timestamp, token, signature }) {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
    console.error('MAILGUN_WEBHOOK_SIGNING_KEY is missing');
    return false;
  }

  if (!timestamp || !token || !signature) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_WEBHOOK_AGE_SECONDS) {
    console.error('Rejected webhook: timestamp too old or invalid');
    return false;
  }

  const expected = createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(`${timestamp}${token}`)
    .digest('hex');

  return safeEqualHex(expected, signature);
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const timestamp = formData.get('timestamp');
    const token = formData.get('token');
    const signature = formData.get('signature');

    const isValid = verifyMailgunSignature({
      timestamp,
      token,
      signature,
    });

    if (!isValid) {
      return Response.json({ error: 'Invalid Mailgun signature' }, { status: 401 });
    }

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

    for (const [, value] of formData.entries()) {
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