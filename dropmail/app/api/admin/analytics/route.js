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

  const [{ data: events, error: eventsError }, { data: profiles }, { data: payments }] =
    await Promise.all([
      supabaseAdmin
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),

      supabaseAdmin
        .from('profiles')
        .select('*'),

      supabaseAdmin
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

  if (eventsError) {
    return Response.json({ error: eventsError.message }, { status: 500 });
  }

  return Response.json({
    events: events || [],
    profiles: profiles || [],
    payments: payments || [],
  });
}