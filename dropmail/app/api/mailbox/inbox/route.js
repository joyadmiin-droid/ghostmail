import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTE_NAME = 'mailbox_inbox';

const LIMITS = {
  perMinute: 30,
  perHour: 200,
};

function normalizePlan(plan) {
  const value = String(plan || 'free').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  return 'free';
}

function formatAttachmentUrl(storagePath) {
  if (!storagePath) return null;
  return `/api/files/${storagePath}`;
}

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  return 'unknown';
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

async function enforceRateLimit(request, userId) {
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const now = Date.now();

  const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [{ count: minuteCount }, { count: hourCount }] = await Promise.all([
    supabase
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', oneMinuteAgo),

    supabase
      .from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo),
  ]);

  if ((minuteCount || 0) >= LIMITS.perMinute) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many requests (per minute)' },
    };
  }

  if ((hourCount || 0) >= LIMITS.perHour) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many requests (per hour)' },
    };
  }

  await supabase.from('api_rate_limits').insert([
    {
      route: ROUTE_NAME,
      ip_hash: ipHash,
      user_id: userId,
    },
  ]);

  return { ok: true };
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

    // 🔒 RATE LIMIT CHECK HERE
    const rateLimit = await enforceRateLimit(request, user.id);

    if (!rateLimit.ok) {
      return Response.json(rateLimit.body, { status: rateLimit.status });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    const plan = normalizePlan(profile?.plan);

    const { data: mailbox } = await supabase
      .from('mailboxes')
      .select('id, address, expires_at, is_active, user_id')
      .eq('token', token)
      .single();

    if (!mailbox) {
      return Response.json({ error: 'Inbox not found' }, { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ error: 'Inbox expired' }, { status: 404 });
    }

    if (mailbox.user_id && mailbox.user_id !== user.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: emails } = await supabase
      .from('emails')
      .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
      .eq('mailbox_id', mailbox.id)
      .order('received_at', { ascending: false });

    const emailIds = (emails || []).map(e => e.id);

    let attachmentsByEmailId = {};

    if (emailIds.length > 0) {
      const { data: attachments } = await supabase
        .from('attachments')
        .select('id, email_id, filename, mime_type, size_bytes, storage_path')
        .in('email_id', emailIds);

      attachmentsByEmailId = (attachments || []).reduce((acc, att) => {
        if (!acc[att.email_id]) acc[att.email_id] = [];

        acc[att.email_id].push({
          ...att,
          public_url: formatAttachmentUrl(att.storage_path),
        });

        return acc;
      }, {});
    }

    return Response.json({
      mailbox,
      emails: (emails || []).map(email => ({
        ...email,
        attachments: attachmentsByEmailId[email.id] || [],
      })),
      plan,
    });

  } catch (err) {
    console.error('Inbox route error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}