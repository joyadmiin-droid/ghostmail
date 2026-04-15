import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return NextResponse.json(
        { error: 'Missing Lemon Squeezy API key or store ID' },
        { status: 500 }
      );
    }

    const productsRes = await fetch(
      `https://api.lemonsqueezy.com/v1/products?filter[store_id]=${encodeURIComponent(storeId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
      }
    );

    const productsData = await productsRes.json().catch(() => null);

    if (!productsRes.ok) {
      console.error('Products fetch failed:', productsData);
      return NextResponse.json(
        { error: 'Failed to fetch products', details: productsData },
        { status: productsRes.status || 500 }
      );
    }

    const products = productsData?.data || [];
    const out = [];

    for (const product of products) {
      const productId = product?.id;
      const productName = product?.attributes?.name || 'Unnamed product';

      const variantsRes = await fetch(
        `https://api.lemonsqueezy.com/v1/variants?filter[product_id]=${encodeURIComponent(productId)}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
          },
        }
      );

      const variantsData = await variantsRes.json().catch(() => null);

      if (!variantsRes.ok) {
        out.push({
          productId,
          productName,
          error: variantsData,
        });
        continue;
      }

      const variants = (variantsData?.data || []).map((variant) => ({
        variantId: variant.id,
        name: variant?.attributes?.name,
        slug: variant?.attributes?.slug,
        price: variant?.attributes?.price,
        status: variant?.attributes?.status,
        isSubscription: variant?.attributes?.is_subscription,
        testMode: variant?.attributes?.test_mode,
      }));

      out.push({
        productId,
        productName,
        variants,
      });
    }

    return NextResponse.json({ storeId, products: out });
  } catch (err) {
    console.error('Variant listing route error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}