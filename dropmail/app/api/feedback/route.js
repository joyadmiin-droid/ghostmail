import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_MESSAGE_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 320;
const MAX_PAGE_LENGTH = 500;
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;

const ALLOWED_SCREENSHOT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function getBearerToken(req) {
  const authHeader =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
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

function normalizeString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\u0000/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function normalizeEmail(value) {
  const cleaned = normalizeString(value, MAX_EMAIL_LENGTH);
  return cleaned ? cleaned.toLowerCase() : null;
}

function safeScreenshotExtension(mimeType) {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();

    const message = normalizeString(formData.get('message'), MAX_MESSAGE_LENGTH);
    const email = normalizeEmail(formData.get('email'));
    const page = normalizeString(formData.get('page'), MAX_PAGE_LENGTH);
    const screenshot = formData.get('screenshot');

    if (!message) {
      return Response.json({ error: 'Message is required.' }, { status: 400 });
    }

    let userId = null;
    const accessToken = getBearerToken(req);

    if (accessToken) {
      const supabaseUser = getUserClient(accessToken);
      const {
        data: { user },
        error: userError,
      } = await supabaseUser.auth.getUser();

      if (!userError && user) {
        userId = user.id;
      }
    }

    let screenshotPath = null;

    if (screenshot && typeof screenshot !== 'string' && screenshot.size > 0) {
      if (screenshot.size > MAX_SCREENSHOT_SIZE) {
        return Response.json(
          { error: 'Screenshot must be under 5MB.' },
          { status: 400 }
        );
      }

      const mimeType = screenshot.type || '';
      if (!ALLOWED_SCREENSHOT_TYPES.has(mimeType)) {
        return Response.json(
          { error: 'Only PNG, JPG, and WEBP screenshots are allowed.' },
          { status: 400 }
        );
      }

      const ext = safeScreenshotExtension(mimeType);
      if (!ext) {
        return Response.json(
          { error: 'Invalid screenshot type.' },
          { status: 400 }
        );
      }

      const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const filePath = `feedback/${fileName}`;

      const arrayBuffer = await screenshot.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from('feedback-images')
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Feedback screenshot upload error:', uploadError);
        return Response.json(
          { error: 'Failed to upload screenshot.' },
          { status: 500 }
        );
      }

      screenshotPath = filePath;
    }

    const { error: insertError } = await supabaseAdmin
      .from('feedback_entries')
      .insert({
        email,
        message,
        screenshot_path: screenshotPath,
        page,
        user_id: userId,
      });

    if (insertError) {
      console.error('Feedback insert error:', insertError);
      return Response.json(
        { error: 'Failed to submit feedback.' },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Feedback route error:', err);
    return Response.json(
      { error: 'Unexpected server error.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}