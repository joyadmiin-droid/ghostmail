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

  const signInWithGoogle = async () => {
    const redirectUrl =
      window.location.hostname === "localhost"
        ? "http://localhost:3000/dashboard"
        : "https://ghostmails.org/dashboard";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

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

      if (session?.user) {
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

    try {
      if (isReset) {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://ghostmails.org/reset-password',
        });
        return;
      }

      if (isSignup) {
        await supabase.auth.signUp({ email, password });
        return;
      }

      await supabase.auth.signInWithPassword({ email, password });
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) return <div>Loading...</div>;

  return (
    <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ width: '320px' }}>
        <h2>Login</h2>

        <button onClick={signInWithGoogle} style={{ width: '100%', marginBottom: '10px' }}>
          Continue with Google
        </button>

        <div style={{ textAlign: 'center', margin: '10px 0' }}>or</div>

        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        <button onClick={handleSubmit}>
          Login
        </button>
      </div>
    </main>
  );
}