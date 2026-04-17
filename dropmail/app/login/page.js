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

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://ghostmails.org/dashboard",
      },
    });
  };

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
      } catch (err) {
        console.error('Login init error:', err);
        if (mounted) setCheckingSession(false);
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
        }}
      >
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>
          {isReset ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back'}
        </h1>

        <p style={{ textAlign: 'center', marginBottom: '20px' }}>
          {isSignup ? 'Join GhostMail instantly' : 'Sign in instantly'}
        </p>

        {/* GOOGLE BUTTON */}
        {!isReset && (
          <>
            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%',
                padding: '14px',
                background: '#fff',
                color: '#000',
                border: '1px solid #ddd',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '12px',
              }}
            >
              Continue with Google
            </button>

            <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '12px' }}>
              or
            </div>
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        {!isReset && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, marginTop: '10px' }}
          />
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '14px',
            marginTop: '15px',
            background: 'purple',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
          }}
        >
          {isSignup ? 'Create account' : isReset ? 'Reset password' : 'Sign in'}
        </button>
      </div>
    </main>
  );
}