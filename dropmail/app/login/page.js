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
      provider: "google"
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

  if (checkingSession) return <div>Loading...</div>;

  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ width: '320px' }}>
        <h2>{isSignup ? 'Create account' : 'Login'}</h2>

        {!isReset && (
          <>
            <button onClick={signInWithGoogle} style={{ width: '100%', marginBottom: '10px' }}>
              Continue with Google
            </button>
            <div style={{ textAlign: 'center', margin: '10px 0' }}>or</div>
          </>
        )}

        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        {!isReset && <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />}

        <button onClick={handleSubmit}>
          {isSignup ? 'Sign up' : isReset ? 'Reset' : 'Login'}
        </button>
      </div>
    </main>
  );
}