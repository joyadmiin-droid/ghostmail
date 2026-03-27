export async function POST(request) {
  try {
    const { plan } = await request.json();

    const priceId = plan === 'phantom'
      ? process.env.PADDLE_PHANTOM_PRICE_ID
      : process.env.PADDLE_SPECTRE_PRICE_ID;

    if (!priceId) {
      return Response.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const paddleRes = await fetch('https://sandbox-api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.PADDLE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        checkout: {
          url: process.env.NEXT_PUBLIC_APP_URL + '/success',
        },
        custom_data: { plan },
      }),
    });

    const data = await paddleRes.json();

    if (!paddleRes.ok) {
      console.error('Paddle error:', data);
      return Response.json({ error: data?.error?.detail || 'Paddle error' }, { status: 500 });
    }

    const checkoutUrl = data?.data?.checkout?.url;
    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout URL returned' }, { status: 500 });
    }

    return Response.json({ url: checkoutUrl });
  } catch (err) {
    console.error('Paddle checkout error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
