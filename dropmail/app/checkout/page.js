'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function CheckoutInner() {
  const searchParams = useSearchParams();
  const plan = String(searchParams.get('plan') || '').toLowerCase();

  useEffect(() => {
    const go = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const userId = session?.user?.id;
        const userEmail = session?.user?.email;

        if (!userId || !userEmail) {
          alert('You must be logged in');
          window.location.href = '/login';
          return;
        }

        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

        let baseUrl = '';
        let successUrl = '';

        if (plan === 'phantom') {
          baseUrl =
            'https://ghostmailhq.lemonsqueezy.com/checkout/buy/9c456de5-48bb-49b6-a29c-963455db3ef6';
          successUrl = `${siteUrl}/success?plan=phantom`;
        } else if (plan === 'spectre') {
          baseUrl =
            'https://ghostmailhq.lemonsqueezy.com/checkout/buy/20c6c4ec-3906-4ced-8489-6f45551d9d85';
          successUrl = `${siteUrl}/success?plan=spectre`;
        } else {
          alert('Invalid plan selected');
          window.location.href = '/dashboard';
          return;
        }

        const url = new URL(baseUrl);

        url.searchParams.set('checkout[email]', userEmail);
        url.searchParams.set('checkout[custom][user_id]', userId);
        url.searchParams.set('checkout[custom][plan]', plan);
        url.searchParams.set('checkout[success_url]', successUrl);

        window.location.href = url.toString();
      } catch (error) {
        console.error('Checkout redirect failed:', error);
        alert('Failed to prepare checkout');
        window.location.href = '/dashboard';
      }
    };

    go();
  }, [plan]);

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>Preparing your checkout...</h1>
      <p>Secure redirect in progress</p>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
          Loading...
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}