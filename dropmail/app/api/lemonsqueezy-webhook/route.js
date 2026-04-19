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

// -------- YOUR ORIGINAL HELPERS (KEPT) --------

function normalizePlan(plan) {
  const value = String(plan || '').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  return 'ghost';
}

function extractUserId(payload) {
  return (
    payload?.meta?.custom_data?.user_id ||
    payload?.data?.attributes?.checkout_data?.custom?.user_id ||
    payload?.data?.attributes?.custom_data?.user_id ||
    null
  );
}

function extractCustomerId(payload) {
  return payload?.data?.attributes?.customer_id || null;
}

function extractSubscriptionId(payload) {
  return payload?.data?.id || null;
}

// -------- MAIN HANDLER --------

export async function POST(request) {
  try {
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing webhook secret' }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature =
      request.headers.get('x-signature') ||
      request.headers.get('X-Signature') ||
      '';

    // 🔐 1. Verify signature
    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);

    // 🔐 2. Replay protection
    const eventId = payload?.meta?.event_id || payload?.data?.id;

    if (eventId) {
      const { data: existing } = await supabase
        .from('processed_webhooks')
        .select('id')
        .eq('id', eventId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }

    const eventName = payload?.meta?.event_name || '';
    const lemonCustomerId = extractCustomerId(payload);
    const lemonSubscriptionId = extractSubscriptionId(payload);

    // 🔐 3. Secure user resolution
    let userId = extractUserId(payload);

    if (lemonCustomerId) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('lemon_customer_id', String(lemonCustomerId))
        .maybeSingle();

      if (existingUser?.id) {
        userId = existingUser.id;
      }
    }

    if (!userId) {
      return NextResponse.json({ ok: true, skipped: 'missing_user_id' });
    }

    const activateEvents = new Set([
      'subscription_created',
      'subscription_updated',
      'order_created',
    ]);

    const downgradeEvents = new Set([
      'subscription_expired',
      'subscription_payment_refunded',
    ]);

    // -------- ACTIVATE --------

    if (activateEvents.has(eventName)) {
      const updateData = {
        plan: 'phantom', // keep your logic here if dynamic
      };

      // 🔐 first-time secure linking
      if (lemonCustomerId) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('lemon_customer_id', String(lemonCustomerId))
          .maybeSingle();

        if (!existingUser) {
          updateData.lemon_customer_id = String(lemonCustomerId);
        }
      }

      if (lemonSubscriptionId) {
        updateData.lemon_subscription_id = String(lemonSubscriptionId);
      }

      await supabase.from('profiles').update(updateData).eq('id', userId);

      if (eventId) {
        await supabase.from('processed_webhooks').insert({ id: eventId });
      }

      return NextResponse.json({ ok: true, action: 'activated' });
    }

    // -------- DOWNGRADE --------

    if (downgradeEvents.has(eventName)) {
      await supabase
        .from('profiles')
        .update({ plan: 'ghost' })
        .eq('id', userId);

      if (eventId) {
        await supabase.from('processed_webhooks').insert({ id: eventId });
      }

      return NextResponse.json({ ok: true, action: 'downgraded' });
    }

    return NextResponse.json({ ok: true, ignored: eventName });

  } catch (err) {
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}