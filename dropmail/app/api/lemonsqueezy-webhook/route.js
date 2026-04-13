import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

function verifySignature(rawBody, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = hmac.update(rawBody).digest('hex');
  return digest === signature;
}

export async function POST(req) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-signature');

  if (!verifySignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const data = JSON.parse(rawBody);

  const event = data.meta.event_name;
  const email = data.data.attributes.user_email;

  let plan = 'ghost';

  // 🔥 detect plan by product name
  const productName = data.data.attributes.product_name?.toLowerCase() || '';

  if (productName.includes('phantom')) plan = 'phantom';
  if (productName.includes('spectre')) plan = 'spectre';

  // 🔥 update user in Supabase
  if (event === 'subscription_created' || event === 'subscription_updated') {
    await supabase
      .from('profiles')
      .update({ plan })
      .eq('email', email);
  }

  // 🔥 downgrade if cancelled
  if (event === 'subscription_cancelled') {
    await supabase
      .from('profiles')
      .update({ plan: 'ghost' })
      .eq('email', email);
  }

  return new Response('OK', { status: 200 });
}