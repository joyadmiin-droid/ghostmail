'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ✅ UPDATED LINKS (YOUR NEW ONES)
const CHECKOUT_LINKS = {
  phantom: 'https://ghostmailhq.lemonsqueezy.com/checkout/buy/9c456de5-48bb-49b6-a29c-963455db3ef6',
  spectre: 'https://ghostmailhq.lemonsqueezy.com/checkout/buy/20c6c4ec-3906-4ced-8489-6f45551d9d85',
};

function getSafePlan() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const plan = String(params.get('plan') || '').toLowerCase();

  if (plan === 'phantom' || plan === 'spectre') return plan;
  return null;
}

function buildCheckoutUrl(baseUrl, user, plan) {
  const url = new URL(baseUrl);

  // ✅ prevent cache issues
  url.searchParams.set('_t', Date.now());

  if (user?.email) {
    url.searchParams.set('checkout[email]', user.email);
  }

  if (user?.id) {
    url.searchParams.set('checkout[custom][user_id]', user.id);
  }

  url.searchParams.set('checkout[custom][plan]', plan);

  return url.toString();
}

export default function CheckoutPage() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Preparing secure checkout...');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const plan = getSafePlan();

        if (!plan) {
          window.location.replace('/#pricing');
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          window.location.replace(`/login?next=${encodeURIComponent(`/checkout?plan=${plan}`)}`);
          return;
        }

        const checkoutBase = CHECKOUT_LINKS[plan];

        if (!checkoutBase) {
          window.location.replace('/#pricing');
          return;
        }

        const checkoutUrl = buildCheckoutUrl(checkoutBase, session.user, plan);

        setStatus('redirecting');
        setMessage(`Redirecting to ${plan === 'phantom' ? 'Phantom' : 'Spectre'} checkout...`);

        window.location.replace(checkoutUrl);
      } catch (err) {
        console.error('Checkout redirect error:', err);
        if (!mounted) return;
        setStatus('error');
        setMessage('Could not start checkout. Please try again.');
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>{status === 'error' ? 'Error' : 'Preparing your checkout...'}</h1>
        <p>{message}</p>
      </div>
    </main>
  );
}