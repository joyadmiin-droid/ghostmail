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
  const [mailboxUsage, setMailboxUsage] = useState({});

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

        const mailboxList = mailboxes || [];
        setAddresses(mailboxList);

        const { count } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true });

        setEmailCount(count || 0);

        if (mailboxList.length > 0) {
          const mailboxIds = mailboxList.map(m => m.id);

          const { data: emailsData, error: usageError } = await supabase
            .from('emails')
            .select('id, mailbox_id')
            .in('mailbox_id', mailboxIds);

          if (!usageError && emailsData) {
            const usageMap = {};
            for (const mailbox of mailboxList) {
              usageMap[mailbox.id] = 0;
            }
            for (const email of emailsData) {
              if (email.mailbox_id) {
                usageMap[email.mailbox_id] = (usageMap[email.mailbox_id] || 0) + 1;
              }
            }
            setMailboxUsage(usageMap);
          } else {
            setMailboxUsage({});
          }
        } else {
          setMailboxUsage({});
        }

        setStatus('ready');
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
        setStatus('error');
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
      setMailboxUsage(prev => ({ ...prev, [data.id]: 0 }));
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

  function getMailboxStatus(addr) {
    const expired = new Date(addr.expires_at) <= new Date();
    if (expired) {
      return {
        label: 'Expired',
        color: '#f87171',
      };
    }

    const usedCount = mailboxUsage[addr.id] || 0;
    if (usedCount > 0) {
      return {
        label: 'Used',
        color: '#f59e0b',
      };
    }

    return {
      label: 'New',
      color: '#22c55e',
    };
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

        <div style={{ display: 'grid', gap: 16 }}>
          {addresses.map(addr => {
            const badge = getMailboxStatus(addr);

            return (
              <div key={addr.id} style={card}>
                <div style={addrText}>{addr.address}</div>

                <div style={meta}>
                  <span
                    style={{
                      ...statusBadge,
                      color: badge.color,
                      borderColor: badge.color + '55',
                      background:
                        badge.label === 'Expired'
                          ? 'rgba(248,113,113,0.08)'
                          : badge.label === 'Used'
                          ? 'rgba(245,158,11,0.08)'
                          : 'rgba(34,197,94,0.08)',
                    }}
                  >
                    ● {badge.label}
                  </span>

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
            );
          })}
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
  alignItems: 'center',
  marginTop: 10,
  color: '#aaa',
  gap: 12,
  flexWrap: 'wrap',
};

const statusBadge = {
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 13,
  fontWeight: 700,
};

const actions = {
  display: 'flex',
  gap: 10,
  marginTop: 14,
  flexWrap: 'wrap',
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
  textDecoration: 'none',
  cursor: 'pointer',
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
  flexDirection: 'column',
  gap: 12,
};