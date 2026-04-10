'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function getSafeNextPath() {
  if (typeof window === 'undefined') return '/dashboard';

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');

  if (!next) return '/dashboard';
  if (!next.startsWith('/')) return '/dashboard';
  if (next.startsWith('//')) return '/dashboard';

  return next;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const nextPath = getSafeNextPath();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        window.location.replace(nextPath);
        return;
      }

      setCheckingSession(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        const nextPath = getSafeNextPath();
        window.location.replace(nextPath);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const nextPath = getSafeNextPath();

      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://ghostmails.org/reset-password',
        });

        if (error) throw error;

        setMessage('Password reset email sent! Check your inbox.');
        return;
      }

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data?.user && !data?.session) {
          setMessage('Check your email to confirm your account!');
        } else {
          window.location.replace(nextPath);
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setMessage('Signed in. Redirecting...');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-soft)',
    borderRadius: '12px',
    color: 'var(--text)',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
  };

  const linkBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    padding: 0,
    fontFamily: 'inherit',
  };

  if (checkingSession) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Loading...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'DM Sans, sans-serif',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 20% 15%, rgba(124, 58, 237, 0.16), transparent 28%),
            radial-gradient(circle at 80% 0%, rgba(236, 72, 153, 0.12), transparent 24%),
            radial-gradient(circle at 50% 100%, rgba(59, 130, 246, 0.10), transparent 26%)
          `,
          zIndex: 0,
        }}
      />

      <a
        href="/"
        style={{
          textDecoration: 'none',
          marginBottom: '40px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1,
        }}
      >
        <span style={{ color: 'var(--accent)', fontSize: '20px' }}>&#10022;</span>
        <span style={{ color: 'var(--text)', fontSize: '18px', fontWeight: '700' }}>
          GhostMail
        </span>
      </a>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '40px',
          width: '100%',
          maxWidth: '420px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h1
          style={{
            color: 'var(--text)',
            fontSize: '24px',
            fontWeight: '700',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          {isReset ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back'}
        </h1>

        <p
          style={{
            color: 'var(--muted)',
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          {isReset
            ? 'Enter your email to get a reset link'
            : isSignup
            ? 'Join GhostMail today'
            : 'Sign in to your account'}
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              color: 'var(--muted)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: '600',
            }}
          >
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={inputStyle}
            autoComplete="email"
          />
        </div>

        {!isReset && (
          <div style={{ marginBottom: '8px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                color: 'var(--muted)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: '600',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </div>
        )}

        {!isSignup && !isReset && (
          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <button
              onClick={() => {
                setIsReset(true);
                setError('');
                setMessage('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px 0',
                fontFamily: 'inherit',
              }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {!isReset && <div style={{ marginBottom: '24px' }} />}

        {error && (
          <p
            style={{
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {message && (
          <p
            style={{
              color: '#16a34a',
              fontSize: '13px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            color: '#fff',
            border: 'none',
            borderRadius: '14px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            marginBottom: '20px',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 14px 30px rgba(124,58,237,0.18)',
          }}
        >
          {loading ? 'Loading...' : isReset ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
        </button>

        {isReset ? (
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)' }}>
            <button
              onClick={() => {
                setIsReset(false);
                setError('');
                setMessage('');
              }}
              style={linkBtnStyle}
            >
              Back to sign in
            </button>
          </p>
        ) : (
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
                setMessage('');
              }}
              style={linkBtnStyle}
            >
              {isSignup ? 'Sign in' : 'Create account'}
            </button>
          </p>
        )}

        <div
          style={{
            textAlign: 'center',
            marginTop: '2rem',
            fontSize: '12px',
            color: 'var(--muted)',
          }}
        >
          <a
            href="/terms"
            style={{ color: 'var(--muted)', textDecoration: 'none', margin: '0 8px' }}
          >
            Terms
          </a>
          <a
            href="/privacy"
            style={{ color: 'var(--muted)', textDecoration: 'none', margin: '0 8px' }}
          >
            Privacy
          </a>
          <a
            href="mailto:support@ghostmails.org"
            style={{ color: 'var(--muted)', textDecoration: 'none', margin: '0 8px' }}
          >
            Contact
          </a>
        </div>
      </div>
    </main>
  );
}