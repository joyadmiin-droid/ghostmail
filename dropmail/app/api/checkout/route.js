import { NextResponse } from 'next/server';
import { normalizePlan } from '../../../../lib/plans';
import { PRICING } from '@/app/lib/pricing';

export async function POST(req) {
  try {
    const { plan, cycle = 'monthly', userId, email } = await req.json();

    if (!plan || !userId || !email) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const rawPlan = String(plan).toLowerCase();
    const normalizedPlan = rawPlan === 'topup_100' ? 'topup_100' : normalizePlan(rawPlan);
    const normalizedCycle = String(cycle || 'monthly').toLowerCase();

    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!storeId || !apiKey || !siteUrl) {
      return NextResponse.json(
        { error: 'Missing Lemon Squeezy env vars' },
        { status: 500 }
      );
    }

    let variantId = '';

    if (normalizedPlan === 'topup_100') {
      variantId = process.env.LEMONSQUEEZY_TOPUP_100_VARIANT_ID || '';
    } else {
      const selectedPlan = PRICING?.[normalizedPlan];
      const selectedCycle = selectedPlan?.[normalizedCycle];

      if (!selectedPlan || !selectedCycle) {
        return NextResponse.json(
          { error: `Invalid plan or cycle: ${normalizedPlan} / ${normalizedCycle}` },
          { status: 400 }
        );
      }

      variantId = String(selectedCycle.variantId || '');
    }

    if (!variantId) {
      return NextResponse.json(
        { error: `Missing variant ID for plan: ${normalizedPlan} (${normalizedCycle})` },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email,
              custom: {
                user_id: userId,
                plan: normalizedPlan,
                cycle: normalizedCycle,
              },
            },
            product_options: {
              redirect_url: `${siteUrl}/success?plan=${encodeURIComponent(
                normalizedPlan
              )}&cycle=${encodeURIComponent(normalizedCycle)}`,
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: String(storeId),
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: String(variantId),
              },
            },
          },
        },
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('Lemon checkout create failed:', data);
      return NextResponse.json(
        { error: data?.errors?.[0]?.detail || 'Checkout failed' },
        { status: response.status || 500 }
      );
    }

    const checkoutUrl = data?.data?.attributes?.url;

    if (!checkoutUrl) {
      console.error('Lemon checkout URL missing:', data);
      return NextResponse.json(
        { error: 'Checkout URL missing' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error('Checkout route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}