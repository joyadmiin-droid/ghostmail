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
      } catch (err) {
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

  if (checkingSession) return <div>Loading...</div>;

  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ width: '320px' }}>
        <h2>{isReset ? 'Reset password' : isSignup ? 'Create account' : 'Login'}</h2>

        {error ? <p style={{ color: 'red' }}>{error}</p> : null}
        {message ? <p style={{ color: 'green' }}>{message}</p> : null}

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: '10px' }}
        />

        {!isReset && (
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginBottom: '10px' }}
          />
        )}

        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Loading...' : isReset ? 'Send reset link' : isSignup ? 'Create account' : 'Login'}
        </button>

        {!isReset ? (
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
                setMessage('');
              }}
            >
              {isSignup ? 'Back to login' : 'Create account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReset(true);
                setError('');
                setMessage('');
              }}
              style={{ marginLeft: '8px' }}
            >
              Forgot password
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => {
                setIsReset(false);
                setError('');
                setMessage('');
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