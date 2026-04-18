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
  const [oauthLoading, setOauthLoading] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
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
      } catch {
        if (!mounted) return;
        setCheckingSession(false);
        setError('Could not check session.');
      }
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

  async function handleOAuth(provider) {
    setError('');
    setMessage('');
    setOauthLoading(provider);

    try {
      const nextPath = getSafeNextPath();
      const origin =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? 'http://localhost:3000'
          : 'https://ghostmails.org';

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}${nextPath}`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err?.message || `${provider} sign-in failed.`);
      setOauthLoading('');
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const nextPath = getSafeNextPath();

      if (isReset) {
        const origin =
          typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://ghostmails.org';

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/reset-password`,
        });

        if (error) throw error;

        setMessage('Password reset email sent.');
        return;
      }

      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });

        if (error) throw error;

        setMessage('Account created. Check your email if confirmation is required.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      window.location.replace(nextPath);
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top, rgba(124,58,237,0.18), transparent 35%), linear-gradient(135deg, #0b1020, #111827 55%, #050816)',
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at top, rgba(124,58,237,0.18), transparent 35%), linear-gradient(135deg, #0b1020, #111827 55%, #050816)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <a
            href="/"
            style={{
              textDecoration: 'none',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
            }}
          >
            <span style={{ color: '#8b5cf6', fontSize: '24px' }}>&#10022;</span>
            GhostMail
          </a>

          <h1
            style={{
              margin: '8px 0 8px',
              color: '#ffffff',
              fontSize: '30px',
              fontWeight: '800',
              letterSpacing: '-0.03em',
            }}
          >
            {isReset ? 'Reset password' : isSignup ? 'Create your account' : 'Welcome back'}
          </h1>

          <p
            style={{
              margin: 0,
              color: '#94a3b8',
              fontSize: '15px',
              lineHeight: 1.5,
            }}
          >
            {isReset
              ? 'Enter your email and we’ll send you a reset link.'
              : isSignup
              ? 'Create your GhostMail account and start faster.'
              : 'Sign in to continue to your dashboard.'}
          </p>
        </div>

        {!isReset && (
          <>
            <div
              style={{
                marginBottom: '18px',
                display: 'flex',
                background: 'rgba(2,6,23,0.65)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px',
                padding: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsSignup(false);
                  setError('');
                  setMessage('');
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: !isSignup ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'transparent',
                  color: '#ffffff',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSignup(true);
                  setIsReset(false);
                  setError('');
                  setMessage('');
                }}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isSignup ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'transparent',
                  color: '#ffffff',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Sign up
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={oauthLoading !== ''}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: oauthLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {oauthLoading === 'google' ? 'Opening Google...' : 'Continue with Google'}
              </button>

              <button
                type="button"
                onClick={() => handleOAuth('github')}
                disabled={oauthLoading !== ''}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: oauthLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {oauthLoading === 'github' ? 'Opening GitHub...' : 'Continue with GitHub'}
              </button>

              <button
                type="button"
                onClick={() => handleOAuth('x')}
                disabled={oauthLoading !== ''}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: oauthLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {oauthLoading === 'x' ? 'Opening X...' : 'Continue with X'}
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>or continue with email</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </>
        )}

        {error ? (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.28)',
              color: '#fca5a5',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.28)',
              color: '#86efac',
              fontSize: '14px',
            }}
          >
            {message}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                color: '#cbd5e1',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              Email
            </label>
            <input
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(2,6,23,0.7)',
                color: '#ffffff',
                fontSize: '15px',
                outline: 'none',
              }}
            />
          </div>

          {!isReset && (
            <div>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#cbd5e1',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                Password
              </label>
              <input
                placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(2,6,23,0.7)',
                  color: '#ffffff',
                  fontSize: '15px',
                  outline: 'none',
                }}
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: '6px',
              padding: '14px 16px',
              border: 'none',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 16px 40px rgba(79,70,229,0.35)',
            }}
          >
            {loading
              ? 'Loading...'
              : isReset
              ? 'Send reset link'
              : isSignup
              ? 'Create account'
              : 'Login'}
          </button>
        </div>

        {!isReset ? (
          <div
            style={{
              marginTop: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
                setMessage('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a78bfa',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {isSignup ? 'Already have an account? Login' : 'New here? Sign up'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReset(true);
                setError('');
                setMessage('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Forgot password?
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '18px' }}>
            <button
              type="button"
              onClick={() => {
                setIsReset(false);
                setError('');
                setMessage('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a78bfa',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </main>
  );
}