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

function detectPlan(customData, attributes) {
  const customPlan = String(customData?.plan || '').toLowerCase();
  if (customPlan === 'phantom' || customPlan === 'spectre' || customPlan === 'ghost') {
    return customPlan;
  }

  const text = [
    attributes?.product_name,
    attributes?.variant_name,
    attributes?.user_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('spectre')) return 'spectre';
  if (text.includes('phantom')) return 'phantom';
  return 'ghost';
}

export async function POST(request) {
  try {
    if (!WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'Missing LEMONSQUEEZY_WEBHOOK_SECRET' },
        { status: 500 }
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get('X-Signature') ?? '';

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const userId = customData?.user_id ? String(customData.user_id) : null;
    const plan = detectPlan(customData, attributes);

    if (!userId) {
      return NextResponse.json(
        { ok: true, skipped: 'Missing checkout[custom][user_id]' },
        { status: 200 }
      );
    }

    // Active / paid / resumed states -> set paid plan
    const activateEvents = new Set([
      'subscription_created',
      'subscription_updated',
      'subscription_resumed',
      'subscription_unpaused',
      'subscription_payment_success',
      'subscription_payment_recovered',
    ]);

    // Ended states -> downgrade to ghost
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
        console.error('Supabase update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }
    }

    // Do NOT downgrade on subscription_cancelled:
    // Lemon says cancelled enters a grace period until it later expires.
    if (downgradeEvents.has(eventName)) {
      const { error } = await supabase
        .from('profiles')
        .update({ plan: 'ghost' })
        .eq('id', userId);

      if (error) {
        console.error('Supabase downgrade error:', error);
        return NextResponse.json({ error: 'Failed to downgrade profile' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, event: eventName }, { status: 200 });
  } catch (error) {
    console.error('Lemon webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}