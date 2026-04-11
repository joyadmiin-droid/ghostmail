import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const path = params.path.join('/');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

    const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/attachments/${path}`;

    const response = await fetch(fileUrl);

    if (!response.ok) {
      return new NextResponse('File not found', { status: 404 });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (err) {
    console.error('File proxy error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}