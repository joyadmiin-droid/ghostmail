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
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          window.location.replace('/login');
          return;
        }

        setUser(session.user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.plan) setPlan(profile.plan);

        const { data: mailboxes } = await supabase
          .from('mailboxes')
          .select('id, address, token, expires_at, created_at')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        setAddresses(mailboxes || []);

        const { count } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true });

        setEmailCount(count || 0);

        setStatus('ready');
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
        setStatus('error');
      }
    }

    loadDashboard();
    return () => (mounted = false);
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

      const headers = {};
      if (session?.access_token) {
        headers.Authorization = 'Bearer ' + session.access_token;
      }

      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setAddresses(prev => [data, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingCreate(false);
    }
  }

  function getExpiryLabel(expiresAt) {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';

    const mins = Math.round(diff / 60000);
    if (mins > 1440) return Math.round(mins / 1440) + 'd left';
    if (mins > 60) return Math.round(mins / 60) + 'h left';
    return mins + 'm left';
  }

  async function copyAddress(addr, id) {
    await navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (status === 'loading') {
    return (
      <main style={centerStyle}>
        <p>Loading dashboard...</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={centerStyle}>
        <h2>Error loading dashboard</h2>
        <p style={{ color: '#f87171' }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={container}>

        {/* HEADER */}
        <div style={header}>
          <div>
            <h1 style={{ margin: 0 }}>Dashboard</h1>
            <p style={{ color: '#888' }}>{user?.email}</p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={primaryBtn} onClick={generateMailbox}>
              {loadingCreate ? 'Generating...' : 'New Address'}
            </button>

            <button style={dangerBtn} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>

        {/* PLAN CARD 🔥 */}
        <div style={planCard}>
          <div>
            <p style={{ margin: 0, color: '#888' }}>Current plan</p>
            <h2 style={{ margin: '4px 0' }}>{plan.toUpperCase()}</h2>
            <p style={{ color: '#22c55e' }}>
              Emails received: {emailCount ?? '...'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {plan === 'free' && (
              <>
                <button style={upgradeBtn}>
                  Upgrade to Phantom
                </button>
                <button style={upgradeBtnSecondary}>
                  Upgrade to Spectre
                </button>
              </>
            )}

            {plan !== 'free' && (
              <button style={manageBtn}>
                Manage billing
              </button>
            )}
          </div>
        </div>

        {/* LIST */}
        <div style={{ display: 'grid', gap: 16 }}>
          {addresses.map(addr => (
            <div key={addr.id} style={card}>
              <div style={addrText}>{addr.address}</div>

              <div style={meta}>
                <span style={{ color: '#22c55e' }}>● Active</span>
                <span>{getExpiryLabel(addr.expires_at)}</span>
              </div>

              <div style={actions}>
                <button
                  style={secondaryBtn}
                  onClick={() => copyAddress(addr.address, addr.id)}
                >
                  {copiedId === addr.id ? 'Copied' : 'Copy'}
                </button>

                <a
                  href={`/inbox?token=${addr.token}`}
                  style={secondaryBtn}
                >
                  Open inbox
                </a>
              </div>
            </div>
          ))}
        </div>

        {error && <p style={{ color: '#f87171' }}>{error}</p>}
      </div>
    </main>
  );
}

/* STYLES */

const pageStyle = {
  minHeight: '100vh',
  background: '#080010',
  color: '#fff',
  padding: '32px 20px',
};

const container = {
  maxWidth: 900,
  margin: '0 auto',
};

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 30,
  flexWrap: 'wrap',
  gap: 20,
};

const planCard = {
  padding: 20,
  borderRadius: 16,
  background: 'rgba(167,139,250,0.08)',
  border: '1px solid rgba(167,139,250,0.25)',
  marginBottom: 24,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
};

const card = {
  padding: 20,
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const addrText = {
  fontFamily: 'monospace',
  color: '#a78bfa',
};

const meta = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 10,
  color: '#aaa',
};

const actions = {
  display: 'flex',
  gap: 10,
  marginTop: 14,
};

const primaryBtn = {
  padding: '12px 18px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
  color: '#fff',
  cursor: 'pointer',
};

const upgradeBtn = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#7c3aed',
  color: '#fff',
  cursor: 'pointer',
};

const upgradeBtnSecondary = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid #7c3aed',
  background: 'transparent',
  color: '#a78bfa',
  cursor: 'pointer',
};

const manageBtn = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent',
  color: '#fff',
};

const secondaryBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: '#fff',
};

const dangerBtn = {
  padding: '12px 18px',
  borderRadius: 12,
  border: '1px solid rgba(248,113,113,0.4)',
  background: 'transparent',
  color: '#f87171',
  cursor: 'pointer',
};

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#080010',
  color: '#fff',
};