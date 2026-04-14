import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

// 🔐 Verify signature
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret || !rawBody) return false;

  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'hex'),
      Buffer.from(signatureHeader, 'hex')
    );
  } catch {
    return false;
  }
}

// 🧠 Detect plan
function detectPlan(customData, attributes) {
  const customPlan = String(customData?.plan || '').toLowerCase();

  if (['ghost', 'phantom', 'spectre'].includes(customPlan)) {
    return customPlan;
  }

  const text = [
    attributes?.product_name,
    attributes?.variant_name,
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
    const signature = request.headers.get('x-signature') || '';

    // 🔐 verify
    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    const eventName = payload?.meta?.event_name;
    const customData = payload?.meta?.custom_data || {};
    const attributes = payload?.data?.attributes || {};

    const userId = customData?.user_id || null;
    const email = attributes?.user_email || null;

    const plan = detectPlan(customData, attributes);

    console.log('📩 Lemon event:', eventName, '| Plan:', plan);

    // 🔥 EVENTS THAT ACTIVATE PLAN
    const activateEvents = new Set([
      'order_created',
      'subscription_created',
      'subscription_updated',
      'subscription_resumed',
      'subscription_unpaused',
      'subscription_payment_success',
      'subscription_payment_recovered',
    ]);

    // 🔥 EVENTS THAT DOWNGRADE
    const downgradeEvents = new Set([
      'subscription_expired',
      'subscription_payment_refunded',
    ]);

    // =========================
    // 🔥 UPDATE USER PLAN
    // =========================
    if (activateEvents.has(eventName)) {
      let query = supabase.from('profiles').update({ plan });

      if (userId) {
        query = query.eq('id', userId);
      } else if (email) {
        query = query.eq('email', email);
      } else {
        console.warn('⚠️ No user_id or email in webhook');
        return NextResponse.json({ ok: true, skipped: true });
      }

      const { error } = await query;

      if (error) {
        console.error('❌ Plan update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }

      console.log(`✅ User upgraded to ${plan}`);
    }

    // =========================
    // 🔻 DOWNGRADE
    // =========================
    if (downgradeEvents.has(eventName)) {
      let query = supabase.from('profiles').update({ plan: 'ghost' });

      if (userId) {
        query = query.eq('id', userId);
      } else if (email) {
        query = query.eq('email', email);
      } else {
        return NextResponse.json({ ok: true, skipped: true });
      }

      const { error } = await query;

      if (error) {
        console.error('❌ Downgrade error:', error);
        return NextResponse.json({ error: 'Failed to downgrade profile' }, { status: 500 });
      }

      console.log(`🔻 User downgraded to ghost`);
    }

    return NextResponse.json({ ok: true, event: eventName }, { status: 200 });

  } catch (error) {
    console.error('🔥 Lemon webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}