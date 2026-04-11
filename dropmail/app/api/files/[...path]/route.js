import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getFilenameFromPath(path) {
  const parts = String(path || '').split('/');
  return parts[parts.length - 1] || 'download';
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

    const { data, error } = await supabase.storage
      .from('attachments')
      .download(storagePath);

    if (error || !data) {
      console.error('Storage download error:', error);
      return new NextResponse('File not found', { status: 404 });
    }

    const arrayBuffer = await data.arrayBuffer();
    const filename = getFilenameFromPath(storagePath);

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (err) {
    console.error('File proxy error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}