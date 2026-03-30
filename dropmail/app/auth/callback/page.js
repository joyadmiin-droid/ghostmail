'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthCallback() {
  useEffect(() => {
    // Supabase automatically processes the OAuth code/hash from the URL
    // We just need to wait for it to complete via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.href = '/dashboard';
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        window.location.href = '/login';
      }
    });

    // Also check if session already exists (page refresh case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard';
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#080010',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '16px', fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: '36px', height: '36px',
        border: '3px solid rgba(167,139,250,0.2)',
        borderTop: '3px solid #a78bfa',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ color: '#a78bfa', fontSize: '14px' }}>Signing you in...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
