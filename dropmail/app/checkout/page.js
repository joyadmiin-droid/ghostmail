'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CHECKOUT_LINKS = {
  phantom: 'https://ghostmailhq.lemonsqueezy.com/checkout/buy/f2504844-3852-4cc5-8e82-88fbb4d4ecc1',
  spectre: 'https://ghostmailhq.lemonsqueezy.com/checkout/buy/ed150037-4dd6-4665-8a59-ddb49eb0212c',
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

  // force fresh checkout (VERY IMPORTANT)
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
    <main
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, rgba(236,72,153,0.03) 35%, transparent 70%), var(--bg)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-120px',
          left: '-80px',
          width: '320px',
          height: '320px',
          borderRadius: '999px',
          background: 'rgba(124,58,237,0.12)',
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-120px',
          right: '-80px',
          width: '320px',
          height: '320px',
          borderRadius: '999px',
          background: 'rgba(236,72,153,0.08)',
          filter: 'blur(90px)',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface-elevated, rgba(255,255,255,0.96))',
          border: '1px solid var(--border-soft, rgba(15,23,42,0.10))',
          borderRadius: '28px',
          boxShadow: '0 24px 70px rgba(15,23,42,0.12)',
          padding: '36px 28px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 18px',
            borderRadius: '22px',
            border: '1px solid rgba(124,58,237,0.22)',
            background: status === 'error' ? 'rgba(239,68,68,0.10)' : 'rgba(124,58,237,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: 800,
          }}
        >
          {status === 'error' ? '!' : '⏳'}
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(124,58,237,0.24)',
            borderRadius: '999px',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: status === 'error' ? '#dc2626' : '#7c3aed',
            background: status === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(124,58,237,0.10)',
          }}
        >
          {status === 'error' ? 'Checkout issue' : 'Secure checkout'}
        </div>

        <h1
          style={{
            margin: '18px 0 12px',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            color: 'var(--text)',
          }}
        >
          {status === 'error' ? 'Could not open checkout' : 'Preparing your checkout'}
        </h1>

        <p
          style={{
            margin: '0 auto',
            maxWidth: '460px',
            color: 'var(--muted)',
            fontSize: '15px',
            lineHeight: 1.75,
          }}
        >
          {message}
        </p>

        {status !== 'error' && (
          <div style={{ marginTop: '24px' }}>
            <div
              style={{
                width: '100%',
                height: '10px',
                borderRadius: '999px',
                background: 'rgba(15,23,42,0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: '72%',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: '26px',
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <a
            href="/#pricing"
            style={{
              padding: '13px 18px',
              borderRadius: '14px',
              border: '1px solid var(--border-soft, rgba(15,23,42,0.10))',
              background: 'var(--surface-elevated, rgba(255,255,255,0.96))',
              color: 'var(--text)',
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            Back to pricing
          </a>

          <a
            href="/dashboard"
            style={{
              padding: '13px 18px',
              borderRadius: '14px',
              border: 'none',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
              color: '#fff',
              fontWeight: 800,
              boxShadow: '0 12px 26px rgba(124,58,237,0.20)',
            }}
          >
            Go to dashboard
          </a>
        </div>

        <style>{`
          @keyframes pulse {
            0% { opacity: 0.65; }
            50% { opacity: 1; }
            100% { opacity: 0.65; }
          }
        `}</style>
      </div>
    </main>
  );
}