import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { plan, userId, email } = await req.json();

    if (!plan || !userId || !email) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    let variantId = '';

    // 🔥 IMPORTANT: replace with YOUR variant IDs if needed
    if (plan === 'phantom') {
      variantId = '9c456de5-48bb-49b6-a29c-963455db3ef6';
    }

    if (plan === 'spectre') {
      variantId = '20c6c4ec-3906-4ced-8489-6f45551d9d85';
    }

    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email,
              custom: {
                user_id: userId,
                plan,
              },
            },
            product_options: {
              redirect_url: `${siteUrl}/success?plan=${plan}`,
            },
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId,
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: variantId,
              },
            },
          },
        },
      }),
    });

    const data = await response.json();

    const checkoutUrl = data?.data?.attributes?.url;

    if (!checkoutUrl) {
      return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}