'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DashboardPage() {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [plan, setPlan] = useState('free');
  const [addresses, setAddresses] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [error, setError] = useState('');
  const [emailCount, setEmailCount] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError || !session?.user) {
          window.location.replace('/login');
          return;
        }

        setUser(session.user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profile?.plan) {
          setPlan(profile.plan);
        }

        const { data: mailboxes, error: mailboxError } = await supabase
          .from('mailboxes')
          .select('id, address, token, expires_at, created_at')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!mounted) return;

        if (mailboxError) {
          throw mailboxError;
        }

        setAddresses(mailboxes || []);

        const { count, error: emailCountError } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true });

        if (!mounted) return;

        if (emailCountError) {
          console.error('Email count error:', emailCountError);
          setEmailCount(0);
        } else {
          setEmailCount(count || 0);
        }

        setStatus('ready');
      } catch (err) {
        console.error('Dashboard load error:', err);
        if (mounted) {
          setError(err.message || 'Failed to load dashboard');
          setStatus('error');
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.replace('/');
  }

  async function generateMailbox() {
    setLoadingCreate(true);
    setError('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = 'Bearer ' + session.access_token;
      }

      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate address');
      }

      setAddresses(prev => [data, ...prev]);
    } catch (err) {
      console.error('Generate dashboard mailbox error:', err);
      setError(err.message || 'Failed to generate address');
    } finally {
      setLoadingCreate(false);
    }
  }

  function getExpiryLabel(expiresAt) {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const mins = Math.round(diff / 60000);
    if (mins > 60 * 24) return Math.round(mins / 60 / 24) + 'd left';
    if (mins > 60) return Math.round(mins / 60) + 'h left';
    return mins + 'm left';
  }

  async function copyAddress(addr) {
    await navigator.clipboard.writeText(addr);
  }

  if (status === 'loading') {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#0d0d14',
          color: '#a78bfa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        Loading dashboard...
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#0d0d14',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
          fontFamily: 'sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h2>Dashboard failed to load</h2>
        <p style={{ color: '#f87171' }}>{error}</p>
        <a href="/login" style={{ color: '#a78bfa' }}>
          Back to login
        </a>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d0d14',
        color: '#fff',
        fontFamily: 'sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Dashboard</h1>
            <p style={{ margin: '8px 0 0', color: '#aaa' }}>{user?.email}</p>
            <p style={{ margin: '6px 0 0', color: '#a78bfa' }}>Plan: {plan}</p>
            <p style={{ margin: '6px 0 0', color: '#22c55e' }}>
              Emails received: {emailCount ?? '...'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={generateMailbox}
              disabled={loadingCreate}
              style={{
                padding: '12px 18px',
                border: 'none',
                borderRadius: '10px',
                background: '#a78bfa',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {loadingCreate ? 'Generating...' : 'Generate address'}
            </button>

            <button
              onClick={handleSignOut}
              style={{
                padding: '12px 18px',
                border: '1px solid rgba(248,113,113,0.4)',
                borderRadius: '10px',
                background: 'transparent',
                color: '#f87171',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <p style={{ color: '#f87171', marginBottom: '16px' }}>{error}</p>
        )}

        <div
          style={{
            display: 'grid',
            gap: '12px',
          }}
        >
          {addresses.length === 0 ? (
            <div
              style={{
                padding: '20px',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              No addresses yet.
            </div>
          ) : (
            addresses.map(addr => (
              <div
                key={addr.id}
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  style={{
                    color: '#a78bfa',
                    wordBreak: 'break-all',
                    fontFamily: 'monospace',
                  }}
                >
                  {addr.address}
                </div>

                <div style={{ color: '#aaa', marginTop: '8px', fontSize: '14px' }}>
                  {getExpiryLabel(addr.expires_at)}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={() => copyAddress(addr.address)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(167,139,250,0.4)',
                      background: 'transparent',
                      color: '#a78bfa',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>

                  <a
                    href={'/inbox?token=' + addr.token}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      textDecoration: 'none',
                    }}
                  >
                    Open inbox
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}