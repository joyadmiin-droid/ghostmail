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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.7 1.1 7.8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.4 39.6 16.1 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.3 5.6-6.2 7.1l6.2 5.2C38.7 37.2 44 31.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.85 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.19.69-3.86-1.35-3.86-1.35-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.97 10.97 0 0 1 5.74 0c2.18-1.48 3.14-1.17 3.14-1.17.63 1.58.24 2.75.12 3.04.73.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.77 1.03.77 2.08 0 1.5-.01 2.7-.01 3.07 0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.26l-4.9-7.42L5.53 22H2.4l7.24-8.28L1.9 2h6.42l4.42 6.75L18.9 2zm-1.1 18h1.73L7.36 3.9H5.5L17.8 20z"/>
    </svg>
  );
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

  const socialButtonBase = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: oauthLoading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    transition: 'all 0.2s ease',
    boxShadow: '0 14px 34px rgba(0,0,0,0.22)',
  };

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
          maxWidth: '460px',
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px',
          padding: '34px',
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
              fontSize: '30px',
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
              fontSize: '32px',
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
                  ...socialButtonBase,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
                }}
              >
                <GoogleIcon />
                <span>{oauthLoading === 'google' ? 'Opening Google...' : 'Continue with Google'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuth('github')}
                disabled={oauthLoading !== ''}
                style={{
                  ...socialButtonBase,
                  background: 'linear-gradient(135deg, #161b22, #0d1117)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <GitHubIcon />
                <span>{oauthLoading === 'github' ? 'Opening GitHub...' : 'Continue with GitHub'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuth('x')}
                disabled={oauthLoading !== ''}
                style={{
                  ...socialButtonBase,
                  background: 'linear-gradient(135deg, #111111, #000000)',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                <XIcon />
                <span>{oauthLoading === 'x' ? 'Opening X...' : 'Continue with X'}</span>
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