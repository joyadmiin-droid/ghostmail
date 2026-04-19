import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePlan(plan) {
  const value = String(plan || 'ghost').toLowerCase();
  if (value === 'spectre') return 'spectre';
  if (value === 'phantom') return 'phantom';
  return 'ghost';
}

function getBearerToken(request) {
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    '';

  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

function getUserClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function POST(request) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optional light body validation: reject huge bodies / invalid JSON
    const contentType = request.headers.get('content-type') || '';
    if (contentType && !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }

    // We do not need any request body for this route.
    // If caller sends one, ignore it safely without parsing.

    const supabaseUser = getUserClient(accessToken);

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid auth' }, { status: 401 });
    }

    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('plan, event, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (paymentsError) {
      console.error('Payments lookup error:', paymentsError);
      return NextResponse.json({ error: 'Failed to load payments' }, { status: 500 });
    }

    if (!payments || payments.length === 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ plan: 'ghost' })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile sync error:', updateError);
        return NextResponse.json({ error: 'Failed to sync plan' }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        synced: false,
        plan: 'ghost',
        reason: 'no_payments_found',
      });
    }

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

    let nextPlan = 'ghost';

    for (const payment of payments) {
      if (downgradeEvents.has(payment.event)) {
        nextPlan = 'ghost';
        break;
      }

      if (activateEvents.has(payment.event)) {
        nextPlan = normalizePlan(payment.plan);
        break;
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ plan: nextPlan })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile sync error:', updateError);
      return NextResponse.json({ error: 'Failed to sync plan' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      synced: true,
      plan: nextPlan,
    });
  } catch (err) {
    console.error('SYNC PLAN ERROR:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}