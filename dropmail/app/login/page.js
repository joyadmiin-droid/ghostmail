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
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    color: '#f5f3ee',
    fontSize: '15px',
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#080010',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <h1 style={{ color: '#fff', textAlign: 'center' }}>
          {isReset ? 'Reset password' : isSignup ? 'Create account' : 'Welcome back'}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />

        {!isReset && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle, marginTop: '10px' }}
          />
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}

        <button onClick={handleSubmit} style={{
          width: '100%',
          marginTop: '15px',
          padding: '12px',
          background: '#7c3aed',
          color: '#fff',
          border: 'none',
          borderRadius: '10px'
        }}>
          {isReset ? 'Send reset link' : isSignup ? 'Sign up' : 'Sign in'}
        </button>

        <div style={{ marginTop: '15px', textAlign: 'center' }}>
          {!isReset && (
            <button onClick={() => setIsReset(true)}>Forgot password?</button>
          )}
          <br />
          <button onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? 'Sign in' : 'Create account'}
          </button>
        </div>
      </div>
    </main>
  );
}