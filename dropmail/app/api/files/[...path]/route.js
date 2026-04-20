import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ROUTE_NAME = 'files_download';
const ATTACHMENT_BUCKET = 'email-attachments-private';
const MAX_PATH_LENGTH = 1024;

const LIMITS = {
  perMinute: 60,
  perHour: 300,
};

function getFilenameFromPath(path) {
  const parts = String(path || '').split('/');
  return parts[parts.length - 1] || 'download';
}

function sanitizeFilename(filename) {
  return String(filename || 'download')
    .replace(/[/\\"]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .slice(0, 255);
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

function isValidStoragePath(storagePath) {
  if (!storagePath) return false;
  if (storagePath.length > MAX_PATH_LENGTH) return false;
  if (storagePath.includes('\0')) return false;
  if (storagePath.startsWith('/')) return false;
  if (storagePath.includes('..')) return false;
  return true;
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
    console.error('File rate limit count error:', minuteResult.error || hourResult.error);
    return {
      ok: false,
      status: 500,
      body: 'Rate limit check failed',
    };
  }

  const minuteCount = minuteResult.count || 0;
  const hourCount = hourResult.count || 0;

  if (minuteCount >= LIMITS.perMinute) {
    return {
      ok: false,
      status: 429,
      body: 'Too many file requests. Please wait a minute.',
    };
  }

  if (hourCount >= LIMITS.perHour) {
    return {
      ok: false,
      status: 429,
      body: 'Too many file requests. Please try again later.',
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

    const storagePath = decodeURIComponent(pathname.slice(prefix.length)).trim();

    if (!isValidStoragePath(storagePath)) {
      return new NextResponse('Invalid file path', { status: 400 });
    }

    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return new NextResponse('Authentication required', { status: 401 });
    }

    const supabaseUser = getUserClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      console.error('File auth error:', userError);
      return new NextResponse('Invalid authentication', { status: 401 });
    }

    const rateLimit = await enforceRateLimit(request, user.id);

    if (!rateLimit.ok) {
      return new NextResponse(rateLimit.body, { status: rateLimit.status });
    }

    const { data: attachment, error: attachmentError } = await supabaseAdmin
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
      .eq('emails.mailboxes.user_id', user.id)
      .maybeSingle();

    if (attachmentError || !attachment) {
      console.error('Attachment lookup error:', attachmentError);
      return new NextResponse('File not found', { status: 404 });
    }

    const mailbox = attachment.emails?.mailboxes;

    if (!mailbox) {
      return new NextResponse('File not found', { status: 404 });
    }

    if (!mailbox.is_active || new Date(mailbox.expires_at) <= new Date()) {
      return new NextResponse('File no longer available', { status: 403 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .download(storagePath);

    if (error || !data) {
      console.error('Storage download error:', error);
      return new NextResponse('File not found', { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const filename = sanitizeFilename(
      attachment.filename || getFilenameFromPath(storagePath)
    );

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (err) {
    console.error('File proxy error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function POST() {
  return new NextResponse('Method not allowed', { status: 405 });
}