import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('feedback_entries')
      .select('*')
      .order('is_important', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const enriched = await Promise.all(
      (data || []).map(async (item) => {
        let screenshotUrl = null;

        if (item.screenshot_path) {
          const { data: signedData } = await supabase.storage
            .from('feedback-images')
            .createSignedUrl(item.screenshot_path, 60 * 60);

          screenshotUrl = signedData?.signedUrl || null;
        }

        return {
          ...item,
          screenshot_url: screenshotUrl,
        };
      })
    );

    return Response.json({ entries: enriched });
  } catch (err) {
    return Response.json(
      { error: err?.message || 'Could not load feedback.' },
      { status: 500 }
    );
  }
}