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

      if (!res.ok) throw new Error(data.error || 'Failed to generate mailbox');

      setAddresses(prev => [data, ...prev]);
      setMailboxUsage(prev => ({ ...prev, [data.id]: 0 }));
    } catch (err) {
      setError(err.message || 'Failed to generate mailbox');
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
        bg: 'rgba(248,113,113,0.10)',
        border: 'rgba(248,113,113,0.28)',
      };
    }

    const usedCount = mailboxUsage[addr.id] || 0;

    if (usedCount > 0) {
      return {
        label: 'Used',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.10)',
        border: 'rgba(245,158,11,0.28)',
      };
    }

    return {
      label: 'New',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.10)',
      border: 'rgba(34,197,94,0.28)',
    };
  }

  async function copyAddress(addr, id) {
    await navigator.clipboard.writeText(addr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function getPlanDisplayName(value) {
    return (value || 'free').toUpperCase();
  }

  if (status === 'loading') {
    return (
      <main style={centerStyle}>
        <div style={loadingSpinner} />
        <p style={{ color: '#b6b0c8' }}>Loading dashboard...</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={centerStyle}>
        <h2 style={{ margin: 0 }}>Error loading dashboard</h2>
        <p style={{ color: '#f87171', margin: 0 }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={container}>
        <div style={header}>
          <div style={{ minWidth: 0 }}>
            <h1 style={pageTitle}>Dashboard</h1>
            <p style={pageSubtitle}>{user?.email}</p>
          </div>

          <div style={headerActions}>
            <button style={primaryBtn} onClick={generateMailbox} disabled={loadingCreate}>
              {loadingCreate ? 'Generating...' : 'New Address'}
            </button>

            <button style={dangerBtn} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>

        <div style={planCard}>
          <div>
            <p style={planEyebrow}>Current plan</p>
            <h2 style={planName}>{getPlanDisplayName(plan)}</h2>
            <p style={planMeta}>Emails received: {emailCount ?? '...'}</p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {plan === 'free' && (
              <>
                <button style={upgradeBtn}>Upgrade to Phantom</button>
                <button style={upgradeBtnSecondary}>Upgrade to Spectre</button>
              </>
            )}

            {plan !== 'free' && <button style={manageBtn}>Manage billing</button>}
          </div>
        </div>

        {addresses.length === 0 ? (
          <div style={emptyCard}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
            <h3 style={{ margin: '0 0 8px', color: '#fff' }}>No addresses yet</h3>
            <p style={{ margin: '0 0 18px', color: '#9f9ab2', lineHeight: 1.6 }}>
              Generate your first address to start receiving emails.
            </p>
            <button style={primaryBtn} onClick={generateMailbox} disabled={loadingCreate}>
              {loadingCreate ? 'Generating...' : 'Create First Address'}
            </button>
          </div>
        ) : (
          <div style={gridWrap}>
            {addresses.map(addr => {
              const badge = getMailboxStatus(addr);
              const usageCount = mailboxUsage[addr.id] || 0;

              return (
                <div key={addr.id} style={emailCard}>
                  <div style={cardTop}>
                    <div style={cardAddressWrap}>
                      <div style={addrText}>{addr.address}</div>
                    </div>

                    <span
                      style={{
                        ...statusBadge,
                        color: badge.color,
                        borderColor: badge.border,
                        background: badge.bg,
                      }}
                    >
                      ● {badge.label}
                    </span>
                  </div>

                  <div style={cardStats}>
                    <div style={statBox}>
                      <span style={statLabel}>Status</span>
                      <span style={{ ...statValue, color: badge.color }}>{badge.label}</span>
                    </div>

                    <div style={statBox}>
                      <span style={statLabel}>Emails</span>
                      <span style={statValue}>{usageCount}</span>
                    </div>

                    <div style={statBox}>
                      <span style={statLabel}>Expires</span>
                      <span style={statValueMuted}>{getExpiryLabel(addr.expires_at)}</span>
                    </div>
                  </div>

                  <div style={actions}>
                    <button
                      style={secondaryBtn}
                      onClick={() => copyAddress(addr.address, addr.id)}
                    >
                      {copiedId === addr.id ? 'Copied' : 'Copy'}
                    </button>

                    <a href={`/inbox?token=${addr.token}`} style={secondaryBtn}>
                      Open inbox
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <p style={{ color: '#f87171', marginTop: 18 }}>{error}</p>}
      </div>
    </main>
  );
}

/* STYLES */

const pageStyle = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top, rgba(124,58,237,0.12), transparent 26%), #080010',
  color: '#fff',
  padding: '32px 20px 48px',
};

const container = {
  maxWidth: 1120,
  margin: '0 auto',
};

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 28,
  flexWrap: 'wrap',
  gap: 20,
};

const pageTitle = {
  margin: 0,
  fontSize: '3rem',
  lineHeight: 1,
};

const pageSubtitle = {
  color: '#8f89a5',
  margin: '10px 0 0',
  wordBreak: 'break-word',
};

const headerActions = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const planCard = {
  padding: 22,
  borderRadius: 18,
  background: 'rgba(167,139,250,0.08)',
  border: '1px solid rgba(167,139,250,0.22)',
  marginBottom: 26,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
  boxShadow: '0 12px 40px rgba(0,0,0,0.14)',
};

const planEyebrow = {
  margin: 0,
  color: '#9d96b2',
  fontSize: 14,
};

const planName = {
  margin: '6px 0',
  fontSize: '2rem',
};

const planMeta = {
  color: '#22c55e',
  margin: 0,
  fontWeight: 700,
};

const gridWrap = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: 18,
};

const emailCard = {
  padding: 18,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.08)',
  minHeight: 210,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 14px 40px rgba(0,0,0,0.16)',
};

const cardTop = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const cardAddressWrap = {
  minWidth: 0,
};

const addrText = {
  fontFamily: 'monospace',
  color: '#a78bfa',
  fontSize: 16,
  lineHeight: 1.6,
  wordBreak: 'break-all',
};

const cardStats = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 10,
  marginTop: 16,
  marginBottom: 16,
};

const statBox = {
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
};

const statLabel = {
  fontSize: 12,
  color: '#8f89a5',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700,
};

const statValue = {
  fontSize: 14,
  color: '#fff',
  fontWeight: 700,
};

const statValueMuted = {
  fontSize: 14,
  color: '#d4cfe2',
  fontWeight: 700,
};

const statusBadge = {
  width: 'fit-content',
  padding: '7px 12px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 13,
  fontWeight: 700,
};

const actions = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 'auto',
};

const primaryBtn = {
  padding: '12px 18px',
  borderRadius: 12,
  border: 'none',
  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};

const upgradeBtn = {
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#7c3aed',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};

const upgradeBtnSecondary = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid #7c3aed',
  background: 'transparent',
  color: '#a78bfa',
  cursor: 'pointer',
  fontWeight: 700,
};

const manageBtn = {
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'transparent',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: '#fff',
  textDecoration: 'none',
  cursor: 'pointer',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dangerBtn = {
  padding: '12px 18px',
  borderRadius: 12,
  border: '1px solid rgba(248,113,113,0.4)',
  background: 'transparent',
  color: '#f87171',
  cursor: 'pointer',
  fontWeight: 700,
};

const emptyCard = {
  padding: 32,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
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

const loadingSpinner = {
  width: 34,
  height: 34,
  border: '3px solid rgba(167,139,250,0.18)',
  borderTop: '3px solid #a78bfa',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};