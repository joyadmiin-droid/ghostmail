import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, action, value } = body || {};

    if (!id || !action) {
      return Response.json({ error: 'Missing id or action.' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (action === 'delete') {
      const { data: existing, error: fetchError } = await supabase
        .from('feedback_entries')
        .select('screenshot_path')
        .eq('id', id)
        .single();

      if (fetchError) {
        return Response.json({ error: fetchError.message }, { status: 500 });
      }

      if (existing?.screenshot_path) {
        await supabase.storage
          .from('feedback-images')
          .remove([existing.screenshot_path]);
      }

      const { error } = await supabase
        .from('feedback_entries')
        .delete()
        .eq('id', id);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    if (action === 'toggle-important') {
      const { error } = await supabase
        .from('feedback_entries')
        .update({ is_important: !!value })
        .eq('id', id);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    if (action === 'set-status') {
      const allowed = ['open', 'fixed', 'ignored'];
      if (!allowed.includes(value)) {
        return Response.json({ error: 'Invalid status.' }, { status: 400 });
      }

      const { error } = await supabase
        .from('feedback_entries')
        .update({ status: value })
        .eq('id', id);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    if (action === 'set-note') {
      const { error } = await supabase
        .from('feedback_entries')
        .update({ admin_note: value || '' })
        .eq('id', id);

      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return Response.json(
      { error: err?.message || 'Unexpected server error.' },
      { status: 500 }
    );
  }
}