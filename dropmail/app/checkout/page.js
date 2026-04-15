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

        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plan,
            userId,
            email: userEmail,
          }),
        });

        const data = await res.json();

        if (!data.url) {
          alert('Checkout failed');
          window.location.href = '/dashboard';
          return;
        }

        window.location.href = data.url;
      } catch (err) {
        console.error(err);
        alert('Something went wrong');
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
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutInner />
    </Suspense>
  );
}