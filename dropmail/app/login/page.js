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
  const [isReset, setIsReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { 
      redirectTo: 'https://www.ghostmails.org/auth/callback',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      } 
    }
  });
}

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://www.ghostmails.org/dashboard',
        });
        if (error) throw error;
        setMessage('Password reset email sent! Check your inbox.');
      } else if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
    color: '#f5f3ee', fontSize: '15px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <main style={{
      minHeight: '100vh', background: '#080010',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', padding: '24px', position: 'relative',
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <a href="/" style={{ textDecoration: 'none', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#a78bfa', fontSize: '20px' }}>&#10022;</span>
        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>GhostMail</span>
      </a>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '420px',
        backdropFilter: 'blur(20px)', position: 'relative', zIndex: 1,
      }}>
        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '8px', textAlign: 'center' }}>
          {isReset ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back'}
        </h1>
        <p style={{ color: '#6b6b7a', fontSize: '14px', textAlign: 'center', marginBottom: '32px' }}>
          {isReset ? 'Enter your email to get a reset link' : isSignup ? 'Join GhostMail today' : 'Sign in to your account'}
        </p>

        {/* Google Button — only show when not in reset mode */}
        {!isReset && (
          <>
            <button onClick={handleGoogle} style={{
              width: '100%', padding: '14px', background: '#fff', color: '#1a1a1a',
              border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              marginBottom: '20px',
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.8-7.2l-6.6 5.1C9.5 39.6 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.7 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Continue with Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: '#4a4a5a', fontSize: '12px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>
          </>
        )}

        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b6b7a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>
            Email
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
        </div>

        {/* Password — hide in reset mode */}
        {!isReset && (
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b6b7a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>
              Password
            </label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
            />
          </div>
        )}

        {/* Forgot password link */}
        {!isSignup && !isReset && (
          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <button onClick={() => { setIsReset(true); setError(''); setMessage(''); }}
              style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '12px', padding: '4px 0' }}>
              Forgot password?
            </button>
          </div>
        )}

        {!isReset && <div style={{ marginBottom: '24px' }} />}

        {error && <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}
        {message && <p style={{ color: '#22c55e', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{message}</p>}

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: '16px',
          background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
          color: '#fff', border: 'none', borderRadius: '14px',
          fontSize: '16px', fontWeight: '700', cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: '20px', opacity: loading ? 0.7 : 1,
        }}>
          {loading ? '...' : isReset ? 'Send reset link' : isSignup ? 'Create account' : 'Sign in'}
        </button>

        {isReset ? (
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6b6b7a' }}>
            <button onClick={() => { setIsReset(false); setError(''); setMessage(''); }}
              style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              Back to sign in
            </button>
          </p>
        ) : (
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#6b6b7a' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignup(!isSignup); setError(''); setMessage(''); }}
              style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        )}

        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '12px', color: '#444' }}>
          <a href="/terms" style={{ color: '#555', textDecoration: 'none', margin: '0 8px' }}>Terms</a>
          <a href="/privacy" style={{ color: '#555', textDecoration: 'none', margin: '0 8px' }}>Privacy</a>
          <a href="mailto:support@ghostmails.org" style={{ color: '#555', textDecoration: 'none', margin: '0 8px' }}>Contact</a>
        </div>
      </div>
    </main>
  );
}
