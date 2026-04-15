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

  if (signature.length === 0 || digest.length === 0) return false;
  if (signature.length !== digest.length) return false;

  return crypto.timingSafeEqual(digest, signature);
}

function normalizePlan(plan) {
  const value = String(plan || '').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  if (value === 'ghost' || value === 'free') return 'ghost';
  return 'ghost';
}

function detectPlan(customData, attributes) {
  const customPlan = normalizePlan(customData?.plan);
  if (customPlan !== 'ghost' || String(customData?.plan || '').toLowerCase() === 'ghost') {
    return customPlan;
  }

  const text = [
    attributes?.product_name,
    attributes?.variant_name,
    attributes?.first_order_item?.product_name,
    attributes?.first_order_item?.variant_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('spectre')) return 'spectre';
  if (text.includes('phantom')) return 'phantom';

  return 'ghost';
}

function extractUserId(payload) {
  const metaCustom = payload?.meta?.custom_data || {};
  const attrCheckoutData = payload?.data?.attributes?.checkout_data || {};
  const attrCustomData = payload?.data?.attributes?.custom_data || {};
  const orderItemCustom =
    payload?.data?.attributes?.first_order_item?.custom_data || {};

  return (
    metaCustom?.user_id ||
    attrCheckoutData?.custom?.user_id ||
    attrCheckoutData?.user_id ||
    attrCustomData?.user_id ||
    orderItemCustom?.user_id ||
    null
  );
}

function extractPlan(payload) {
  const metaCustom = payload?.meta?.custom_data || {};
  const attrCheckoutData = payload?.data?.attributes?.checkout_data || {};
  const attrCustomData = payload?.data?.attributes?.custom_data || {};
  const orderItemCustom =
    payload?.data?.attributes?.first_order_item?.custom_data || {};
  const attributes = payload?.data?.attributes || {};

  const mergedCustomData = {
    ...metaCustom,
    ...attrCustomData,
    ...orderItemCustom,
    ...(attrCheckoutData?.custom || {}),
  };

  return detectPlan(mergedCustomData, attributes);
}

export async function POST(request) {
  try {
    if (!WEBHOOK_SECRET) {
      console.error('❌ Missing LEMONSQUEEZY_WEBHOOK_SECRET');
      return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature =
      request.headers.get('x-signature') ||
      request.headers.get('X-Signature') ||
      '';

    console.log('📩 Lemon webhook raw body:', rawBody);

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      console.log('❌ Invalid Lemon signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    const eventName = payload?.meta?.event_name || '';
    const attributes = payload?.data?.attributes || {};
    const userId = extractUserId(payload);
    const plan = extractPlan(payload);

    console.log('📌 Lemon event:', eventName);
    console.log('📌 userId:', userId);
    console.log('📌 plan:', plan);
    console.log('📌 attributes id:', attributes?.id);
    console.log('📌 checkout_data:', attributes?.checkout_data || null);
    console.log('📌 custom_data:', attributes?.custom_data || null);
    console.log('📌 meta custom_data:', payload?.meta?.custom_data || null);

    if (!userId) {
      console.log('⚠️ Missing user_id in webhook payload');
      return NextResponse.json({ ok: true, skipped: 'missing_user_id' });
    }

    const activateEvents = new Set([
  'subscription_created',
  'subscription_updated',
]);

    const downgradeEvents = new Set([
      'subscription_expired',
      'subscription_payment_refunded',
    ]);

    if (activateEvents.has(eventName)) {
      const { error } = await supabase
        .from('profiles')
        .update({ plan })
        .eq('id', userId);

      if (error) {
        console.error('❌ Supabase activate error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }

      console.log(`✅ Updated user ${userId} to ${plan}`);
      return NextResponse.json({ ok: true, action: 'activated', plan });
    }

    if (downgradeEvents.has(eventName)) {
      const { error } = await supabase
        .from('profiles')
        .update({ plan: 'ghost' })
        .eq('id', userId);

      if (error) {
        console.error('❌ Supabase downgrade error:', error);
        return NextResponse.json({ error: 'Failed to downgrade profile' }, { status: 500 });
      }

      console.log(`✅ Downgraded user ${userId} to ghost`);
      return NextResponse.json({ ok: true, action: 'downgraded' });
    }

    console.log(`ℹ️ Ignored event: ${eventName}`);
    return NextResponse.json({ ok: true, ignored: eventName });
  } catch (err) {
    console.error('🔥 Lemon webhook crash:', err);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}