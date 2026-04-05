'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FAVORITES_KEY = 'ghostmail_favorite_inboxes';

export default function DashboardPage() {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [plan, setPlan] = useState('free');
  const [addresses, setAddresses] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [error, setError] = useState('');
  const [emailCount, setEmailCount] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [mailboxUsage, setMailboxUsage] = useState({});
  const [favorites, setFavorites] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [toast, setToast] = useState(null);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        setFavorites(JSON.parse(raw));
      }
    } catch (err) {
      console.error('Failed to load favorites:', err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (err) {
      console.error('Failed to save favorites:', err);
    }
  }, [favorites]);

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
          const mailboxIds = mailboxList.map((m) => m.id);

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

    if (plan === 'free' && addresses.length >= 1) {
      setShowUpgrade(true);
      setLoadingCreate(false);
      return;
    }

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

      setAddresses((prev) => [data, ...prev]);
      setMailboxUsage((prev) => ({ ...prev, [data.id]: 0 }));
      showToast('New inbox created');
    } catch (err) {
      setError(err.message || 'Failed to generate mailbox');
    } finally {
      setLoadingCreate(false);
    }
  }

  function openDeleteModal(inbox) {
    setSelectedInbox(inbox);
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deleting) return;
    setDeleteModalOpen(false);
    setSelectedInbox(null);
  }

  async function handleDeleteMailbox() {
    if (!selectedInbox) return;

    try {
      setDeleting(true);

      const { error } = await supabase
        .from('mailboxes')
        .update({ is_active: false })
        .eq('id', selectedInbox.id);

      if (error) throw error;

      setAddresses((prev) => prev.filter((a) => a.id !== selectedInbox.id));

      setMailboxUsage((prev) => {
        const copy = { ...prev };
        delete copy[selectedInbox.id];
        return copy;
      });

      setFavorites((prev) => {
        const copy = { ...prev };
        delete copy[selectedInbox.id];
        return copy;
      });

      setDeleteModalOpen(false);
      setSelectedInbox(null);
      showToast('Inbox deleted');
    } catch (err) {
      alert(err.message || 'Failed to delete inbox');
    } finally {
      setDeleting(false);
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
    showToast('Address copied');
  }

  function toggleFavorite(id) {
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function isFavorite(id) {
    return !!favorites[id];
  }

  function getPlanDisplayName(value) {
    return (value || 'free').toUpperCase();
  }

  const sortedAddresses = useMemo(() => {
    return [...addresses].sort((a, b) => {
      const aFav = isFavorite(a.id) ? 1 : 0;
      const bFav = isFavorite(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [addresses, favorites]);

  const filteredAddresses = useMemo(() => {
    return sortedAddresses.filter((addr) => {
      const badge = getMailboxStatus(addr);
      const fav = isFavorite(addr.id);

      if (activeFilter === 'all') return true;
      if (activeFilter === 'favorites') return fav;
      if (activeFilter === 'new') return badge.label === 'New';
      if (activeFilter === 'used') return badge.label === 'Used';
      if (activeFilter === 'expired') return badge.label === 'Expired';
      return true;
    });
  }, [sortedAddresses, activeFilter, mailboxUsage, favorites]);

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'favorites', label: 'Favorites' },
    { key: 'new', label: 'New' },
    { key: 'used', label: 'Used' },
    { key: 'expired', label: 'Expired' },
  ];

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

        .dashboard-email-card {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .dashboard-email-card:hover {
          transform: translateY(-4px);
          border-color: rgba(167,139,250,0.35) !important;
          box-shadow: 0 0 28px rgba(167,139,250,0.10), 0 18px 44px rgba(0,0,0,0.20) !important;
        }

        .dashboard-filter-btn {
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .dashboard-filter-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(167,139,250,0.34) !important;
        }

        .dashboard-fav-btn {
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }

        .dashboard-fav-btn:hover {
          transform: scale(1.05);
        }

        .dashboard-delete-secondary:hover {
          background: rgba(255,255,255,0.08) !important;
        }

          .dashboard-delete-danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(220,38,38,0.28);
  filter: brightness(1.05);
}
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

        {addresses.length > 0 && (
          <div style={filtersWrap}>
            <div style={filtersRow}>
              {filterOptions.map((filter) => {
                const active = activeFilter === filter.key;

                return (
                  <button
                    key={filter.key}
                    type="button"
                    className="dashboard-filter-btn"
                    onClick={() => setActiveFilter(filter.key)}
                    style={{
                      ...filterBtn,
                      background: active
                        ? 'rgba(167,139,250,0.16)'
                        : 'rgba(255,255,255,0.03)',
                      color: active ? '#f3edff' : '#cfc8e7',
                      borderColor: active
                        ? 'rgba(167,139,250,0.36)'
                        : 'rgba(255,255,255,0.08)',
                      boxShadow: active
                        ? '0 0 20px rgba(167,139,250,0.10)'
                        : 'none',
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div style={filterCountText}>
              Showing {filteredAddresses.length} of {addresses.length} inboxes
            </div>
          </div>
        )}

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
        ) : filteredAddresses.length === 0 ? (
          <div style={emptyCard}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>🗂️</div>
            <h3 style={{ margin: '0 0 8px', color: '#fff' }}>No inboxes in this filter</h3>
            <p style={{ margin: 0, color: '#9f9ab2', lineHeight: 1.6 }}>
              Try another filter or create a new address.
            </p>
          </div>
        ) : (
          <div style={gridWrap}>
            {filteredAddresses.map((addr) => {
              const badge = getMailboxStatus(addr);
              const usageCount = mailboxUsage[addr.id] || 0;
              const favorite = isFavorite(addr.id);

              return (
                <div
                  key={addr.id}
                  style={{
                    ...emailCard,
                    borderColor: favorite
                      ? 'rgba(250,204,21,0.26)'
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: favorite
                      ? '0 14px 40px rgba(0,0,0,0.16), 0 0 28px rgba(250,204,21,0.08)'
                      : '0 14px 40px rgba(0,0,0,0.16)',
                  }}
                  className="dashboard-email-card"
                >
                  <div style={cardTop}>
                    <div style={cardTopRow}>
                      <div style={cardAddressWrap}>
                        <div style={addrText}>{addr.address}</div>
                      </div>

                      <button
                        type="button"
                        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                        className="dashboard-fav-btn"
                        onClick={() => toggleFavorite(addr.id)}
                        style={{
                          ...favoriteBtn,
                          color: favorite ? '#facc15' : '#8f89a5',
                          borderColor: favorite
                            ? 'rgba(250,204,21,0.30)'
                            : 'rgba(255,255,255,0.08)',
                          background: favorite
                            ? 'rgba(250,204,21,0.10)'
                            : 'rgba(255,255,255,0.03)',
                        }}
                      >
                        {favorite ? '★' : '☆'}
                      </button>
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

                    <button
                      style={{
                        ...secondaryBtn,
                        border: '1px solid rgba(248,113,113,0.4)',
                        color: '#f87171',
                      }}
                      onClick={() => openDeleteModal(addr)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <p style={{ color: '#f87171', marginTop: 18 }}>{error}</p>}
      </div>

      {showUpgrade && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalBadge}>Free plan limit reached</div>

            <h2 style={modalTitle}>Upgrade to create more inboxes</h2>

            <p style={modalText}>
              Your free plan includes <strong>1 active inbox</strong>.
              Upgrade to unlock more inboxes, longer lifetimes, and smoother testing workflows.
            </p>

            <div style={modalPlans}>
              <button style={modalPrimaryBtn} onClick={() => alert('Paddle later')}>
                Get Phantom — $4.99/mo
              </button>

              <button style={modalSecondaryBtn} onClick={() => alert('Paddle later')}>
                Get Spectre — $8.99/mo
              </button>
            </div>

            <button style={modalCloseBtn} onClick={() => setShowUpgrade(false)}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div style={deleteOverlay} onClick={closeDeleteModal}>
          <div style={deleteBox} onClick={(e) => e.stopPropagation()}>
            <div style={deleteIconWrap}>🗑️</div>

            <h2 style={deleteTitle}>Delete inbox?</h2>

            <p style={deleteText}>
              This will permanently remove this inbox from your dashboard. This action cannot be undone.
            </p>

            <div style={deleteEmailBox}>
              {selectedInbox?.address}
            </div>

            <div style={deleteActions}>
              <button
                type="button"
                className="dashboard-delete-secondary"
                style={deleteCancelBtn}
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="dashboard-delete-danger"
                style={deleteConfirmBtn}
                onClick={handleDeleteMailbox}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete inbox'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={toastStyle}>{toast}</div>}
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
  marginBottom: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
  boxShadow: '0 0 40px rgba(167,139,250,0.15), 0 12px 40px rgba(0,0,0,0.14)',
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

const filtersWrap = {
  marginBottom: 22,
};

const filtersRow = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const filterBtn = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
  color: '#cfc8e7',
  fontWeight: 700,
  cursor: 'pointer',
};

const filterCountText = {
  marginTop: 10,
  color: '#938baa',
  fontSize: 13,
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
  minHeight: 220,
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

const cardTopRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
};

const cardAddressWrap = {
  minWidth: 0,
  flex: 1,
};

const addrText = {
  fontFamily: 'monospace',
  color: '#a78bfa',
  fontSize: 16,
  lineHeight: 1.6,
  wordBreak: 'break-all',
};

const favoriteBtn = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
  fontSize: 18,
  cursor: 'pointer',
  flexShrink: 0,
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

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.72)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
  padding: '20px',
};

const modalBox = {
  background: 'linear-gradient(180deg, rgba(20,10,34,0.98), rgba(10,4,20,0.98))',
  border: '1px solid rgba(167,139,250,0.22)',
  borderRadius: 24,
  padding: 32,
  maxWidth: 500,
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 40px rgba(167,139,250,0.10)',
};

const modalBadge = {
  display: 'inline-block',
  marginBottom: 16,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(167,139,250,0.25)',
  background: 'rgba(167,139,250,0.10)',
  color: '#d9cfff',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const modalTitle = {
  margin: '0 0 14px',
  fontSize: '2rem',
  lineHeight: 1.1,
  color: '#fff',
};

const modalText = {
  color: '#b3acc8',
  lineHeight: 1.7,
  fontSize: 15,
  margin: '0 0 24px',
};

const modalPlans = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const modalPrimaryBtn = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
  color: '#fff',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
};

const modalSecondaryBtn = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(167,139,250,0.30)',
  background: 'rgba(255,255,255,0.03)',
  color: '#e9ddff',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
};

const modalCloseBtn = {
  marginTop: 18,
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'transparent',
  color: '#bdb6d3',
  cursor: 'pointer',
  fontWeight: 700,
};

const deleteOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(3, 1, 10, 0.76)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
  zIndex: 1200,
};

const deleteBox = {
  width: '100%',
  maxWidth: 460,
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.08)',
  background:
    'linear-gradient(180deg, rgba(20,10,35,0.96) 0%, rgba(10,5,20,0.98) 100%)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
  padding: 28,
  color: '#fff',
};

const deleteIconWrap = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.22)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 24,
  marginBottom: 18,
};

const deleteTitle = {
  fontSize: 28,
  fontWeight: 800,
  margin: 0,
  marginBottom: 10,
  letterSpacing: '-0.02em',
};

const deleteText = {
  color: 'rgba(255,255,255,0.72)',
  fontSize: 15,
  lineHeight: 1.6,
  marginBottom: 18,
};

const deleteEmailBox = {
  padding: '14px 16px',
  borderRadius: 16,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#c4b5fd',
  fontSize: 14,
  wordBreak: 'break-word',
  marginBottom: 24,
};

const deleteActions = {
  display: 'flex',
  gap: 12,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};

const deleteCancelBtn = {
  padding: '12px 18px',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const deleteConfirmBtn = {
  padding: '12px 18px',
  transition: 'all 0.2s ease',
  borderRadius: 14,
  border: '1px solid rgba(239,68,68,0.28)',
  background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
  minWidth: 140,
};

const toastStyle = {
  position: 'fixed',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(15,10,30,0.95)',
  border: '1px solid rgba(167,139,250,0.3)',
  color: '#fff',
  padding: '12px 18px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 700,
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
  zIndex: 9999,
};