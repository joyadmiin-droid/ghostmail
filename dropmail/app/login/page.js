'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#080010',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Logo */}
      <a href="/" style={{ textDecoration: 'none', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#a78bfa', fontSize: '20px' }}>✦</span>
        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>GhostMail</span>
      </a>

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 1,
      }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>
          {isSignup ? 'Create account' : 'Welcome back'}
        </h1>
        <p style={{ color: '#6b6b7a', fontSize: '14px', textAlign: 'center', marginBottom: '32px' }}>
          {isSignup ? 'Join GhostMail today' : 'Sign in to your account'}
        </p>

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b6b7a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
              color: '#f5f3ee', fontSize: '15px', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b6b7a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
              color: '#f5f3ee', fontSize: '15px', fontFamily: 'inherit',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error / Success */}
        {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}
        {message && <p style={{ color: '#22c55e', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{message}</p>}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px',
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            color: '#fff', border: 'none', borderRadius: '14px',
            fontSize: '16px', fontWeight: '700', cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: '20px',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : isSignup ? 'Create account' : 'Sign in'}
        </button>

        {/* Toggle */}
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#6b6b7a' }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignup(!isSignup); setError(''); setMessage(''); }}
            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </main>
  );
}