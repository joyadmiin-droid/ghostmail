import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';
const DEFAULT_BILLING_URL = 'https://ghostmailhq.lemonsqueezy.com/billing';
const LEMON_TIMEOUT_MS = 10000;

function getBearerToken(req) {
  const authHeader =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';

  if (!authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = LEMON_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req) {
  try {
    const token = getBearerToken(req);

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
        { error: 'Billing is temporarily unavailable' },
        { status: 500 }
      );
    }

    const customerUrl =
      `${LEMON_API_BASE}/customers` +
      `?filter[store_id]=${encodeURIComponent(storeId)}` +
      `&filter[email]=${encodeURIComponent(user.email)}`;

    const customerRes = await fetchWithTimeout(customerUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
      cache: 'no-store',
    });

    const customerData = await customerRes.json().catch(() => null);

    if (!customerRes.ok) {
      console.error('Lemon customers fetch failed:', {
        status: customerRes.status,
        body: customerData,
      });

      return NextResponse.json(
        { url: DEFAULT_BILLING_URL },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const customer = customerData?.data?.[0] || null;
    const signedPortalUrl = customer?.attributes?.urls?.customer_portal || null;

    return NextResponse.json(
      { url: signedPortalUrl || DEFAULT_BILLING_URL },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    console.error('Billing route error:', err);

    return NextResponse.json(
      { url: DEFAULT_BILLING_URL },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}