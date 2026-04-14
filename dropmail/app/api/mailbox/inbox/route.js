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

const PLAN_RULES = {
  ghost: {
    maxInboxes: 1,
    maxEmails: 5,
  },
  phantom: {
    maxInboxes: 5,
    maxEmails: 200,
  },
  spectre: {
    maxInboxes: 50,
    maxEmails: 600,
  },
};

function normalizePlan(plan) {
  const value = String(plan || 'ghost').toLowerCase();

  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  if (value === 'free') return 'ghost';
  if (value === 'ghost') return 'ghost';

  return 'ghost';
}

function getPlanRules(plan) {
  return PLAN_RULES[normalizePlan(plan)] || PLAN_RULES.ghost;
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

  const [{ count: minuteCount, error: minuteError }, { count: hourCount, error: hourError }] =
    await Promise.all([
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

  if (minuteError || hourError) {
    console.error('Inbox rate limit lookup error:', minuteError || hourError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Rate limit check failed' },
    };
  }

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

  const { error: insertError } = await supabase.from('api_rate_limits').insert([
    {
      route: ROUTE_NAME,
      ip_hash: ipHash,
      user_id: userId,
    },
  ]);

  if (insertError) {
    console.error('Inbox rate limit insert error:', insertError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Rate limit logging failed' },
    };
  }

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

    const rateLimit = await enforceRateLimit(request, user.id);

    if (!rateLimit.ok) {
      return Response.json(rateLimit.body, { status: rateLimit.status });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      return Response.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    const plan = normalizePlan(profile?.plan);
    const planRules = getPlanRules(plan);

    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('id, address, expires_at, is_active, user_id')
      .eq('token', token)
      .single();

    if (mailboxError) {
      console.error('Mailbox lookup error:', mailboxError);
    }

    if (!mailbox) {
      return Response.json({ error: 'Inbox not found' }, { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ error: 'Inbox expired' }, { status: 404 });
    }

    if (mailbox.user_id && mailbox.user_id !== user.id) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('id, from_address, from_name, subject, body_html, body_text, received_at, is_read')
      .eq('mailbox_id', mailbox.id)
      .order('received_at', { ascending: false });

    if (emailsError) {
      console.error('Emails lookup error:', emailsError);
      return Response.json({ error: 'Failed to load emails' }, { status: 500 });
    }

    const emailIds = (emails || []).map((e) => e.id);

    let attachmentsByEmailId = {};

    if (emailIds.length > 0) {
      const { data: attachments, error: attachmentsError } = await supabase
        .from('attachments')
        .select('id, email_id, filename, mime_type, size_bytes, storage_path')
        .in('email_id', emailIds);

      if (attachmentsError) {
        console.error('Attachments lookup error:', attachmentsError);
        return Response.json({ error: 'Failed to load attachments' }, { status: 500 });
      }

      attachmentsByEmailId = (attachments || []).reduce((acc, att) => {
        if (!acc[att.email_id]) acc[att.email_id] = [];

        acc[att.email_id].push({
          ...att,
          public_url: formatAttachmentUrl(att.storage_path),
        });

        return acc;
      }, {});
    }

    const enrichedEmails = (emails || []).map((email) => ({
      ...email,
      attachments: attachmentsByEmailId[email.id] || [],
    }));

    return Response.json({
      mailbox,
      emails: enrichedEmails,
      plan,
      limits: {
        max_inboxes: planRules.maxInboxes,
        max_emails: planRules.maxEmails,
      },
      usage: {
        mailbox_email_count: enrichedEmails.length,
      },
    });
  } catch (err) {
    console.error('Inbox route error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}