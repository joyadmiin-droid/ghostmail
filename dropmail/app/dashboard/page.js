'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FAVORITES_KEY = 'ghostmail_favorite_inboxes';

const PLAN_CONFIG = {
  ghost: {
    label: 'GHOST',
    emailLimit: 5,
    inboxLimit: 1,
  },
  phantom: {
    label: 'PHANTOM',
    emailLimit: 200,
    inboxLimit: 5,
  },
  spectre: {
    label: 'SPECTRE',
    emailLimit: 600,
    inboxLimit: 50,
  },
};

function normalizePlan(value) {
  const v = String(value || 'ghost').toLowerCase();
  if (v === 'spectre') return 'spectre';
  if (v === 'phantom') return 'phantom';
  if (v === 'ghost' || v === 'free') return 'ghost';
  return 'ghost';
}

function getPlanDisplayName(value) {
  return PLAN_CONFIG[normalizePlan(value)]?.label || 'GHOST';
}

function getCurrentMonthStartIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default function DashboardPage() {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedInbox, setSelectedInbox] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState({
    title: '',
    text: '',
    targetPlan: 'phantom',
  });
  const [plan, setPlan] = useState('ghost');
  const [addresses, setAddresses] = useState([]);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [error, setError] = useState('');
  const [emailCount, setEmailCount] = useState(0);
  const [extraCredits, setExtraCredits] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [mailboxUsage, setMailboxUsage] = useState({});
  const [favorites, setFavorites] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');
  const [toast, setToast] = useState(null);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  function openUpgradeModal(targetPlan, title, text) {
    setUpgradeContext({
      targetPlan,
      title,
      text,
    });
    setShowUpgrade(true);
  }

  async function syncPlanFromServer() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return null;

      const res = await fetch('/api/sync-plan', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error('Plan sync failed:', data?.error || 'Unknown error');
        return null;
      }

      return data?.plan || null;
    } catch (err) {
      console.error('Plan sync request failed:', err);
      return null;
    }
  }

  async function handleManageBilling() {
    try {
      setLoadingBilling(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('/api/billing', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        alert(data?.error || 'Failed to open billing portal');
        return;
      }

      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Manage billing failed:', err);
      alert('Failed to open billing portal');
    } finally {
      setLoadingBilling(false);
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) setFavorites(JSON.parse(raw));
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

  const removeInactiveFromLocalState = useCallback((ids) => {
    if (!ids?.length) return;

    setAddresses((prev) => prev.filter((a) => !ids.includes(a.id)));

    setMailboxUsage((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });

    setFavorites((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }, []);

  const cleanupExpiredMailboxes = useCallback(
    async (userId) => {
      const nowIso = new Date().toISOString();

      const { data: expiredRows, error: findError } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .lte('expires_at', nowIso);

      if (findError) {
        console.error('Failed to find expired mailboxes:', findError);
        return;
      }

      if (!expiredRows || expiredRows.length === 0) return;

      const expiredIds = expiredRows.map((row) => row.id);

      const { error: deactivateError } = await supabase
        .from('mailboxes')
        .update({ is_active: false })
        .in('id', expiredIds);

      if (deactivateError) {
        console.error('Failed to deactivate expired mailboxes:', deactivateError);
        return;
      }

      removeInactiveFromLocalState(expiredIds);
    },
    [removeInactiveFromLocalState]
  );

  const loadDashboard = useCallback(async () => {
    try {
      setError('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        window.location.replace('/login');
        return;
      }

      setUser(session.user);

      const params = new URLSearchParams(window.location.search);
      const upgraded = params.get('upgraded');

      if (upgraded === '1') {
        const syncedPlan = await syncPlanFromServer();

        if (syncedPlan) {
          showToast(`Plan updated to ${getPlanDisplayName(syncedPlan)}`);
        }

        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('upgraded');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan, extra_email_credits')
        .eq('id', session.user.id)
        .maybeSingle();

      const nextPlan = normalizePlan(profile?.plan);
      setPlan(nextPlan);
      setExtraCredits(profile?.extra_email_credits || 0);

      await cleanupExpiredMailboxes(session.user.id);

      const { data: allMailboxes, error: allMailboxesError } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', session.user.id);

      if (allMailboxesError) throw allMailboxesError;

      const allMailboxIds = (allMailboxes || []).map((m) => m.id);

      const { data: mailboxes, error: mailboxError } = await supabase
        .from('mailboxes')
        .select('id, address, token, expires_at, created_at')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (mailboxError) throw mailboxError;

      const mailboxList = mailboxes || [];
      setAddresses(mailboxList);

      if (allMailboxIds.length > 0) {
        const monthStartIso = getCurrentMonthStartIso();

        const { count: userEmailCount, error: countError } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true })
          .in('mailbox_id', allMailboxIds)
          .gte('received_at', monthStartIso);

        if (countError) {
          console.error('Failed to count monthly user emails:', countError);
          setEmailCount(0);
        } else {
          setEmailCount(userEmailCount || 0);
        }
      } else {
        setEmailCount(0);
      }

      if (mailboxList.length > 0) {
        const mailboxIds = mailboxList.map((m) => m.id);

        const { data: emailsData, error: usageError } = await supabase
          .from('emails')
          .select('id, mailbox_id')
          .in('mailbox_id', mailboxIds);

        if (!usageError && emailsData) {
          const usageMap = {};
          for (const mailbox of mailboxList) usageMap[mailbox.id] = 0;
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
  }, [cleanupExpiredMailboxes]);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    if (status !== 'ready' || !addresses.length) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expiredIds = addresses
        .filter((addr) => new Date(addr.expires_at).getTime() <= now)
        .map((addr) => addr.id);

      if (expiredIds.length) {
        supabase
          .from('mailboxes')
          .update({ is_active: false })
          .in('id', expiredIds)
          .then(({ error: deactivateError }) => {
            if (deactivateError) {
              console.error('Live expiry cleanup failed:', deactivateError);
              return;
            }
            removeInactiveFromLocalState(expiredIds);
          });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [status, addresses, removeInactiveFromLocalState]);

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

      if (!session?.access_token) {
        throw new Error('You must be logged in to create an inbox');
      }

      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.access_token,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          data?.code === 'GHOST_PLAN_LIMIT' ||
          data?.code === 'FREE_PLAN_LIMIT'
        ) {
          openUpgradeModal(
            'phantom',
            'Ghost plan limit reached',
            'Your Ghost plan allows 1 active inbox and 5 monthly emails. Upgrade to Phantom to unlock up to 5 inboxes and 200 monthly emails.'
          );
        } else if (data?.code === 'PHANTOM_PLAN_LIMIT') {
          openUpgradeModal(
            'spectre',
            'Phantom plan limit reached',
            'Your Phantom plan allows up to 5 active inboxes and 200 monthly emails. Upgrade to Spectre to unlock up to 50 inboxes and 600 monthly emails.'
          );
        } else if (data?.code === 'SPECTRE_PLAN_LIMIT') {
          openUpgradeModal(
            'spectre',
            'Spectre plan limit reached',
            'Your Spectre plan currently allows up to 50 active inboxes. Delete expired inboxes or manage your usage.'
          );
        }

        throw new Error(data.error || 'Failed to generate mailbox');
      }

      setAddresses((prev) => [data, ...prev]);
      setMailboxUsage((prev) => ({ ...prev, [data.id]: 0 }));
      showToast('New inbox created');
      loadDashboard();
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

      const { error: deleteError } = await supabase
        .from('mailboxes')
        .update({ is_active: false })
        .eq('id', selectedInbox.id);

      if (deleteError) throw deleteError;

      removeInactiveFromLocalState([selectedInbox.id]);
      setDeleteModalOpen(false);
      setSelectedInbox(null);
      showToast('Inbox deleted');
      loadDashboard();
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

  function getProgress(expiresAt, createdAt) {
    const total = new Date(expiresAt) - new Date(createdAt);
    const left = new Date(expiresAt) - new Date();

    if (total <= 0) return 0;

    const percent = (left / total) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  function getMailboxStatus(addr) {
    const expired = new Date(addr.expires_at) <= new Date();

    if (expired) {
      return {
        label: 'Expired',
        color: '#ef4444',
        bg: 'rgba(239,68,68,0.10)',
        border: 'rgba(239,68,68,0.22)',
      };
    }

    const usedCount = mailboxUsage[addr.id] || 0;

    if (usedCount > 0) {
      return {
        label: 'Used',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.10)',
        border: 'rgba(245,158,11,0.24)',
      };
    }

    return {
      label: 'New',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.10)',
      border: 'rgba(34,197,94,0.24)',
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

  function formatCreatedDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const stats = useMemo(() => {
    let newCount = 0;
    let usedCount = 0;
    let expiredCount = 0;
    let favoriteCount = 0;

    for (const addr of addresses) {
      const badge = getMailboxStatus(addr);
      if (badge.label === 'New') newCount += 1;
      if (badge.label === 'Used') usedCount += 1;
      if (badge.label === 'Expired') expiredCount += 1;
      if (isFavorite(addr.id)) favoriteCount += 1;
    }

    return {
      total: addresses.length,
      newCount,
      usedCount,
      expiredCount,
      favoriteCount,
    };
  }, [addresses, mailboxUsage, favorites]);

  const currentPlanConfig = PLAN_CONFIG[plan] || PLAN_CONFIG.ghost;
  const planEmailLimit = currentPlanConfig.emailLimit;
  const planInboxLimit = currentPlanConfig.inboxLimit;
  const totalAvailableEmails = planEmailLimit + extraCredits;
  const emailsLeft = Math.max(totalAvailableEmails - emailCount, 0);
  const inboxesLeft = Math.max(planInboxLimit - stats.total, 0);

  const usagePercent =
    totalAvailableEmails > 0
      ? Math.min((emailCount / totalAvailableEmails) * 100, 100)
      : 0;

  const inboxUsagePercent =
    planInboxLimit > 0 ? Math.min((stats.total / planInboxLimit) * 100, 100) : 0;

  const isNearEmailLimit = usagePercent >= 80;
  const hasHitEmailLimit = emailCount >= totalAvailableEmails;
  const hasHitInboxLimit = stats.total >= planInboxLimit;

  const emailsLeftColor =
    emailsLeft <= Math.max(totalAvailableEmails * 0.2, 1)
      ? '#ef4444'
      : emailsLeft <= Math.max(totalAvailableEmails * 0.5, 1)
      ? '#f59e0b'
      : '#22c55e';

  const inboxLeftColor =
    inboxesLeft <= planInboxLimit * 0.2
      ? '#ef4444'
      : inboxesLeft <= planInboxLimit * 0.5
      ? '#f59e0b'
      : '#22c55e';

  function handleUpgradeFromWarning() {
    if (plan === 'ghost') {
      openUpgradeModal(
        'phantom',
        'Ghost plan almost full',
        'You are close to your Ghost plan limits. Upgrade to Phantom to unlock 5 inboxes and 200 monthly emails.'
      );
      return;
    }

    openUpgradeModal(
      'spectre',
      'Phantom plan almost full',
      'You are close to your Phantom plan limits. Upgrade to Spectre to unlock 50 inboxes and 600 monthly emails.'
    );
  }

  if (status === 'loading') {
    return (
      <main style={centerStyle}>
        <div style={loadingSpinner} />
        <p style={{ color: 'var(--muted)' }}>Loading dashboard...</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={centerStyle}>
        <h2 style={{ margin: 0, color: 'var(--text)' }}>Error loading dashboard</h2>
        <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }

        .dashboard-email-card {
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .dashboard-email-card:hover {
          transform: translateY(-4px);
          border-color: rgba(109,73,255,0.28) !important;
          box-shadow: 0 0 22px rgba(109,73,255,0.06), 0 18px 44px rgba(15,23,42,0.10) !important;
        }

        .dashboard-filter-btn {
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .dashboard-filter-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(109,73,255,0.30) !important;
        }

        .dashboard-fav-btn {
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
        }

        .dashboard-fav-btn:hover {
          transform: scale(1.05);
        }

        .dashboard-action-btn {
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
        }

        .dashboard-action-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(109,73,255,0.26) !important;
          background: rgba(109,73,255,0.04) !important;
        }

        .dashboard-delete-secondary:hover {
          background: var(--surface-soft, rgba(255,255,255,0.08)) !important;
        }

        .dashboard-delete-danger:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(220,38,38,0.18);
          filter: brightness(1.03);
        }

        @media (max-width: 1100px) {
          .dashboard-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .dashboard-summary-wide {
            grid-column: span 2 !important;
          }
        }

        @media (max-width: 720px) {
          .dashboard-summary-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-summary-wide {
            grid-column: span 1 !important;
          }

          .dashboard-actions-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-topbar {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .dashboard-page-title {
            font-size: 2.4rem !important;
          }

          .dashboard-top-actions {
            width: 100%;
          }

          .dashboard-top-actions > * {
            flex: 1;
          }
        }
      `}</style>

      <div style={container}>
        <div style={topbar} className="dashboard-topbar">
          <div style={{ minWidth: 0 }}>
            <div style={eyebrow}>GhostMail</div>
            <h1 style={pageTitle} className="dashboard-page-title">Dashboard</h1>
            <p style={pageSubtitle}>{user?.email}</p>
          </div>

          <div style={headerActions} className="dashboard-top-actions">

  {/* ✅ ADMIN ONLY ANALYTICS BUTTON */}
  {user?.email?.toLowerCase() === 'erkan.iseni20@gmail.com' && (
    <a
      href="/admin/analytics"
      style={{
        ...primaryBtn,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg,#111827,#6d49ff)',
      }}
    >
      Analytics
    </a>
  )}

  <button
    style={{
      ...primaryBtn,
      opacity: hasHitInboxLimit ? 0.7 : 1,
      cursor: hasHitInboxLimit ? 'not-allowed' : 'pointer',
    }}
    onClick={() => {
      if (hasHitInboxLimit) {
        if (plan === 'ghost') {
          openUpgradeModal(
            'phantom',
            'Inbox limit reached',
            'Your Ghost plan allows 1 active inbox. Upgrade to Phantom to unlock up to 5 active inboxes.'
          );
        } else if (plan === 'phantom') {
          openUpgradeModal(
            'spectre',
            'Inbox limit reached',
            'Your Phantom plan allows up to 5 active inboxes. Upgrade to Spectre to unlock up to 50 active inboxes.'
          );
        } else {
          showToast('You have reached your current inbox limit.');
        }
        return;
      }

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'generate_email_click',
          path: window.location.pathname,
          label: 'new_address_button',
          user_email: user?.email || null
        })
      }).catch(() => {});

      generateMailbox();
    }}
    disabled={loadingCreate}
  >
    {loadingCreate
      ? 'Generating...'
      : hasHitInboxLimit
      ? 'Inbox limit reached'
      : 'New Address'}
  </button>

  <button style={ghostBtn} onClick={handleSignOut}>
    Sign out
  </button>

</div>
        </div>

        {(isNearEmailLimit || hasHitInboxLimit) && (
          <div
            style={{
              ...warningCard,
              border:
                hasHitEmailLimit || hasHitInboxLimit
                  ? '1px solid rgba(239,68,68,0.18)'
                  : '1px solid rgba(245,158,11,0.20)',
              background:
                hasHitEmailLimit || hasHitInboxLimit
                  ? 'rgba(239,68,68,0.05)'
                  : 'rgba(245,158,11,0.07)',
            }}
          >
            <div style={warningWrap}>
              <div>
                <div
                  style={{
                    ...warningEyebrow,
                    color:
                      hasHitEmailLimit || hasHitInboxLimit ? '#dc2626' : '#b45309',
                  }}
                >
                  {hasHitEmailLimit || hasHitInboxLimit ? 'Limit reached' : 'Usage warning'}
                </div>

                <div style={warningTitle}>
                  {hasHitEmailLimit
                    ? `You have used all ${totalAvailableEmails} available emails in your ${getPlanDisplayName(plan)} account.`
                    : hasHitInboxLimit
                    ? `You have used all ${planInboxLimit} inbox slots in your ${getPlanDisplayName(plan)} plan.`
                    : `You have used ${emailCount} of ${totalAvailableEmails} available emails in your ${getPlanDisplayName(plan)} account.`}
                </div>

                <div style={warningText}>
                  {plan === 'ghost'
                    ? 'Upgrade to Phantom to unlock 5 inboxes and 200 monthly emails.'
                    : plan === 'phantom'
                    ? 'Upgrade to Spectre or buy extra emails to keep using GhostMail without waiting for next month.'
                    : 'Buy extra emails or manage current usage to stay within your account limits.'}
                </div>
              </div>

              <div style={warningActions}>
                {plan !== 'spectre' && (
                  <button style={upgradeBtn} onClick={handleUpgradeFromWarning}>
                    Upgrade now
                  </button>
                )}

                {hasHitEmailLimit && (
                  <a href="/checkout?plan=topup_100" style={topUpLink}>
                    Buy +100 emails
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div style={summaryGrid} className="dashboard-summary-grid">
          <div style={{ ...summaryCard, ...summaryCardWide }} className="dashboard-summary-wide">
            <div style={planCardHeader}>
              <div>
                <div style={planEyebrow}>Current plan</div>

                <div style={planNameRow}>
                  <h2 style={planName}>{getPlanDisplayName(plan)}</h2>
                  <span style={planBadge}>
                    {plan === 'ghost' ? 'Free Tier' : 'Premium'}
                  </span>
                </div>

                <p style={planMeta}>
                  {emailCount} / {planEmailLimit} emails used this month
                  {extraCredits > 0 ? ` + ${extraCredits} extra credits` : ''}
                </p>
              </div>

              <div style={planActionWrap}>
                {plan === 'ghost' ? (
                  <a href="/#pricing" style={upgradeBtn}>
                    Upgrade plan
                  </a>
                ) : plan === 'phantom' ? (
                  <>
                    <a href="/checkout?plan=spectre" style={upgradeBtn}>
                      Upgrade to Spectre
                    </a>
                    <button
                      type="button"
                      onClick={handleManageBilling}
                      style={{
                        ...manageBtn,
                        opacity: loadingBilling ? 0.7 : 1,
                        cursor: loadingBilling ? 'wait' : 'pointer',
                      }}
                      disabled={loadingBilling}
                    >
                      {loadingBilling ? 'Opening...' : 'Manage billing'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleManageBilling}
                    style={{
                      ...manageBtn,
                      opacity: loadingBilling ? 0.7 : 1,
                      cursor: loadingBilling ? 'wait' : 'pointer',
                    }}
                    disabled={loadingBilling}
                  >
                    {loadingBilling ? 'Opening...' : 'Manage billing'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Total inboxes</div>
            <div style={summaryValue}>{stats.total}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Favorites</div>
            <div style={summaryValue}>{stats.favoriteCount}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Used inboxes</div>
            <div style={summaryValue}>{stats.usedCount}</div>
          </div>

          <div style={{ ...summaryCard, ...usageCard }}>
            <div style={summaryLabel}>Emails left</div>

            <div style={{ ...summaryValue, color: emailsLeftColor }}>
              {emailsLeft} / {totalAvailableEmails}
            </div>

            <div style={usageCardSubtext}>
              {emailCount} used this month from your {getPlanDisplayName(plan)} plan
              {extraCredits > 0 ? ` with ${extraCredits} extra credits available` : ''}
            </div>

            <div style={usageTrack}>
              <div style={{ ...usageFill, width: `${usagePercent}%` }} />
            </div>
          </div>

          <div style={{ ...summaryCard, ...usageCard }}>
            <div style={summaryLabel}>Inboxes left</div>

            <div style={{ ...summaryValue, color: inboxLeftColor }}>
              {inboxesLeft} / {planInboxLimit}
            </div>

            <div style={usageCardSubtext}>
              {stats.total} active inboxes in your {getPlanDisplayName(plan)} plan
            </div>

            <div style={usageTrack}>
              <div style={{ ...usageFill, width: `${inboxUsagePercent}%` }} />
            </div>
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
                      background: active ? 'rgba(109,73,255,0.10)' : '#ffffff',
                      color: active ? '#1a1531' : '#5d647a',
                      borderColor: active ? 'rgba(109,73,255,0.24)' : 'rgba(15,23,42,0.08)',
                      boxShadow: active ? '0 10px 24px rgba(109,73,255,0.06)' : 'none',
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
            <h3 style={{ margin: '0 0 8px', color: '#1a1531' }}>
              No addresses yet
            </h3>
            <p style={{ margin: '0 0 18px', color: '#5d647a', lineHeight: 1.6 }}>
              Generate your first address to start receiving emails.
            </p>
            <button
  style={primaryBtn}
  onClick={() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  event: 'generate_email_click',
  path: window.location.pathname,
  label: 'new_address_button',
  user_email: user?.email || null
})
    }).catch(() => {});

    generateMailbox();
  }}
  disabled={loadingCreate}
>
              {loadingCreate ? 'Generating...' : 'Create First Address'}
            </button>
          </div>
        ) : filteredAddresses.length === 0 ? (
          <div style={emptyCard}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>🗂️</div>
            <h3 style={{ margin: '0 0 8px', color: '#1a1531' }}>
              No inboxes in this filter
            </h3>
            <p style={{ margin: 0, color: '#5d647a', lineHeight: 1.6 }}>
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
                    borderColor: favorite ? 'rgba(250,204,21,0.24)' : 'rgba(15,23,42,0.08)',
                    boxShadow: favorite
                      ? '0 16px 40px rgba(15,23,42,0.06), 0 0 24px rgba(250,204,21,0.05)'
                      : '0 14px 36px rgba(15,23,42,0.06)',
                  }}
                  className="dashboard-email-card"
                >
                  <div style={cardTop}>
                    <div style={cardTopRow}>
                      <div style={cardAddressWrap}>
                        <div style={addrText}>{addr.address}</div>
                        <div style={createdText}>Created {formatCreatedDate(addr.created_at)}</div>
                      </div>

                      <button
                        type="button"
                        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                        className="dashboard-fav-btn"
                        onClick={() => toggleFavorite(addr.id)}
                        style={{
                          ...favoriteBtn,
                          color: favorite ? '#f59e0b' : '#5d647a',
                          borderColor: favorite ? 'rgba(245,158,11,0.24)' : 'rgba(15,23,42,0.08)',
                          background: favorite ? 'rgba(245,158,11,0.10)' : 'rgba(15,23,42,0.025)',
                        }}
                      >
                        {favorite ? '★' : '☆'}
                      </button>
                    </div>

                    <div style={badgeRow}>
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

                      {favorite && <span style={favoriteMiniBadge}>Favorite</span>}
                    </div>
                  </div>

                  <div style={cardStats}>
                    <div style={statBox}>
                      <span style={statLabel}>Emails</span>
                      <span style={statValue}>{usageCount}</span>
                    </div>

                    <div style={statBoxColumn}>
                      <div style={statTopRow}>
                        <span style={statLabel}>Expires</span>
                        <span style={statValueMuted}>{getExpiryLabel(addr.expires_at)}</span>
                      </div>

                      <div style={progressTrack}>
                        <div
                          style={{
                            ...progressFill,
                            width: `${getProgress(addr.expires_at, addr.created_at)}%`,
                          }}
                        />
                      </div>

                      <div style={progressText}>Auto deletes when expired</div>
                    </div>
                  </div>

                  <div style={actions} className="dashboard-actions-grid">
                    <button
                      className="dashboard-action-btn"
                      style={secondaryBtn}
                      onClick={() => copyAddress(addr.address, addr.id)}
                    >
                      {copiedId === addr.id ? 'Copied' : 'Copy'}
                    </button>

                    <a
                      href={`/inbox?token=${addr.token}`}
                      className="dashboard-action-btn"
                      style={secondaryBtn}
                    >
                      Open inbox
                    </a>

                    <button
                      className="dashboard-action-btn"
                      style={deleteBtnInline}
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

        {error && <p style={{ color: '#ef4444', marginTop: 18 }}>{error}</p>}
      </div>

      {showUpgrade && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalBadge}>Upgrade recommended</div>
            <h2 style={modalTitle}>{upgradeContext.title}</h2>
            <p style={modalText}>{upgradeContext.text}</p>

            <div style={modalPlans}>
              {plan === 'ghost' && (
                <>
                  <a href="/checkout?plan=phantom" style={modalPrimaryLink}>
                    Upgrade to Phantom
                  </a>
                  <a href="/checkout?plan=spectre" style={modalGhostSecondaryLink}>
                    Upgrade to Spectre
                  </a>
                </>
              )}

              {plan === 'phantom' && (
                <>
                  <a href="/checkout?plan=spectre" style={modalPrimaryLink}>
                    Upgrade to Spectre
                  </a>
                  <a href="/checkout?plan=topup_100" style={modalGhostSecondaryLink}>
                    Buy +100 emails
                  </a>
                </>
              )}

              {plan === 'spectre' && hasHitEmailLimit && (
                <a href="/checkout?plan=topup_100" style={modalPrimaryLink}>
                  Buy +100 emails
                </a>
              )}

              <button style={modalSecondaryBtn} onClick={() => setShowUpgrade(false)}>
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div style={deleteOverlay} onClick={closeDeleteModal}>
          <div style={deleteBox} onClick={(e) => e.stopPropagation()}>
            <div style={deleteIconWrap}>🗑️</div>
            <div style={deleteEyebrow}>Delete inbox</div>
            <h2 style={deleteTitle}>Are you sure?</h2>

            <p style={deleteText}>
              This inbox will be removed from your dashboard. This action cannot be undone.
            </p>

            <div style={deleteEmailBox}>{selectedInbox?.address}</div>

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
    'linear-gradient(180deg, rgba(109,73,255,0.04) 0%, rgba(109,73,255,0.015) 20%, transparent 46%), #f6f4ff',
  color: '#1a1531',
  padding: '34px 20px 54px',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const container = {
  maxWidth: 1200,
  margin: '0 auto',
};

const topbar = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 24,
  flexWrap: 'wrap',
  gap: 18,
};

const eyebrow = {
  margin: 0,
  color: '#6d49ff',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 800,
};

const pageTitle = {
  margin: '8px 0 0',
  fontSize: '3.3rem',
  lineHeight: 0.98,
  letterSpacing: '-0.05em',
  color: '#14122b',
  fontWeight: 900,
};

const pageSubtitle = {
  color: '#5d647a',
  margin: '12px 0 0',
  wordBreak: 'break-word',
  fontSize: 16,
};

const headerActions = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
};

const warningCard = {
  marginBottom: 18,
  padding: '16px 18px',
  borderRadius: 20,
  boxShadow: '0 14px 34px rgba(15,23,42,0.05)',
};

const warningWrap = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
};

const warningEyebrow = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 8,
};

const warningTitle = {
  color: '#1a1531',
  fontSize: 16,
  fontWeight: 800,
  marginBottom: 6,
};

const warningText = {
  color: '#5d647a',
  fontSize: 14,
  lineHeight: 1.6,
};

const warningActions = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const summaryCard = {
  padding: 22,
  borderRadius: 24,
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(15,23,42,0.08)',
  boxShadow: '0 12px 30px rgba(15,23,42,0.05)',
  minHeight: 138,
};

const summaryCardWide = {
  gridColumn: 'span 4',
  background: 'linear-gradient(180deg, rgba(109,73,255,0.07), rgba(109,73,255,0.03))',
  border: '1px solid rgba(109,73,255,0.16)',
  boxShadow: '0 14px 34px rgba(109,73,255,0.05)',
};

const usageCard = {
  position: 'relative',
  overflow: 'hidden',
};

const planCardHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 16,
};

const summaryLabel = {
  color: '#5d647a',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const summaryValue = {
  marginTop: 12,
  fontSize: 32,
  fontWeight: 900,
  color: '#14122b',
  letterSpacing: '-0.04em',
};

const usageCardSubtext = {
  marginTop: 8,
  fontSize: 12,
  color: '#5d647a',
  lineHeight: 1.55,
};

const usageTrack = {
  marginTop: 14,
  height: 8,
  borderRadius: 999,
  background: 'rgba(15,23,42,0.08)',
  overflow: 'hidden',
};

const usageFill = {
  height: '100%',
  background: 'linear-gradient(90deg,#22c55e,#f59e0b,#ef4444)',
  transition: 'width 0.4s ease',
};

const planEyebrow = {
  margin: 0,
  color: '#5d647a',
  fontSize: 14,
};

const planNameRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 8,
};

const planName = {
  margin: 0,
  fontSize: '2.1rem',
  letterSpacing: '-0.04em',
  color: '#14122b',
  fontWeight: 900,
};

const planBadge = {
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  border: '1px solid rgba(109,73,255,0.18)',
  background: 'rgba(109,73,255,0.08)',
  color: '#1a1531',
};

const planMeta = {
  color: '#16a34a',
  margin: '10px 0 0',
  fontWeight: 700,
  fontSize: 15,
};

const planActionWrap = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
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
  padding: '11px 14px',
  borderRadius: 14,
  border: '1px solid rgba(15,23,42,0.08)',
  background: '#ffffff',
  color: '#5d647a',
  fontWeight: 700,
  cursor: 'pointer',
};

const filterCountText = {
  marginTop: 10,
  color: '#5d647a',
  fontSize: 13,
};

const gridWrap = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
  gap: 18,
};

const emailCard = {
  padding: 18,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(15,23,42,0.08)',
  minHeight: 250,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
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
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const addrText = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  color: '#14122b',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  background: 'rgba(15,23,42,0.02)',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 14,
  padding: '12px 14px',
};

const createdText = {
  marginTop: 6,
  color: '#5d647a',
  fontSize: 12,
};

const favoriteBtn = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: '1px solid rgba(15,23,42,0.08)',
  background: 'rgba(15,23,42,0.025)',
  fontSize: 18,
  cursor: 'pointer',
  flexShrink: 0,
};

const badgeRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const favoriteMiniBadge = {
  padding: '7px 10px',
  borderRadius: 999,
  border: '1px solid rgba(245,158,11,0.24)',
  background: 'rgba(245,158,11,0.10)',
  color: '#b45309',
  fontSize: 12,
  fontWeight: 700,
};

const cardStats = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: 10,
  marginTop: 16,
  marginBottom: 18,
};

const statBox = {
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(15,23,42,0.02)',
  border: '1px solid rgba(15,23,42,0.08)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
};

const statBoxColumn = {
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(15,23,42,0.02)',
  border: '1px solid rgba(15,23,42,0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const statTopRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
};

const progressTrack = {
  height: 6,
  borderRadius: 999,
  background: 'rgba(15,23,42,0.08)',
  overflow: 'hidden',
};

const progressFill = {
  height: '100%',
  background: 'linear-gradient(90deg,#7c3aed,#ec4899)',
  transition: 'width 0.5s ease',
};

const progressText = {
  fontSize: 11,
  color: '#5d647a',
};

const statLabel = {
  fontSize: 12,
  color: '#5d647a',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 700,
};

const statValue = {
  fontSize: 14,
  color: '#14122b',
  fontWeight: 800,
};

const statValueMuted = {
  fontSize: 14,
  color: '#14122b',
  fontWeight: 800,
};

const statusBadge = {
  width: 'fit-content',
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid',
  fontSize: 13,
  fontWeight: 800,
};

const actions = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  marginTop: 'auto',
};

const primaryBtn = {
  padding: '13px 18px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 800,
  boxShadow: '0 12px 28px rgba(109,73,255,0.18)',
};

const upgradeBtn = {
  padding: '11px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#6d49ff',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 10px 24px rgba(109,73,255,0.14)',
};

const topUpLink = {
  padding: '11px 16px',
  borderRadius: 12,
  background: '#22c55e',
  color: '#fff',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 10px 24px rgba(34,197,94,0.14)',
};

const manageBtn = {
  padding: '11px 16px',
  borderRadius: 12,
  border: '1px solid rgba(15,23,42,0.08)',
  background: '#ffffff',
  color: '#14122b',
  cursor: 'pointer',
  fontWeight: 700,
};

const ghostBtn = {
  padding: '13px 18px',
  borderRadius: 14,
  border: '1px solid rgba(239,68,68,0.18)',
  background: 'rgba(239,68,68,0.04)',
  color: '#dc2626',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryBtn = {
  padding: '11px 14px',
  borderRadius: 14,
  border: '1px solid rgba(15,23,42,0.08)',
  background: '#ffffff',
  color: '#14122b',
  textDecoration: 'none',
  cursor: 'pointer',
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
};

const deleteBtnInline = {
  ...secondaryBtn,
  gridColumn: '1 / -1',
  border: '1px solid rgba(239,68,68,0.18)',
  color: '#dc2626',
  background: 'rgba(239,68,68,0.04)',
};

const emptyCard = {
  padding: 34,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(15,23,42,0.08)',
  textAlign: 'center',
  boxShadow: '0 12px 30px rgba(15,23,42,0.05)',
};

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#f6f4ff',
  color: '#14122b',
  flexDirection: 'column',
  gap: 12,
};

const loadingSpinner = {
  width: 34,
  height: 34,
  border: '3px solid rgba(109,73,255,0.18)',
  borderTop: '3px solid #6d49ff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.28)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
  padding: '20px',
};

const modalBox = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 24,
  padding: 32,
  maxWidth: 500,
  width: '100%',
  textAlign: 'center',
  boxShadow: '0 30px 80px rgba(15,23,42,0.14)',
};

const modalBadge = {
  display: 'inline-block',
  marginBottom: 16,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(109,73,255,0.18)',
  background: 'rgba(109,73,255,0.08)',
  color: '#1a1531',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const modalTitle = {
  margin: '0 0 14px',
  fontSize: '2rem',
  lineHeight: 1.1,
  color: '#14122b',
};

const modalText = {
  color: '#5d647a',
  lineHeight: 1.7,
  fontSize: 15,
  margin: '0 0 24px',
};

const modalPlans = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const modalPrimaryLink = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: 'none',
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
  color: '#fff',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalGhostSecondaryLink = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(109,73,255,0.18)',
  background: '#ffffff',
  color: '#14122b',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalSecondaryBtn = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(109,73,255,0.18)',
  background: '#ffffff',
  color: '#14122b',
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
};

const deleteOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.34)',
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
  maxWidth: 470,
  borderRadius: 24,
  border: '1px solid rgba(15,23,42,0.08)',
  background: '#ffffff',
  boxShadow: '0 30px 80px rgba(15,23,42,0.16)',
  padding: 28,
  color: '#14122b',
};

const deleteIconWrap = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 24,
  marginBottom: 18,
};

const deleteEyebrow = {
  color: '#ef4444',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
  marginBottom: 8,
};

const deleteTitle = {
  fontSize: 28,
  fontWeight: 800,
  margin: 0,
  marginBottom: 10,
  letterSpacing: '-0.02em',
  color: '#14122b',
};

const deleteText = {
  color: '#5d647a',
  fontSize: 15,
  lineHeight: 1.6,
  marginBottom: 18,
};

const deleteEmailBox = {
  padding: '14px 16px',
  borderRadius: 16,
  background: 'rgba(15,23,42,0.02)',
  border: '1px solid rgba(15,23,42,0.08)',
  color: '#14122b',
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
  border: '1px solid rgba(15,23,42,0.08)',
  background: '#ffffff',
  color: '#14122b',
  fontWeight: 600,
  cursor: 'pointer',
};

const deleteConfirmBtn = {
  padding: '12px 18px',
  transition: 'all 0.2s ease',
  borderRadius: 14,
  border: '1px solid rgba(239,68,68,0.22)',
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
  background: '#ffffff',
  border: '1px solid rgba(109,73,255,0.18)',
  color: '#14122b',
  padding: '12px 18px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 700,
  boxShadow: '0 10px 30px rgba(15,23,42,0.10)',
  zIndex: 9999,
};