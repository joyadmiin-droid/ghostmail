'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('addresses');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        window.location.href = '/login';
        return;
      }
      setUser(session.user);
      setLoading(false);
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff' }}>
      Loading...
    </div>
  );

  const username = user?.email?.split('@')[0];

  const tabStyle = (tab) => ({
    padding: '8px 18px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    color: activeTab === tab ? '#fff' : '#888',
    borderBottom: activeTab === tab ? '2px solid #a78bfa' : '2px solid transparent',
    fontFamily: 'inherit',
    fontWeight: activeTab === tab ? '600' : '400',
    marginBottom: '-1px',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'inherit' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#fff', fontSize: '18px', fontWeight: '700' }}>
          ✦ GhostMail
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/dashboard" style={{ fontSize: '13px', color: '#a78bfa', textDecoration: 'none' }}>
  👻 {username}
</a>
          <button onClick={handleSignOut} style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>👋 Welcome back, {username}</h1>
          <p style={{ fontSize: '14px', color: '#888' }}>{user?.email} · Ghost plan (Free)</p>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', display: 'flex', gap: '4px' }}>
          {['addresses', 'inbox', 'plan', 'settings'].map(tab => (
            <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ADDRESSES TAB */}
        {activeTab === 'addresses' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Active addresses', value: '0' },
                { label: 'Emails received', value: '0' },
                { label: 'Plan limit', value: '1 max' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '700' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
              No active addresses. Go to the <a href="/" style={{ color: '#a78bfa' }}>homepage</a> to generate one!
            </p>
          </div>
        )}

        {/* INBOX TAB */}
        {activeTab === 'inbox' && (
          <div>
            <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
              No emails yet. Generate an address and use it somewhere to receive emails!
            </p>
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Current */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current plan</div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>👻 Ghost</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>Free forever</div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>✓ 1 address at a time</li>
                <li>✓ 10 minute lifespan</li>
                <li>✓ Up to 10 emails</li>
              </ul>
            </div>
            {/* Phantom */}
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '2px solid rgba(167,139,250,0.4)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '11px', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '99px', display: 'inline-block', marginBottom: '8px' }}>Most popular</div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>⚡ Phantom</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>$4.99 / month</div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <li>✓ 5 addresses at a time</li>
                <li>✓ 24 hour lifespan</li>
                <li>✓ Up to 100 emails</li>
                <li>✓ Priority delivery</li>
              </ul>
              <button onClick={() => window.location.href = '/#pricing'} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Upgrade to Phantom ⚡
              </button>
            </div>
            {/* Spectre */}
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>🔥 Spectre</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>$8.99 / month</div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <li>✓ Unlimited addresses</li>
                <li>✓ Emails saved forever</li>
                <li>✓ Unlimited emails</li>
                <li>✓ Priority support</li>
              </ul>
              <button onClick={() => window.location.href = '/#pricing'} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Upgrade to Spectre 🔥
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              {[
                { label: 'Email', value: user?.email },
                { label: 'Username', value: username },
                { label: 'Password', value: '••••••••' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{row.label}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{row.value}</div>
                  </div>
                  <button style={{ fontSize: '13px', padding: '5px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'none', color: '#aaa', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#f87171' }}>Delete account</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Permanently remove your account</div>
                </div>
                <button onClick={handleDeleteAccount} style={{ fontSize: '13px', padding: '5px 14px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}