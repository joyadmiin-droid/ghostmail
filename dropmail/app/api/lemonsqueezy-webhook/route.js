import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret || !rawBody) return false;

  const signature = Buffer.from(signatureHeader, 'hex');
  const digest = Buffer.from(
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex'),
    'hex'
  );

  if (signature.length !== digest.length) return false;

  return crypto.timingSafeEqual(digest, signature);
}

function detectPlan(customData, attributes) {
  const customPlan = String(customData?.plan || '').toLowerCase();
  if (['ghost', 'phantom', 'spectre'].includes(customPlan)) return customPlan;

  const text = `${attributes?.product_name || ''} ${attributes?.variant_name || ''}`.toLowerCase();

  if (text.includes('spectre')) return 'spectre';
  if (text.includes('phantom')) return 'phantom';

  return 'ghost';
}

export async function POST(request) {
  try {
    const rawBody = await request.text();

    console.log('📩 RAW BODY:', rawBody);

    const signature = request.headers.get('x-signature') || '';

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      console.log('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    console.log('📦 PAYLOAD:', payload);

    const eventName = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    console.log('📌 Event:', eventName);
    console.log('📌 Custom data:', customData);

    const userId = customData?.user_id ? String(customData.user_id) : null;
    const plan = detectPlan(customData, attributes);

    console.log('👤 userId:', userId);
    console.log('📊 plan:', plan);

    if (!userId) {
      console.log('⚠️ Missing user_id');
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', userId);

    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log('✅ Plan updated successfully');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('🔥 Webhook crash:', err);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}