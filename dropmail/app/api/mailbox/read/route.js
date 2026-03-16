import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'Email ID is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('emails')
    .update({ is_read: true })
    .eq('id', id);

  if (error) {
    return Response.json({ error: 'Failed to mark as read' }, { status: 500 });
  }

  return Response.json({ success: true });
}
