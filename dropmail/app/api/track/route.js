import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();

    const { event, path, label, user_email, metadata } = body;

    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      null;

    const countryName = country || null;
const region = req.headers.get('x-vercel-ip-country-region') || null;

    const finalMetadata = {
  ...(metadata || {}),
  country,
  countryName,
  region,
};

    const { error } = await supabase.from('analytics_events').insert([
      {
        event,
        path,
        label,
        user_email,
        metadata: finalMetadata,
      },
    ]);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}