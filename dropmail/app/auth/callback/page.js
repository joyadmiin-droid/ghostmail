'use client';

import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange the code in URL for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error('OAuth callback error:', error);
          window.location.href = '/login?error=oauth_failed';
          return;
        }

        if (data?.session) {
          window.location.href = '/dashboard';
        } else {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error('Callback error:', err);
        window.location.href = '/login';
      }
    };

    handleCallback();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080010',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: '36px', height: '36px',
        border: '3px solid rgba(167,139,250,0.2)',
        borderTop: '3px solid #a78bfa',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ color: '#a78bfa', fontSize: '14px' }}>
        Signing you in...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
