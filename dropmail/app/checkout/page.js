'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

function CheckoutInner() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');

  useEffect(() => {
    const go = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;

      if (!userId) {
        alert('You must be logged in');
        return;
      }

      let url = '';

      if (plan === 'phantom') {
        url = `https://ghostmailhq.lemonsqueezy.com/checkout/buy/9c456de5-48bb-49b6-a29c-963455db3ef6?checkout[custom][user_id]=${userId}&checkout[custom][plan]=phantom`;
      }

      if (plan === 'spectre') {
        url = `https://ghostmailhq.lemonsqueezy.com/checkout/buy/20c6c4ec-3906-4ced-8489-6f45551d9d85?checkout[custom][user_id]=${userId}&checkout[custom][plan]=spectre`;
      }

      window.location.href = url;
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
    <Suspense fallback={<div style={{ textAlign: 'center', marginTop: '100px' }}>Loading...</div>}>
      <CheckoutInner />
    </Suspense>
  );
}