import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { rateLimit } from '@/app/lib/rate-limit';

const limiter = rateLimit({ limit: 60, windowMs: 60 * 1000 });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTE_NAME = 'mailbox_inbox';

const LIMITS = {
  perMinute: 30,
  perHour: 200,
};

const PLAN_RULES = {
  ghost: { maxInboxes: 1, maxEmails: 5 },
  phantom: { maxInboxes: 5, maxEmails: 200 },
  spectre: { maxInboxes: 50, maxEmails: 600 },
};

function normalizePlan(plan) {
  const p = String(plan || 'ghost').toLowerCase();
  if (p === 'spectre') return 'spectre';
  if (p === 'phantom') return 'phantom';
  return 'ghost';
}

function getPlanRules(plan) {
  return PLAN_RULES[normalizePlan(plan)];
}

function formatAttachmentUrl(storagePath) {
  return storagePath ? `/api/files/${storagePath}` : null;
}

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip)).digest('hex');
}

// 🔥 IMPROVED RATE LIMIT
async function enforceRateLimit(request, userId) {
  const ipHash = hashIp(getClientIp(request));
  const now = Date.now();

  const minuteAgo = new Date(now - 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [{ count: minute }, { count: hour }] = await Promise.all([
    supabase.from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', minuteAgo),

    supabase.from('api_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', hourAgo),
  ]);

  if ((minute || 0) >= LIMITS.perMinute) {
    return { ok: false, status: 429, body: { error: 'Too many requests (1m)' } };
  }

  if ((hour || 0) >= LIMITS.perHour) {
    return { ok: false, status: 429, body: { error: 'Too many requests (1h)' } };
  }

  await supabase.from('api_rate_limits').insert({
    route: ROUTE_NAME,
    ip_hash: ipHash,
    user_id: userId,
  });

  return { ok: true };
}

export async function GET(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
const { success } = limiter(ip);

if (!success) {
  return Response.json({ error: 'Too many requests' }, { status: 429 });
}
    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Auth required' }, { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();

    const {
      data: { user },
    } = await supabase.auth.getUser(accessToken);

    if (!user) {
      return Response.json({ error: 'Invalid auth' }, { status: 401 });
    }

    // 🔒 RATE LIMIT
    const rate = await enforceRateLimit(request, user.id);
    if (!rate.ok) return Response.json(rate.body, { status: rate.status });

    // 🔥 ALWAYS GET FRESH PLAN
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    const plan = normalizePlan(profile?.plan);
    const rules = getPlanRules(plan);

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

    if (mailbox.user_id !== user.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: emails } = await supabase
      .from('emails')
      .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
      .eq('mailbox_id', mailbox.id)
      .order('received_at', { ascending: false });

    const emailIds = (emails || []).map((e) => e.id);

    let attachmentsMap = {};

    if (emailIds.length) {
      const { data: attachments } = await supabase
        .from('attachments')
        .select('id, email_id, filename, mime_type, size_bytes, storage_path')
        .in('email_id', emailIds);

      attachmentsMap = (attachments || []).reduce((acc, a) => {
        if (!acc[a.email_id]) acc[a.email_id] = [];
        acc[a.email_id].push({
          ...a,
          public_url: formatAttachmentUrl(a.storage_path),
        });
        return acc;
      }, {});
    }

    const enriched = (emails || []).map((e) => ({
      ...e,
      attachments: attachmentsMap[e.id] || [],
    }));

    // 🔥 LOG FOR DEBUG / SCALE
    console.log(
      `📥 Inbox fetch: user=${user.id} plan=${plan} emails=${enriched.length}`
    );

    return Response.json({
      mailbox,
      emails: enriched,
      plan,
      limits: {
        max_inboxes: rules.maxInboxes,
        max_emails: rules.maxEmails,
      },
      usage: {
        mailbox_email_count: enriched.length,
      },
    });

  } catch (err) {
    console.error('INBOX ERROR:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}