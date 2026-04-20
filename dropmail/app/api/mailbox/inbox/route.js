import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { rateLimit } from '@/app/lib/rate-limit';

const limiter = rateLimit({ limit: 60, windowMs: 60 * 1000 });

const supabaseAdmin = createClient(
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

function getBearerToken(request) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function getUserClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function enforceRateLimit(request, userId) {
  const ipHash = hashIp(getClientIp(request));
  const now = Date.now();

  const minuteAgo = new Date(now - 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [minuteResult, hourResult] = await Promise.all([
    supabaseAdmin
      .from('api_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', minuteAgo),

    supabaseAdmin
      .from('api_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', hourAgo),
  ]);

  if (minuteResult.error || hourResult.error) {
    console.error('Inbox rate limit lookup error:', minuteResult.error || hourResult.error);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to verify rate limit' },
    };
  }

  const minute = minuteResult.count || 0;
  const hour = hourResult.count || 0;

  if (minute >= LIMITS.perMinute) {
    return { ok: false, status: 429, body: { error: 'Too many requests (1m)' } };
  }

  if (hour >= LIMITS.perHour) {
    return { ok: false, status: 429, body: { error: 'Too many requests (1h)' } };
  }

  const { error: insertError } = await supabaseAdmin.from('api_rate_limits').insert({
    route: ROUTE_NAME,
    ip_hash: ipHash,
    user_id: userId,
  });

  if (insertError) {
    console.error('Inbox rate limit insert error:', insertError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to record rate limit' },
    };
  }

  return { ok: true };
}

export async function GET(request) {
  try {
    const ip = getClientIp(request);
    const { success } = limiter(ip);

    if (!success) {
      return Response.json({ error: 'Too many requests' }, { status: 429 });
    }

    const mailboxToken = new URL(request.url).searchParams.get('token');

    if (!mailboxToken) {
      return Response.json({ error: 'Token required' }, { status: 400 });
    }

    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return Response.json({ error: 'Auth required' }, { status: 401 });
    }

    const supabaseUser = getUserClient(accessToken);

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: 'Invalid auth' }, { status: 401 });
    }

    const rate = await enforceRateLimit(request, user.id);
    if (!rate.ok) return Response.json(rate.body, { status: rate.status });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Inbox profile load error:', profileError);
      return Response.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    const plan = normalizePlan(profile?.plan);
    const rules = getPlanRules(plan);

    const { data: mailbox, error: mailboxError } = await supabaseAdmin
      .from('mailboxes')
      .select('id, address, expires_at, is_active, user_id, created_at')
      .eq('token', mailboxToken)
      .eq('user_id', user.id)
      .single();

    if (mailboxError || !mailbox) {
      return Response.json({ error: 'Inbox not found' }, { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ error: 'Inbox expired' }, { status: 404 });
    }

    const { data: emails, error: emailsError } = await supabaseAdmin
      .from('emails')
      .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
      .eq('mailbox_id', mailbox.id)
      .order('received_at', { ascending: false })
      .limit(rules.maxEmails);

    if (emailsError) {
      console.error('Inbox emails load error:', emailsError);
      return Response.json({ error: 'Failed to load emails' }, { status: 500 });
    }

    const emailIds = (emails || []).map((e) => e.id);

    let attachmentsMap = {};

    if (emailIds.length > 0) {
      const { data: attachments, error: attachmentsError } = await supabaseAdmin
        .from('attachments')
        .select('id, email_id, filename, mime_type, size_bytes, storage_path')
        .in('email_id', emailIds);

      if (attachmentsError) {
        console.error('Inbox attachments load error:', attachmentsError);
        return Response.json({ error: 'Failed to load attachments' }, { status: 500 });
      }

      attachmentsMap = (attachments || []).reduce((acc, a) => {
        if (!acc[a.email_id]) acc[a.email_id] = [];
        acc[a.email_id].push({
          id: a.id,
          email_id: a.email_id,
          filename: a.filename,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          public_url: formatAttachmentUrl(a.storage_path),
        });
        return acc;
      }, {});
    }

    const enriched = (emails || []).map((e) => ({
      ...e,
      attachments: attachmentsMap[e.id] || [],
    }));

    return Response.json({
      mailbox: {
        id: mailbox.id,
        address: mailbox.address,
        expires_at: mailbox.expires_at,
        is_active: mailbox.is_active,
        created_at: mailbox.created_at,
      },
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

export async function POST() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}