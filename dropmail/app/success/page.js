'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PLAN_LABELS = {
  free: 'Ghost',
  ghost: 'Ghost',
  phantom: 'Phantom',
  spectre: 'Spectre',
};

export default function SuccessPage() {
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState('ghost');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');

  const planLabel = useMemo(() => {
    return PLAN_LABELS[String(plan || 'ghost').toLowerCase()] || 'Ghost';
  }, [plan]);

  useEffect(() => {
    let mounted = true;
    let pollInterval = null;
    let secondsInterval = null;

    async function checkPlan() {
      try {
        setError('');

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          setStatus('guest');
          return;
        }

        setUser(session.user);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const currentPlan = String(profile?.plan || 'ghost').toLowerCase();
        setPlan(currentPlan);

        if (currentPlan === 'phantom' || currentPlan === 'spectre') {
          setStatus('upgraded');
          if (pollInterval) clearInterval(pollInterval);
          if (secondsInterval) clearInterval(secondsInterval);
          return;
        }

        setStatus('waiting');
      } catch (err) {
        console.error('Success page check error:', err);
        if (!mounted) return;
        setError(err.message || 'Failed to check your plan');
        setStatus('error');
      }
    }

    checkPlan();

    pollInterval = setInterval(checkPlan, 4000);
    secondsInterval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (secondsInterval) clearInterval(secondsInterval);
    };
  }, []);

  async function handleRefreshNow() {
    setStatus('checking');
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setStatus('guest');
        return;
      }

      setUser(session.user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const currentPlan = String(profile?.plan || 'ghost').toLowerCase();
      setPlan(currentPlan);

      if (currentPlan === 'phantom' || currentPlan === 'spectre') {
        setStatus('upgraded');
      } else {
        setStatus('waiting');
      }
    } catch (err) {
      console.error('Manual refresh error:', err);
      setError(err.message || 'Failed to refresh plan');
      setStatus('error');
    }
  }

  function getStatusTitle() {
    if (status === 'upgraded') return `${planLabel} activated`;
    if (status === 'guest') return 'Payment received';
    if (status === 'error') return 'We are syncing your plan';
    return 'Payment received';
  }

  function getStatusText() {
    if (status === 'upgraded') {
      return `Your account has been upgraded successfully. You can now use your ${planLabel} features from the dashboard.`;
    }

    if (status === 'guest') {
      return 'We could not detect a logged-in session in this browser. Sign in to your GhostMail account and your upgraded plan should appear shortly.';
    }

    if (status === 'error') {
      return 'Your payment may still be processing. Try refreshing your plan status, or sign in again and check your dashboard.';
    }

    return 'We received your payment and are syncing your subscription with your GhostMail account. This usually takes a few seconds.';
  }

  function getPillText() {
    if (status === 'upgraded') return `${planLabel} live`;
    if (status === 'guest') return 'Sign in required';
    if (status === 'error') return 'Sync issue';
    return 'Syncing plan...';
  }

  return (
    <main style={pageStyle}>
      <div style={bgGlowOne} />
      <div style={bgGlowTwo} />

      <div style={wrap}>
        <div style={card}>
          <div
            style={{
              ...iconWrap,
              background:
                status === 'upgraded'
                  ? 'rgba(34,197,94,0.12)'
                  : status === 'error'
                  ? 'rgba(239,68,68,0.10)'
                  : 'rgba(124,58,237,0.12)',
              borderColor:
                status === 'upgraded'
                  ? 'rgba(34,197,94,0.22)'
                  : status === 'error'
                  ? 'rgba(239,68,68,0.22)'
                  : 'rgba(124,58,237,0.22)',
            }}
          >
            {status === 'upgraded' ? '✓' : status === 'error' ? '!' : '⏳'}
          </div>

          <div
            style={{
              ...pill,
              color:
                status === 'upgraded'
                  ? '#16a34a'
                  : status === 'error'
                  ? '#dc2626'
                  : '#7c3aed',
              borderColor:
                status === 'upgraded'
                  ? 'rgba(34,197,94,0.24)'
                  : status === 'error'
                  ? 'rgba(239,68,68,0.24)'
                  : 'rgba(124,58,237,0.24)',
              background:
                status === 'upgraded'
                  ? 'rgba(34,197,94,0.10)'
                  : status === 'error'
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(124,58,237,0.10)',
            }}
          >
            {getPillText()}
          </div>

          <h1 style={title}>{getStatusTitle()}</h1>
          <p style={text}>{getStatusText()}</p>

          <div style={infoBox}>
            <div style={infoRow}>
              <span style={infoLabel}>Account</span>
              <span style={infoValue}>{user?.email || 'Not detected yet'}</span>
            </div>

            <div style={infoRow}>
              <span style={infoLabel}>Current plan</span>
              <span style={infoValue}>{planLabel}</span>
            </div>

            <div style={infoRow}>
              <span style={infoLabel}>Sync timer</span>
              <span style={infoValue}>{seconds}s</span>
            </div>
          </div>

          {status !== 'upgraded' && (
            <div style={progressWrap}>
              <div style={progressTrack}>
                <div
                  style={{
                    ...progressFill,
                    width: `${Math.min(92, 18 + seconds * 6)}%`,
                  }}
                />
              </div>
              <p style={progressText}>Checking your subscription status automatically...</p>
            </div>
          )}

          {error ? <p style={errorText}>{error}</p> : null}

          <div style={actions}>
            <a href="/dashboard" style={primaryBtn}>
              Go to dashboard
            </a>

            <button type="button" onClick={handleRefreshNow} style={secondaryBtn}>
              Refresh status
            </button>
          </div>

          <div style={subActions}>
            <a href="/" style={linkStyle}>
              Back to home
            </a>
            <a href="mailto:support@ghostmails.org" style={linkStyle}>
              Contact support
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'linear-gradient(180deg, rgba(124,58,237,0.06) 0%, rgba(236,72,153,0.03) 35%, transparent 70%), var(--bg)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const bgGlowOne = {
  position: 'absolute',
  top: '-120px',
  left: '-80px',
  width: '320px',
  height: '320px',
  borderRadius: '999px',
  background: 'rgba(124,58,237,0.12)',
  filter: 'blur(80px)',
};

const bgGlowTwo = {
  position: 'absolute',
  bottom: '-120px',
  right: '-80px',
  width: '320px',
  height: '320px',
  borderRadius: '999px',
  background: 'rgba(236,72,153,0.08)',
  filter: 'blur(90px)',
};

const wrap = {
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: '720px',
};

const card = {
  background: 'var(--surface-elevated, rgba(255,255,255,0.96))',
  border: '1px solid var(--border-soft, rgba(15,23,42,0.10))',
  borderRadius: '28px',
  boxShadow: '0 24px 70px rgba(15,23,42,0.12)',
  padding: '36px 28px',
  textAlign: 'center',
};

const iconWrap = {
  width: '72px',
  height: '72px',
  margin: '0 auto 18px',
  borderRadius: '22px',
  border: '1px solid',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '32px',
  fontWeight: 800,
};

const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid',
  borderRadius: '999px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const title = {
  margin: '18px 0 12px',
  fontSize: 'clamp(2rem, 4vw, 3rem)',
  lineHeight: 1.05,
  letterSpacing: '-0.04em',
  color: 'var(--text)',
};

const text = {
  margin: '0 auto',
  maxWidth: '580px',
  color: 'var(--muted)',
  fontSize: '15px',
  lineHeight: 1.75,
};

const infoBox = {
  marginTop: '24px',
  padding: '16px',
  borderRadius: '18px',
  background: 'var(--surface-soft, rgba(15,23,42,0.03))',
  border: '1px solid var(--border-soft, rgba(15,23,42,0.10))',
  textAlign: 'left',
};

const infoRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '10px 4px',
  borderBottom: '1px solid rgba(127,127,127,0.10)',
};

const infoLabel = {
  color: 'var(--muted)',
  fontSize: '14px',
  fontWeight: 600,
};

const infoValue = {
  color: 'var(--text)',
  fontSize: '14px',
  fontWeight: 800,
  textAlign: 'right',
  wordBreak: 'break-word',
};

const progressWrap = {
  marginTop: '24px',
};

const progressTrack = {
  width: '100%',
  height: '10px',
  borderRadius: '999px',
  background: 'rgba(15,23,42,0.08)',
  overflow: 'hidden',
};

const progressFill = {
  height: '100%',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, #7c3aed, #ec4899)',
  transition: 'width 0.35s ease',
};

const progressText = {
  marginTop: '10px',
  color: 'var(--muted)',
  fontSize: '13px',
};

const errorText = {
  marginTop: '16px',
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: 700,
};

const actions = {
  marginTop: '26px',
  display: 'flex',
  gap: '12px',
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const primaryBtn = {
  padding: '13px 18px',
  borderRadius: '14px',
  border: 'none',
  textDecoration: 'none',
  background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
  color: '#fff',
  fontWeight: 800,
  boxShadow: '0 12px 26px rgba(124,58,237,0.20)',
};

const secondaryBtn = {
  padding: '13px 18px',
  borderRadius: '14px',
  border: '1px solid var(--border-soft, rgba(15,23,42,0.10))',
  background: 'var(--surface-elevated, rgba(255,255,255,0.96))',
  color: 'var(--text)',
  fontWeight: 800,
  cursor: 'pointer',
};

const subActions = {
  marginTop: '18px',
  display: 'flex',
  gap: '16px',
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const linkStyle = {
  color: 'var(--muted)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
};