import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import sanitizeHtml from 'sanitize-html';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const MAX_WEBHOOK_AGE_SECONDS = 15 * 60; // 15 minutes

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB each
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB total
const MAX_EMAIL_BODY_BYTES = 2_000_000; // ~2 MB combined HTML + text

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain'
]);

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

async function reserveWebhookToken({ token, timestamp }) {
  const ts = Number(timestamp);

  if (!token || !Number.isFinite(ts)) {
    return { ok: false, reason: 'invalid_token_or_timestamp' };
  }

  const { error } = await supabase
    .from('webhook_replay_guard')
    .insert({
      token,
      timestamp_sec: ts,
      provider: 'mailgun',
    });

  if (!error) {
    return { ok: true };
  }

  if (error.code === '23505') {
    return { ok: false, reason: 'replayed_token' };
  }

  console.error('Replay guard insert error:', error);
  return { ok: false, reason: 'db_error' };
}

function sanitizeEmailHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [
      'html', 'body', 'div', 'span', 'p', 'br', 'hr',
      'b', 'strong', 'i', 'em', 'u', 's',
      'blockquote', 'pre', 'code',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'a', 'img',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['style']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'nofollow noopener noreferrer',
        target: '_blank'
      })
    },
    exclusiveFilter(frame) {
      const tag = frame.tag;
      const attrs = frame.attribs || {};

      if (tag === 'img') {
        const src = String(attrs.src || '').trim().toLowerCase();
        if (!src) return true;
        if (
          src.startsWith('javascript:') ||
          src.startsWith('file:') ||
          src.startsWith('vbscript:')
        ) {
          return true;
        }
      }

      if (tag === 'a') {
        const href = String(attrs.href || '').trim().toLowerCase();
        if (
          href.startsWith('javascript:') ||
          href.startsWith('file:') ||
          href.startsWith('vbscript:')
        ) {
          return true;
        }
      }

      return false;
    }
  });
}

function normalizePlainText(text) {
  return String(text || '').replace(/\u0000/g, '').trim();
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

    const replayCheck = await reserveWebhookToken({ token, timestamp });

    if (!replayCheck.ok) {
      if (replayCheck.reason === 'replayed_token') {
        return Response.json({ error: 'Replay detected' }, { status: 409 });
      }

      return Response.json({ error: 'Webhook replay guard failed' }, { status: 500 });
    }

    const recipient = formData.get('recipient');
    const sender = formData.get('sender');
    const from = formData.get('from');
    const subject = String(formData.get('subject') || '(no subject)').slice(0, 500);
    const rawBodyHtml = formData.get('body-html') || '';
    const rawBodyText = formData.get('body-plain') || '';

    const combinedBodySize =
      Buffer.byteLength(String(rawBodyHtml), 'utf8') +
      Buffer.byteLength(String(rawBodyText), 'utf8');

    if (combinedBodySize > MAX_EMAIL_BODY_BYTES) {
      return Response.json({ error: 'Email body too large' }, { status: 413 });
    }

    const bodyHtml = sanitizeEmailHtml(rawBodyHtml);
    const bodyText = normalizePlainText(rawBodyText);

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

    let acceptedAttachments = 0;
    let totalAttachmentBytes = 0;

    for (const [, value] of formData.entries()) {
      if (!(value instanceof File)) continue;
      if (!value.name || value.size === 0) continue;

      if (acceptedAttachments >= MAX_ATTACHMENTS) continue;
      if (value.size > MAX_ATTACHMENT_SIZE_BYTES) continue;
      if (totalAttachmentBytes + value.size > MAX_TOTAL_ATTACHMENT_BYTES) continue;

      const mimeType = value.type || 'application/octet-stream';

      if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType)) {
        console.warn(`Skipping attachment "${value.name}": disallowed MIME type ${mimeType}`);
        continue;
      }

      const safeName = value.name.replace(/[^\w.\-]/g, '_');
      const storagePath = `${mailbox.id}/${emailId}/${randomUUID()}-${safeName}`;

      const arrayBuffer = await value.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const { error: uploadErr } = await supabase.storage
        .from('email-attachments-private')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadErr) {
        console.error('Attachment upload error:', uploadErr);
        continue;
      }

      attachmentRows.push({
        email_id: emailId,
        filename: value.name,
        mime_type: mimeType,
        size_bytes: value.size || 0,
        storage_path: storagePath,
      });

      acceptedAttachments += 1;
      totalAttachmentBytes += value.size;
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