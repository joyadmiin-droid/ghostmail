'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function CheckoutInner() {
  const searchParams = useSearchParams();
  const plan = String(searchParams.get('plan') || '').toLowerCase();
  const cycle = String(searchParams.get('cycle') || 'monthly').toLowerCase();

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
          const next = `/checkout?plan=${encodeURIComponent(plan)}&cycle=${encodeURIComponent(cycle)}`;
          window.location.href = `/login?next=${encodeURIComponent(next)}`;
          return;
        }

        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plan,
            cycle,
            userId,
            email: userEmail,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.url) {
          console.error('Checkout failed:', data);
          alert(data?.error || 'Checkout failed');
          window.location.href = '/dashboard';
          return;
        }

        window.location.href = data.url;
      } catch (err) {
        console.error('Checkout page error:', err);
        alert('Something went wrong');
        window.location.href = '/dashboard';
      }
    };

    go();
  }, [plan, cycle]);

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