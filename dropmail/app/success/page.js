'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PLAN_LABELS = {
  ghost: 'Ghost',
  free: 'Ghost',
  phantom: 'Phantom',
  spectre: 'Spectre',
};

function getExpectedPlan() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const plan = String(params.get('plan') || '').toLowerCase();

  if (plan === 'phantom' || plan === 'spectre') return plan;
  return null;
}

export default function SuccessPage() {
  const [status, setStatus] = useState('checking');
  const [currentPlan, setCurrentPlan] = useState('ghost');
  const [expectedPlan, setExpectedPlan] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const currentPlanLabel = useMemo(() => {
    return PLAN_LABELS[String(currentPlan || 'ghost').toLowerCase()] || 'Ghost';
  }, [currentPlan]);

  const expectedPlanLabel = useMemo(() => {
    return PLAN_LABELS[String(expectedPlan || '').toLowerCase()] || '';
  }, [expectedPlan]);

  useEffect(() => {
    let mounted = true;
    let pollInterval = null;
    let secondsInterval = null;
    let redirectTimeout = null;

    async function checkPlan() {
      try {
        setError('');

        const wantedPlan = getExpectedPlan();
        if (mounted) setExpectedPlan(wantedPlan);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          setStatus('guest');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const plan = String(profile?.plan || 'ghost').toLowerCase();
        setCurrentPlan(plan);

        if (wantedPlan && plan === wantedPlan) {
          setStatus('upgraded');

          if (pollInterval) clearInterval(pollInterval);
          if (secondsInterval) clearInterval(secondsInterval);

          redirectTimeout = setTimeout(() => {
            window.location.replace('/dashboard?upgraded=1');
          }, 1200);

          return;
        }

        setStatus('waiting');
      } catch (err) {
        console.error('Success page sync error:', err);
        if (!mounted) return;
        setError('Failed to check plan');
        setStatus('error');
      }
    }

    checkPlan();

    pollInterval = setInterval(checkPlan, 2500);
    secondsInterval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (secondsInterval) clearInterval(secondsInterval);
      if (redirectTimeout) clearTimeout(redirectTimeout);
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
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'var(--surface-elevated, rgba(255,255,255,0.96))',
          border: '1px solid var(--border-soft, rgba(15,23,42,0.10))',
          borderRadius: '28px',
          boxShadow: '0 24px 70px rgba(15,23,42,0.12)',
          padding: '36px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            margin: '0 auto 18px',
            borderRadius: '22px',
            border: '1px solid rgba(124,58,237,0.22)',
            background:
              status === 'upgraded'
                ? 'rgba(34,197,94,0.12)'
                : status === 'error'
                ? 'rgba(239,68,68,0.10)'
                : 'rgba(124,58,237,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: 800,
          }}
        >
          {status === 'upgraded' ? '✅' : status === 'error' ? '!' : '⏳'}
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
            color: status === 'upgraded' ? '#16a34a' : '#7c3aed',
            background: status === 'upgraded' ? 'rgba(34,197,94,0.10)' : 'rgba(124,58,237,0.10)',
          }}
        >
          {status === 'upgraded' ? 'Plan activated' : 'Syncing plan'}
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
          {status === 'upgraded'
            ? `You are now ${expectedPlanLabel}`
            : status === 'guest'
            ? 'Login required'
            : 'Syncing your plan...'}
        </h1>

        <p
          style={{
            margin: '0 auto 18px',
            maxWidth: '460px',
            color: 'var(--muted)',
            fontSize: '15px',
            lineHeight: 1.75,
          }}
        >
          {status === 'upgraded'
            ? 'Your account has been upgraded successfully. Redirecting you to dashboard...'
            : status === 'guest'
            ? 'Please log in first so we can verify and apply your upgraded plan.'
            : 'We are confirming your subscription and updating your account.'}
        </p>

        <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
          <div><strong>Current:</strong> {currentPlanLabel}</div>
          <div><strong>Expected:</strong> {expectedPlanLabel || 'Checking...'}</div>
          {status !== 'upgraded' && <div><strong>Time:</strong> {seconds}s</div>}
        </div>

        {status !== 'upgraded' && status !== 'guest' && (
          <div style={{ marginTop: '24px', marginBottom: '20px' }}>
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
                  width: `${Math.min(90, 18 + seconds * 6)}%`,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: '#dc2626', marginTop: '12px' }}>{error}</p>
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
            href="/dashboard"
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
            Go to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}