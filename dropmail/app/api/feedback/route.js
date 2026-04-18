import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const formData = await req.formData();

    const message = formData.get('message');
    const email = formData.get('email');
    const page = formData.get('page');
    const userId = formData.get('userId');
    const screenshot = formData.get('screenshot');

    if (!message || typeof message !== 'string' || !message.trim()) {
      return Response.json({ error: 'Message is required.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let screenshotPath = null;

    if (screenshot && typeof screenshot !== 'string' && screenshot.size > 0) {
      const maxSize = 5 * 1024 * 1024;
      if (screenshot.size > maxSize) {
        return Response.json({ error: 'Screenshot must be under 5MB.' }, { status: 400 });
      }

      const ext = screenshot.name?.split('.').pop()?.toLowerCase() || 'png';
      const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
      const filePath = `feedback/${fileName}`;

      const arrayBuffer = await screenshot.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('feedback-images')
        .upload(filePath, buffer, {
          contentType: screenshot.type || 'image/png',
          upsert: false,
        });

      if (uploadError) {
        return Response.json({ error: uploadError.message }, { status: 500 });
      }

      screenshotPath = filePath;
    }

    const { error: insertError } = await supabase
      .from('feedback_entries')
      .insert({
        email: typeof email === 'string' && email.trim() ? email.trim() : null,
        message: message.trim(),
        screenshot_path: screenshotPath,
        page: typeof page === 'string' ? page : null,
        user_id: typeof userId === 'string' && userId ? userId : null,
      });

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err?.message || 'Unexpected server error.' },
      { status: 500 }
    );
  }
}