import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import sanitizeHtml from 'sanitize-html';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const MAX_WEBHOOK_AGE_SECONDS = 15 * 60;

// -------- SECURITY LIMITS --------

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_EMAIL_BODY_BYTES = 2_000_000;

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);

const PLAN_EMAIL_LIMITS = {
  free: 5,
  phantom: 200,
  spectre: 600,
};

// -------- HELPERS --------

function safeEqualHex(a, b) {
  try {
    const aBuf = Buffer.from(String(a || ''), 'hex');
    const bBuf = Buffer.from(String(b || ''), 'hex');
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function verifyMailgunSignature({ timestamp, token, signature }) {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_WEBHOOK_AGE_SECONDS) return false;

  const expected = createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(`${timestamp}${token}`)
    .digest('hex');

  return safeEqualHex(expected, signature);
}

// 🔐 STRONG REPLAY PROTECTION
async function guardReplay(token, timestamp) {
  const ts = Number(timestamp);

  if (!token || !Number.isFinite(ts)) {
    return { ok: false };
  }

  const { error } = await supabase
    .from('webhook_replay_guard')
    .insert({
      token,
      timestamp_sec: ts,
      provider: 'mailgun',
    });

  if (!error) return { ok: true };

  if (error.code === '23505') {
    return { ok: false, replay: true };
  }

  return { ok: false };
}

// 🔐 STRICT HTML SANITIZATION
function sanitizeEmailHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em',
      'ul', 'ol', 'li', 'a', 'img'
    ],
    allowedAttributes: {
      a: ['href'],
      img: ['src'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'nofollow noopener noreferrer',
        target: '_blank',
      }),
    },
  });
}

// -------- MAIN --------

export async function POST(request) {
  try {
    const formData = await request.formData();

    const timestamp = formData.get('timestamp');
    const token = formData.get('token');
    const signature = formData.get('signature');

    // 🔐 1. VERIFY SIGNATURE
    if (!verifyMailgunSignature({ timestamp, token, signature })) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 🔐 2. REPLAY PROTECTION
    const replay = await guardReplay(token, timestamp);
    if (!replay.ok) {
      if (replay.replay) {
        return Response.json({ error: 'Replay detected' }, { status: 409 });
      }
      return Response.json({ error: 'Replay guard failed' }, { status: 500 });
    }

    const recipient = String(formData.get('recipient') || '')
      .toLowerCase()
      .trim();

    const sender = String(formData.get('sender') || '');
    const from = String(formData.get('from') || '');
    const subject = String(formData.get('subject') || '(no subject)').slice(0, 300);

    const rawHtml = formData.get('body-html') || '';
    const rawText = formData.get('body-plain') || '';

    const combinedSize =
      Buffer.byteLength(String(rawHtml)) +
      Buffer.byteLength(String(rawText));

    if (combinedSize > MAX_EMAIL_BODY_BYTES) {
      return Response.json({ error: 'Body too large' }, { status: 413 });
    }

    const bodyHtml = sanitizeEmailHtml(rawHtml);
    const bodyText = String(rawText || '').trim();

    // 🔐 MAILBOX VALIDATION
    const { data: mailbox } = await supabase
      .from('mailboxes')
      .select('id, user_id, expires_at, is_active')
      .eq('address', recipient)
      .single();

    if (!mailbox) {
      return Response.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ success: true, ignored: true });
    }

    // 🔐 SAVE EMAIL
    const { data: email } = await supabase
      .from('emails')
      .insert({
        mailbox_id: mailbox.id,
        from_address: sender,
        from_name: from,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (!email) {
      return Response.json({ error: 'Insert failed' }, { status: 500 });
    }

    // 🔐 ATTACHMENTS (STRICT)
    const attachments = [];
    let count = 0;
    let total = 0;

    for (const [, file] of formData.entries()) {
      if (!(file instanceof File)) continue;
      if (count >= MAX_ATTACHMENTS) break;
      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) continue;
      if (total + file.size > MAX_TOTAL_ATTACHMENT_BYTES) continue;

      if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) continue;

      const safeName = file.name.replace(/[^\w.\-]/g, '_');
      const path = `${mailbox.id}/${email.id}/${randomUUID()}-${safeName}`;

      const buffer = Buffer.from(await file.arrayBuffer());

      const { error } = await supabase.storage
        .from('email-attachments-private')
        .upload(path, buffer, { contentType: file.type });

      if (!error) {
        attachments.push({
          email_id: email.id,
          filename: safeName,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: path,
        });

        count++;
        total += file.size;
      }
    }

    if (attachments.length) {
      await supabase.from('attachments').insert(attachments);
    }

    return Response.json({
      success: true,
      email_id: email.id,
      attachments_saved: attachments.length,
    });

  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}