import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : '';

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return NextResponse.json(
        { error: 'Missing Lemon Squeezy configuration' },
        { status: 500 }
      );
    }

    const customerRes = await fetch(
      `https://api.lemonsqueezy.com/v1/customers?filter[store_id]=${encodeURIComponent(
        storeId
      )}&filter[email]=${encodeURIComponent(user.email)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
        cache: 'no-store',
      }
    );

    const customerData = await customerRes.json().catch(() => null);

    if (!customerRes.ok) {
      console.error('Lemon customers fetch failed:', customerData);
      return NextResponse.json(
        { error: 'Failed to load billing portal' },
        { status: customerRes.status || 500 }
      );
    }

    const customer = customerData?.data?.[0] || null;
    const signedPortalUrl = customer?.attributes?.urls?.customer_portal || null;

    if (signedPortalUrl) {
      return NextResponse.json({ url: signedPortalUrl });
    }

    return NextResponse.json({
      url: 'https://ghostmailhq.lemonsqueezy.com/billing',
    });
  } catch (err) {
    console.error('Billing route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}