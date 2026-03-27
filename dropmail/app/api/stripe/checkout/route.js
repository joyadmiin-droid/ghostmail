export async function POST(request) {
  try {
    const { plan } = await request.json();

    const priceId = plan === 'phantom'
      ? process.env.PADDLE_PHANTOM_PRICE_ID
      : process.env.PADDLE_SPECTRE_PRICE_ID;

    if (!priceId) {
      return Response.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'Paddle not configured' }, { status: 500 });
    }

    const successUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.ghostmails.org') + '/success';

    // Use Paddle sandbox API
    const paddleRes = await fetch('https://sandbox-api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            price_id: priceId.trim(),
            quantity: 1,
          }
        ],
        checkout: {
          url: successUrl,
        },
      }),
    });

    const data = await paddleRes.json();

    console.log('Paddle response status:', paddleRes.status);
    console.log('Paddle response:', JSON.stringify(data));

    if (!paddleRes.ok) {
      const errDetail = data?.error?.detail || data?.error?.code || JSON.stringify(data);
      return Response.json({ error: errDetail }, { status: 500 });
    }

    // Get the checkout URL from the response
    const checkoutUrl = data?.data?.checkout?.url;

    if (!checkoutUrl) {
      console.error('No checkout URL in response:', JSON.stringify(data));
      return Response.json({ error: 'No checkout URL returned from Paddle' }, { status: 500 });
    }

    return Response.json({ url: checkoutUrl });

  } catch (err) {
    console.error('Paddle checkout error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
