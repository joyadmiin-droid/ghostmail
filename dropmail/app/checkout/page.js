'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { normalizePlan } from '../../lib/plans';

const CHECKOUT_PLANS = ['phantom', 'spectre', 'topup_100'];

function CheckoutInner() {
  const searchParams = useSearchParams();

  const rawPlan = String(searchParams.get('plan') || '').toLowerCase();
  const plan = rawPlan === 'topup_100' ? 'topup_100' : normalizePlan(rawPlan);
  const cycle = String(searchParams.get('cycle') || 'monthly').toLowerCase();

  useEffect(() => {
    const go = async () => {
      try {
        if (!CHECKOUT_PLANS.includes(plan)) {
          alert('Invalid checkout plan');
          window.location.href = '/dashboard';
          return;
        }

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