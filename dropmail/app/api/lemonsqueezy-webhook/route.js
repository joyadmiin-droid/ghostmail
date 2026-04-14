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
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing secret' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get('x-signature') || '';

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const userId = customData?.user_id;
    const plan = detectPlan(customData, attributes);

    if (!userId) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const subscriptionId = attributes?.subscription_id || attributes?.id;

    // 🔒 CHECK IF ALREADY PROCESSED
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('subscription_id', subscriptionId)
      .single();

    if (existing) {
      console.log('⚠️ Already processed:', subscriptionId);
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    // ✅ SAVE PAYMENT FIRST
    await supabase.from('payments').insert({
      user_id: userId,
      subscription_id: subscriptionId,
      plan,
      event: eventName,
    });

    const activateEvents = new Set([
      'subscription_created',
      'subscription_payment_success',
      'subscription_resumed',
      'subscription_unpaused',
    ]);

    const downgradeEvents = new Set([
      'subscription_expired',
      'subscription_payment_refunded',
    ]);

    if (activateEvents.has(eventName)) {
      await supabase
        .from('profiles')
        .update({ plan })
        .eq('id', userId);
    }

    if (downgradeEvents.has(eventName)) {
      await supabase
        .from('profiles')
        .update({ plan: 'ghost' })
        .eq('id', userId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'fail' }, { status: 500 });
  }
}