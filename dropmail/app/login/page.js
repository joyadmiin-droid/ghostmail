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

function GhostLogo({ style = {} }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path
        d="M64 14C42.46 14 25 31.46 25 53V89.5C25 96.404 30.596 102 37.5 102C42.984 102 47.642 98.465 49.349 93.55C50.811 98.634 55.499 102.35 61.12 102.35C66.77 102.35 71.477 98.595 72.912 93.469C74.603 98.425 79.278 102 84.8 102C91.711 102 97.314 96.397 97.314 89.486V53C97.314 31.46 79.854 14 58.314 14H64Z"
        fill="white"
      />
      <path
        d="M64 14C42.46 14 25 31.46 25 53V89.5C25 96.404 30.596 102 37.5 102C42.984 102 47.642 98.465 49.349 93.55C50.811 98.634 55.499 102.35 61.12 102.35C66.77 102.35 71.477 98.595 72.912 93.469C74.603 98.425 79.278 102 84.8 102C91.711 102 97.314 96.397 97.314 89.486V53C97.314 31.46 79.854 14 58.314 14H64Z"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <circle cx="49.5" cy="50.5" r="5.8" fill="#1F1840" />
      <circle cx="77.5" cy="50.5" r="5.8" fill="#1F1840" />
      <path
        d="M52 69C58 75 69 75 75 69"
        stroke="#1F1840"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
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

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'signup_success',
      path: window.location.pathname,
      label: 'email_signup',
      user_email: email
    })
  }).catch(() => {});

  setMessage('Account created. Check your email if confirmation is required.');
  return;
}

      const { error } = await supabase.auth.signInWithPassword({ email, password });

if (error) throw error;

fetch('/api/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'login_success',
    path: window.location.pathname,
    label: 'email_login',
    user_email: email
  })
}).catch(() => {});

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
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: oauthLoading ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    transition: 'all 0.2s ease',
    boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
  };

  if (checkingSession) {
    return (
      <main style={loadingWrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={loadingSpinner} />
          <p style={loadingLabel}>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <style>{`
        * { box-sizing: border-box; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .auth-social-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 34px rgba(0,0,0,0.24);
        }

        .auth-tab:hover {
          opacity: 0.95;
        }

        .auth-input:focus {
          border-color: rgba(167,139,250,0.34) !important;
          box-shadow: 0 0 0 4px rgba(109,73,255,0.10);
        }

        .auth-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 38px rgba(109,73,255,0.30);
        }

        @media (max-width: 640px) {
          .auth-shell {
            padding: 20px !important;
            border-radius: 24px !important;
          }

          .auth-title {
            font-size: 28px !important;
          }
        }
      `}</style>

      <div style={ambientGlowLeft} />
      <div style={ambientGlowRight} />

      <div style={shell} className="auth-shell">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <a href="/" style={brandLink}>
            <GhostLogo style={{ width: 30, height: 30, color: '#8b5cf6', flexShrink: 0 }} />
            <span style={brandText}>GhostMail</span>
          </a>

          <h1 style={title} className="auth-title">
            {isReset ? 'Reset password' : isSignup ? 'Create your account' : 'Welcome back'}
          </h1>

          <p style={subtitle}>
            {isReset
              ? 'Enter your email and we’ll send you a reset link.'
              : isSignup
              ? 'Create your GhostMail account and start faster.'
              : 'Sign in to continue to your dashboard.'}
          </p>
        </div>

        {!isReset && (
          <>
            <div style={switchWrap}>
              <button
                type="button"
                className="auth-tab"
                onClick={() => {
                  setIsSignup(false);
                  setError('');
                  setMessage('');
                }}
                style={{
                  ...switchBtn,
                  background: !isSignup ? 'linear-gradient(135deg, #6d49ff, #5836e8)' : 'transparent',
                  color: '#ffffff',
                  boxShadow: !isSignup ? '0 10px 24px rgba(109,73,255,0.24)' : 'none',
                }}
              >
                Login
              </button>

              <button
                type="button"
                className="auth-tab"
                onClick={() => {
                  setIsSignup(true);
                  setIsReset(false);
                  setError('');
                  setMessage('');
                }}
                style={{
                  ...switchBtn,
                  background: isSignup ? 'linear-gradient(135deg, #6d49ff, #5836e8)' : 'transparent',
                  color: '#ffffff',
                  boxShadow: isSignup ? '0 10px 24px rgba(109,73,255,0.24)' : 'none',
                }}
              >
                Sign up
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '18px' }}>
              <button
                type="button"
                className="auth-social-btn"
                onClick={() => handleOAuth('google')}
                disabled={oauthLoading !== ''}
                style={{
                  ...socialButtonBase,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))',
                }}
              >
                <GoogleIcon />
                <span>{oauthLoading === 'google' ? 'Opening Google...' : 'Continue with Google'}</span>
              </button>

              <button
                type="button"
                className="auth-social-btn"
                onClick={() => handleOAuth('github')}
                disabled={oauthLoading !== ''}
                style={{
                  ...socialButtonBase,
                  background: 'linear-gradient(135deg, #161b22, #0d1117)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <GitHubIcon />
                <span>{oauthLoading === 'github' ? 'Opening GitHub...' : 'Continue with GitHub'}</span>
              </button>

              <button
                type="button"
                className="auth-social-btn"
                onClick={() => handleOAuth('x')}
                disabled={oauthLoading !== ''}
                style={{
                  ...socialButtonBase,
                  background: 'linear-gradient(135deg, #111111, #000000)',
                  border: '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <XIcon />
                <span>{oauthLoading === 'x' ? 'Opening X...' : 'Continue with X'}</span>
              </button>
            </div>

            <div style={dividerWrap}>
              <div style={dividerLine} />
              <span style={dividerText}>or continue with email</span>
              <div style={dividerLine} />
            </div>
          </>
        )}

        {error ? (
          <div style={errorBox}>
            {error}
          </div>
        ) : null}

        {message ? (
          <div style={successBox}>
            {message}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={label}>Email</label>
            <input
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </div>

          {!isReset && (
            <div>
              <label style={label}>Password</label>
              <input
                className="auth-input"
                placeholder={isSignup ? 'Create a password' : 'Enter your password'}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={input}
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="auth-primary"
            style={{
              ...primaryBtn,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.72 : 1,
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
          <div style={bottomRow}>
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
                setMessage('');
              }}
              style={linkBtnPrimary}
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
              style={linkBtnMuted}
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
              style={linkBtnPrimary}
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/* styles */

const pageWrap = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  background:
    'radial-gradient(circle at top, rgba(109,73,255,0.18), transparent 28%), linear-gradient(135deg, #0b1020, #111827 55%, #050816)',
  fontFamily: 'Inter, system-ui, sans-serif',
  position: 'relative',
  overflow: 'hidden',
};

const ambientGlowLeft = {
  position: 'absolute',
  width: 420,
  height: 420,
  borderRadius: '50%',
  background: 'rgba(109,73,255,0.18)',
  filter: 'blur(120px)',
  top: '-10%',
  left: '-6%',
  pointerEvents: 'none',
};

const ambientGlowRight = {
  position: 'absolute',
  width: 360,
  height: 360,
  borderRadius: '50%',
  background: 'rgba(217,70,178,0.12)',
  filter: 'blur(120px)',
  bottom: '-10%',
  right: '-4%',
  pointerEvents: 'none',
};

const shell = {
  width: '100%',
  maxWidth: '470px',
  background: 'rgba(15, 23, 42, 0.88)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '28px',
  padding: '34px',
  boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(16px)',
  position: 'relative',
  zIndex: 1,
};

const brandLink = {
  textDecoration: 'none',
  color: '#ffffff',
  fontSize: '30px',
  fontWeight: '800',
  letterSpacing: '-0.02em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '10px',
};

const brandText = {
  color: '#ffffff',
  fontSize: '30px',
  fontWeight: 800,
  letterSpacing: '-0.03em',
};

const title = {
  margin: '8px 0 8px',
  color: '#ffffff',
  fontSize: '34px',
  fontWeight: '800',
  letterSpacing: '-0.04em',
};

const subtitle = {
  margin: 0,
  color: '#94a3b8',
  fontSize: '15px',
  lineHeight: 1.5,
};

const switchWrap = {
  marginBottom: '18px',
  display: 'flex',
  background: 'rgba(2,6,23,0.55)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '4px',
};

const switchBtn = {
  flex: 1,
  padding: '11px 12px',
  borderRadius: '12px',
  border: 'none',
  fontWeight: '700',
  cursor: 'pointer',
};

const dividerWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '18px',
};

const dividerLine = {
  flex: 1,
  height: '1px',
  background: 'rgba(255,255,255,0.08)',
};

const dividerText = {
  color: '#94a3b8',
  fontSize: '13px',
};

const errorBox = {
  marginBottom: '16px',
  padding: '12px 14px',
  borderRadius: '12px',
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.28)',
  color: '#fca5a5',
  fontSize: '14px',
};

const successBox = {
  marginBottom: '16px',
  padding: '12px 14px',
  borderRadius: '12px',
  background: 'rgba(34,197,94,0.12)',
  border: '1px solid rgba(34,197,94,0.28)',
  color: '#86efac',
  fontSize: '14px',
};

const label = {
  display: 'block',
  marginBottom: '8px',
  color: '#cbd5e1',
  fontSize: '14px',
  fontWeight: '600',
};

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(2,6,23,0.7)',
  color: '#ffffff',
  fontSize: '15px',
  outline: 'none',
  transition: 'all 0.18s ease',
};

const primaryBtn = {
  width: '100%',
  marginTop: '6px',
  padding: '14px 16px',
  border: 'none',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, #6d49ff, #5836e8)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '700',
  boxShadow: '0 16px 40px rgba(109,73,255,0.28)',
  transition: 'all 0.18s ease',
};

const bottomRow = {
  marginTop: '18px',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  flexWrap: 'wrap',
};

const linkBtnPrimary = {
  background: 'transparent',
  border: 'none',
  color: '#a78bfa',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  padding: 0,
};

const linkBtnMuted = {
  background: 'transparent',
  border: 'none',
  color: '#cbd5e1',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  padding: 0,
};

const loadingWrap = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background:
    'radial-gradient(circle at top, rgba(109,73,255,0.18), transparent 28%), linear-gradient(135deg, #0b1020, #111827 55%, #050816)',
  color: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const loadingSpinner = {
  width: 34,
  height: 34,
  border: '3px solid rgba(255,255,255,0.18)',
  borderTop: '3px solid #8b5cf6',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  margin: '0 auto',
};

const loadingLabel = {
  marginTop: 14,
  color: '#cbd5e1',
  fontSize: 14,
};