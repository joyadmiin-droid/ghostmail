'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setReady(true);
    } else {
      setError('Invalid or expired reset link.');
    }
  }, []);

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage('Password updated successfully. You can now sign in.');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #06010d 0%, #0b0217 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 20px 80px rgba(0,0,0,0.45)',
        }}
      >
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 800,
            marginBottom: '10px',
          }}
        >
          Reset password
        </h1>

        <p
          style={{
            color: '#a1a1aa',
            marginBottom: '24px',
            fontSize: '14px',
          }}
        >
          Enter your new password below.
        </p>

        <form onSubmit={handleUpdatePassword}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(0,0,0,0.35)',
              color: '#fff',
              outline: 'none',
              marginBottom: '14px',
            }}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(0,0,0,0.35)',
              color: '#fff',
              outline: 'none',
              marginBottom: '16px',
            }}
          />

          <button
            type="submit"
            disabled={!ready || loading}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)',
              color: '#fff',
              fontWeight: 700,
              cursor: !ready || loading ? 'not-allowed' : 'pointer',
              opacity: !ready || loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>

        {error && (
          <p style={{ color: '#f87171', marginTop: '16px', fontSize: '14px' }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ color: '#4ade80', marginTop: '16px', fontSize: '14px' }}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}