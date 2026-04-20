import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
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
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const now = Date.now();

  const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [minuteResult, hourResult] = await Promise.all([
    supabaseAdmin
      .from('api_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', oneMinuteAgo),

    supabaseAdmin
      .from('api_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('route', ROUTE_NAME)
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo),
  ]);

  if (minuteResult.error || hourResult.error) {
    console.error('Mailbox read rate limit error:', minuteResult.error || hourResult.error);
    return {
      ok: false,
      status: 500,
      body: { error: 'Rate limit check failed' },
    };
  }

  const minuteCount = minuteResult.count || 0;
  const hourCount = hourResult.count || 0;

  if (minuteCount >= LIMITS.perMinute) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many requests. Please slow down.' },
    };
  }

  if (hourCount >= LIMITS.perHour) {
    return {
      ok: false,
      status: 429,
      body: { error: 'Too many requests. Please try again later.' },
    };
  }

  const { error: insertError } = await supabaseAdmin
    .from('api_rate_limits')
    .insert({
      route: ROUTE_NAME,
      ip_hash: ipHash,
      user_id: userId,
    });

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

    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabaseUser = getUserClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const rateLimit = await enforceRateLimit(request, user.id);

    if (!rateLimit.ok) {
      return Response.json(rateLimit.body, { status: rateLimit.status });
    }

    const { data: emailRecord, error: emailLookupError } = await supabaseAdmin
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
      .eq('mailboxes.user_id', user.id)
      .single();

    if (emailLookupError || !emailRecord) {
      console.error('Email lookup error:', emailLookupError);
      return Response.json({ error: 'Email not found' }, { status: 404 });
    }

    const mailbox = emailRecord.mailboxes;

    if (!mailbox) {
      return Response.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return Response.json({ error: 'Mailbox expired or inactive' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('emails')
      .update({ is_read: true })
      .eq('id', id)
      .eq('mailbox_id', emailRecord.mailbox_id);

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

export async function GET() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}