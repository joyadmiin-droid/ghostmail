import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTE_NAME = 'files_download';

const LIMITS = {
  perMinute: 60,
  perHour: 300,
};

function getFilenameFromPath(path) {
  const parts = String(path || '').split('/');
  return parts[parts.length - 1] || 'download';
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
    console.error('File rate limit count error:', minuteError || hourError);
    return {
      ok: false,
      status: 500,
      body: 'Rate limit check failed',
    };
  }

  if ((minuteCount || 0) >= LIMITS.perMinute) {
    return {
      ok: false,
      status: 429,
      body: 'Too many file requests. Please wait a minute.',
    };
  }

  if ((hourCount || 0) >= LIMITS.perHour) {
    return {
      ok: false,
      status: 429,
      body: 'Too many file requests. Please try again later.',
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
    console.error('File rate limit insert error:', insertError);
    return {
      ok: false,
      status: 500,
      body: 'Rate limit logging failed',
    };
  }

  return { ok: true };
}

export async function GET(request) {
  try {
    const pathname = request.nextUrl.pathname;
    const prefix = '/api/files/';

    if (!pathname.startsWith(prefix)) {
      return new NextResponse('Missing file path', { status: 400 });
    }

    const storagePath = decodeURIComponent(pathname.slice(prefix.length));

    if (!storagePath) {
      return new NextResponse('Missing file path', { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse('Authentication required', { status: 401 });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new NextResponse('Invalid authentication', { status: 401 });
    }

    const rateLimit = await enforceRateLimit(request, user.id);

    if (!rateLimit.ok) {
      return new NextResponse(rateLimit.body, { status: rateLimit.status });
    }

    const { data: attachment, error: attachmentError } = await supabase
      .from('attachments')
      .select(`
        id,
        storage_path,
        filename,
        email_id,
        emails!inner (
          id,
          mailbox_id,
          mailboxes!inner (
            id,
            user_id,
            is_active,
            expires_at
          )
        )
      `)
      .eq('storage_path', storagePath)
      .single();

    if (attachmentError || !attachment) {
      console.error('Attachment lookup error:', attachmentError);
      return new NextResponse('File not found', { status: 404 });
    }

    const mailbox = attachment.emails?.mailboxes;

    if (!mailbox) {
      return new NextResponse('File not found', { status: 404 });
    }

    if (mailbox.user_id !== user.id) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return new NextResponse('File no longer available', { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from('email-attachments-private')
      .download(storagePath);

    if (error || !data) {
      console.error('Storage download error:', error);
      return new NextResponse('File not found', { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const filename = attachment.filename || getFilenameFromPath(storagePath);

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('File proxy error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}