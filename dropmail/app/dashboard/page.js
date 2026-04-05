'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DashboardPage() {
  const [status, setStatus] = useState('loading');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setStatus('error');
          return;
        }

        if (!session?.user) {
          window.location.replace('/login');
          return;
        }

        setEmail(session.user.email || '');
        setStatus('ready');
      } catch (err) {
        console.error('Dashboard session error:', err);
        if (mounted) setStatus('error');
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <main style={{
        minHeight: '100vh',
        background: '#0d0d14',
        color: '#a78bfa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif'
      }}>
        Loading dashboard test...
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={{
        minHeight: '100vh',
        background: '#0d0d14',
        color: '#f87171',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        padding: '24px',
        textAlign: 'center'
      }}>
        Dashboard test failed. Session could not be read.
      </main>
    );
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0d0d14',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '16px',
      fontFamily: 'sans-serif',
      padding: '24px',
      textAlign: 'center'
    }}>
      <h1>Dashboard test works</h1>
      <p>Logged in as: {email}</p>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.replace('/login');
        }}
        style={{
          padding: '12px 20px',
          border: 'none',
          borderRadius: '10px',
          background: '#a78bfa',
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        Sign out
      </button>
    </main>
  );
}