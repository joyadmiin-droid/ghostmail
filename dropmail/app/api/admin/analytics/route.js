import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'erkan.iseni20@gmail.com';

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const {
    data: { user },
  } = await supabaseUser.auth.getUser(token);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabaseAdmin
    .from('analytics_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ events: data || [] });
}