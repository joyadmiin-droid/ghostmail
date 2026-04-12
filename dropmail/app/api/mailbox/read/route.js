import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTE_NAME = 'mailbox_read';

const LIMITS = {
  perMinute: 60,
  perHour: 300,
};

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
    console.error('Mailbox read rate limit error:', minuteError || hourError);
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
      body: { error: 'Too many requests. Please slow down.' },
    };
  }

  if ((hourCount || 0) >= LIMITS.perHour) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many requests. Please try again later.' },
    };
  }

  const { error: insertError } = await supabase
    .from('api_rate_limits')
    .insert([
      {
        route: ROUTE_NAME,
        ip_hash: ipHash,
        user_id: userId,
      },
    ]);

  if (insertError) {
    console.error('Mailbox read rate limit insert error:', insertError);
    return {
      ok: false,
      status: 500,
      body: { error: 'Rate limit logging failed' },
    };
  }

  return { ok: true };
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Email ID is required' }, { status: 400 });
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

    const { data: emailRecord, error: emailLookupError } = await supabase
      .from('emails')
      .select(`
        id,
        mailbox_id,
        mailboxes!inner (
          id,
          user_id,
          is_active,
          expires_at
        )
      `)
      .eq('id', id)
      .single();

    if (emailLookupError || !emailRecord) {
      console.error('Email lookup error:', emailLookupError);
      return Response.json({ error: 'Email not found' }, { status: 404 });
    }

    const mailbox = emailRecord.mailboxes;

    if (!mailbox) {
      return Response.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    if (mailbox.user_id !== user.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ error: 'Mailbox expired or inactive' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to mark email as read:', updateError);
      return Response.json({ error: 'Failed to mark as read' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Mailbox read route error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}