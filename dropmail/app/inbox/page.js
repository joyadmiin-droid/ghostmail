'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function InboxContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [emails, setEmails] = useState([]);
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 980);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setIsLoggedIn(!!session?.user);
      } catch {
        if (!mounted) return;
        setIsLoggedIn(false);
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchEmails = useCallback(
    async (showRefreshState = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      }

      try {
        const res = await fetch('/api/mailbox/inbox?token=' + encodeURIComponent(token));
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load inbox');
        }

        const nextEmails = data.emails || [];

        setMailbox(data.mailbox || null);
        setEmails(nextEmails);
        setError(null);

        setSelected(prev => {
          if (!nextEmails.length) return null;
          if (!prev) return nextEmails[0];
          const stillExists = nextEmails.find(e => e.id === prev.id);
          return stillExists || nextEmails[0];
        });
      } catch (err) {
        setError(err.message || 'Failed to load inbox');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchEmails(false);
  }, [fetchEmails]);

  useEffect(() => {
    if (!mailbox?.expires_at) return;

    const tick = () => {
      const diff = new Date(mailbox.expires_at) - new Date();

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        setTimeLeft(
          `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
            .toString()
            .padStart(2, '0')}`
        );
      } else {
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [mailbox]);

  async function copyAddress() {
    if (!mailbox?.address) return;

    try {
      await navigator.clipboard.writeText(mailbox.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  async function markRead(emailId) {
    try {
      await fetch('/api/mailbox/read?id=' + emailId, { method: 'POST' });
      setEmails(prev =>
        prev.map(e => (e.id === emailId ? { ...e, is_read: true } : e))
      );
      setSelected(prev => (prev?.id === emailId ? { ...prev, is_read: true } : prev));
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  }

  function openEmail(email) {
    setSelected(email);
    if (!email.is_read) {
      markRead(email.id);
    }
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';

    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  function formatFullDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function getInitials(email) {
    const from = email?.from_name || email?.from_address || '?';
    return from.trim().slice(0, 1).toUpperCase();
  }

  const visibleEmails = isLoggedIn ? emails : emails.slice(0, 1);
  const hasHiddenEmails = !isLoggedIn && emails.length > 1;
  const unreadCount = emails.filter(e => !e.is_read).length;
  const isExpiringSoon =
    mailbox &&
    mailbox.expires_at &&
    new Date(mailbox.expires_at) < new Date(Date.now() + 2 * 60 * 1000);

  if (!token) {
    return (
      <main style={centerWrap}>
        <div style={emptyCard}>
          <div style={emptyIcon}>🔒</div>
          <h2 style={emptyTitle}>No inbox link found</h2>
          <p style={emptyText}>You need a valid inbox link to access this page.</p>
          <a href="/" style={primaryLink}>Generate a new address</a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={centerWrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={spinner} />
          <p style={loadingText}>Loading your inbox...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={centerWrap}>
        <div style={emptyCard}>
          <div style={emptyIcon}>📭</div>
          <h2 style={emptyTitle}>Inbox not found</h2>
          <p style={emptyText}>This inbox may have expired or the link is invalid.</p>
          <p style={errorText}>{error}</p>
          <a href="/" style={primaryLink}>Generate a new address</a>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.55} }
        * { box-sizing: border-box; }

        .mail-card {
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .mail-card:hover {
          transform: translateY(-2px);
          border-color: rgba(167,139,250,0.26) !important;
          box-shadow: 0 18px 34px rgba(0,0,0,0.18), 0 0 24px rgba(167,139,250,0.08) !important;
        }

        .action-btn {
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(167,139,250,0.28) !important;
          box-shadow: 0 12px 26px rgba(0,0,0,0.18);
        }
      `}</style>

      <header style={topHeader}>
        <a href="/" style={brandLink}>
          <span style={brandIcon}>✦</span>
          <span style={brandText}>GhostMail</span>
        </a>

        <div style={headerActions}>
          {timeLeft && (
            <div
              style={{
                ...timeBadge,
                background: isExpiringSoon
                  ? 'rgba(248,113,113,0.14)'
                  : 'rgba(167,139,250,0.12)',
                borderColor: isExpiringSoon
                  ? 'rgba(248,113,113,0.34)'
                  : 'rgba(167,139,250,0.30)',
                boxShadow: isExpiringSoon
                  ? '0 0 26px rgba(248,113,113,0.10)'
                  : '0 0 22px rgba(167,139,250,0.08)',
              }}
            >
              <span style={{ animation: isExpiringSoon ? 'pulse 1s infinite' : 'none' }}>⏳</span>
              <span
                style={{
                  color: isExpiringSoon ? '#fca5a5' : '#e8deff',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                }}
              >
                {timeLeft}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchEmails(true)}
            disabled={refreshing}
            className="action-btn"
            style={{
              ...ghostButton,
              opacity: refreshing ? 0.75 : 1,
              cursor: refreshing ? 'default' : 'pointer',
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          {!isLoggedIn && (
            <a href="/login" style={smallCta}>
              Sign in
            </a>
          )}
        </div>
      </header>

      <div style={shell}>
        <section style={topInfoGrid}>
          <div style={topInfoCardWide}>
            <div style={sectionLabel}>Your address</div>
            <div style={addressText}>{mailbox?.address || '—'}</div>
          </div>

          <div style={topInfoCard}>
            <div style={sectionLabel}>Inbox status</div>
            <div style={{ ...topInfoValue, color: isExpiringSoon ? '#fca5a5' : '#22c55e' }}>
              {timeLeft === 'Expired' ? 'Expired' : 'Active'}
            </div>
          </div>

          <div style={topInfoCard}>
            <div style={sectionLabel}>Unread</div>
            <div style={topInfoValue}>{unreadCount}</div>
          </div>

          <div style={topActionsCard}>
            <button
              type="button"
              onClick={copyAddress}
              className="action-btn"
              style={{
                ...copyButtonStrong,
                borderColor: copied
                  ? 'rgba(34,197,94,0.35)'
                  : 'rgba(167,139,250,0.24)',
                color: copied ? '#4ade80' : '#f5f3ff',
                background: copied
                  ? 'rgba(34,197,94,0.10)'
                  : 'rgba(255,255,255,0.03)',
              }}
            >
              {copied ? '✓ Copied' : 'Copy address'}
            </button>
          </div>
        </section>

        <div
          style={{
            ...contentWrap,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <aside
            style={{
              ...sidebarPanel,
              width: isMobile ? '100%' : '370px',
              maxHeight: isMobile ? '46vh' : 'calc(100vh - 290px)',
            }}
          >
            <div style={sidebarHeader}>
              <div>
                <div style={sectionLabel}>Inbox</div>
                <div style={sidebarSubtext}>
                  {emails.length} email{emails.length !== 1 ? 's' : ''}
                </div>
              </div>

              {emails.length > 0 && (
                <div style={pillNeutral}>{unreadCount} unread</div>
              )}
            </div>

            {emails.length === 0 ? (
              <div style={waitingWrap}>
                <div style={emptyIconSmall}>📭</div>
                <p style={waitingTitle}>Waiting for emails...</p>
                <p style={waitingText}>
                  Send something to{' '}
                  <span style={waitingAddress}>{mailbox?.address}</span>{' '}
                  then press refresh.
                </p>
              </div>
            ) : (
              <>
                <div style={emailListWrap}>
                  {visibleEmails.map(email => {
                    const active = selected?.id === email.id;

                    return (
                      <button
                        key={email.id}
                        type="button"
                        onClick={() => openEmail(email)}
                        className="mail-card"
                        style={{
                          ...emailRow,
                          background: active
                            ? 'linear-gradient(180deg, rgba(167,139,250,0.17), rgba(167,139,250,0.07))'
                            : 'rgba(255,255,255,0.03)',
                          borderColor: active
                            ? 'rgba(167,139,250,0.42)'
                            : 'rgba(255,255,255,0.05)',
                          boxShadow: active
                            ? '0 0 0 1px rgba(167,139,250,0.16) inset, 0 0 30px rgba(167,139,250,0.10), 0 20px 38px rgba(0,0,0,0.18)'
                            : '0 12px 24px rgba(0,0,0,0.10)',
                        }}
                      >
                        <div style={avatarCircle}>{getInitials(email)}</div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={emailRowTop}>
                            <span
                              style={{
                                ...senderText,
                                color: email.is_read ? '#d4cdea' : '#ffffff',
                                fontWeight: email.is_read ? 600 : 800,
                              }}
                            >
                              {email.from_name || email.from_address}
                            </span>

                            <span style={emailDate}>{formatTime(email.received_at)}</span>
                          </div>

                          <div
                            style={{
                              ...emailSubject,
                              color: active ? '#ffffff' : '#efe9ff',
                            }}
                          >
                            {email.subject || '(no subject)'}
                          </div>

                          <div style={emailPreviewRow}>
                            <span style={previewText}>
                              {email.body_text
                                ? email.body_text.replace(/\s+/g, ' ').trim()
                                : email.from_address || 'No preview available'}
                            </span>

                            {!email.is_read && <span style={unreadDot} />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {hasHiddenEmails && (
                  <div style={lockedBox}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔐</div>
                    <div style={lockedTitle}>
                      {emails.length - 1} more email{emails.length - 1 !== 1 ? 's' : ''}
                    </div>
                    <div style={lockedText}>
                      Sign up free to unlock all emails, keep inboxes longer, and manage them better.
                    </div>
                    <a href="/login" style={primaryLinkSmall}>
                      Sign up free
                    </a>
                  </div>
                )}
              </>
            )}
          </aside>

          <section style={viewerPanel}>
            {selected ? (
              <div style={viewerInner}>
                <div style={messageHeader}>
                  <h1 style={messageTitle}>{selected.subject || '(no subject)'}</h1>

                  <div style={messageMetaGrid}>
                    <div style={metaCard}>
                      <div style={sectionLabel}>From</div>
                      <div style={metaValue}>
                        {selected.from_name || selected.from_address}
                      </div>
                      {selected.from_address && selected.from_name && (
                        <div style={metaSubValue}>{selected.from_address}</div>
                      )}
                    </div>

                    <div style={metaCard}>
                      <div style={sectionLabel}>Received</div>
                      <div style={metaValue}>{formatFullDate(selected.received_at)}</div>
                    </div>
                  </div>
                </div>

                <div style={messageBodyWrap}>
                  {selected.body_html ? (
                    <iframe
                      title="Email content"
                      sandbox="allow-same-origin"
                      style={messageIframe}
                      srcDoc={`
                        <style>
                          html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: #0b0712 !important;
                            color: #f5f3ff !important;
                            font-family: Arial, sans-serif !important;
                            line-height: 1.75 !important;
                            font-size: 15px !important;
                            word-wrap: break-word !important;
                            overflow-wrap: anywhere !important;
                          }
                          body {
                            padding: 28px !important;
                          }
                          * {
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                          }
                          img {
                            max-width: 100% !important;
                            height: auto !important;
                            border-radius: 10px !important;
                          }
                          table {
                            width: 100% !important;
                            display: block !important;
                            overflow-x: auto !important;
                          }
                          pre, code {
                            white-space: pre-wrap !important;
                            word-break: break-word !important;
                          }
                          blockquote {
                            margin: 0 !important;
                            padding-left: 14px !important;
                            border-left: 3px solid rgba(167,139,250,0.45) !important;
                            color: #d9d2ef !important;
                          }
                          a {
                            color: #c4b5fd !important;
                          }
                        </style>
                        ${selected.body_html}
                      `}
                    />
                  ) : (
                    <pre style={messagePre}>{selected.body_text || '(empty email)'}</pre>
                  )}
                </div>
              </div>
            ) : (
              <div style={noSelectionWrap}>
                <div style={noSelectionIcon}>✉️</div>
                <p style={noSelectionTitle}>No email selected</p>
                <p style={noSelectionText}>Choose a message from the inbox to read it.</p>
              </div>
            )}
          </section>
        </div>

        {!isLoggedIn && (
          <div style={bottomPromo}>
            <div style={promoText}>
              👻 <span style={{ color: '#e9ddff', fontWeight: 800 }}>Free plan</span> — addresses expire in 10 minutes. Sign up for longer-lived inboxes.
            </div>

            <div style={headerActions}>
              <a href="/login" style={primaryLinkSmall}>Sign up free</a>
              <a href="/login" style={secondaryLink}>Sign in</a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <main style={fallbackMain}>
          <p style={{ color: '#8c84a4', marginBottom: '18px' }}>Loading...</p>
          <div style={footerWrap}>
            <a href="/terms" style={footerLink}>Terms</a>
            <a href="/privacy" style={footerLink}>Privacy</a>
            <a href="mailto:support@ghostmails.org" style={footerLink}>Contact</a>
          </div>
        </main>
      }
    >
      <main style={fallbackMain}>
        <div style={{ flex: 1, width: '100%' }}>
          <InboxContent />
        </div>

        <div style={footerWrap}>
          <a href="/terms" style={footerLink}>Terms</a>
          <a href="/privacy" style={footerLink}>Privacy</a>
          <a href="mailto:support@ghostmails.org" style={footerLink}>Contact</a>
        </div>
      </main>
    </Suspense>
  );
}

/* styles */

const pageWrap = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, rgba(91,33,182,0.18), transparent 24%), #07010d',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: 'flex',
  flexDirection: 'column',
};

const shell = {
  width: '100%',
  maxWidth: '1260px',
  margin: '0 auto',
  padding: '22px 18px 30px',
};

const fallbackMain = {
  minHeight: '100vh',
  background: '#07010d',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const centerWrap = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, rgba(91,33,182,0.18), transparent 24%), #07010d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  padding: '24px',
};

const emptyCard = {
  textAlign: 'center',
  maxWidth: '480px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '24px',
  padding: '32px 28px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.32)',
};

const emptyIcon = {
  fontSize: '3rem',
  marginBottom: '1rem',
};

const emptyIconSmall = {
  fontSize: '2.25rem',
  marginBottom: '12px',
};

const emptyTitle = {
  color: '#fff',
  margin: '0 0 10px',
  fontSize: '28px',
  fontWeight: 800,
};

const emptyText = {
  color: '#9d95b6',
  marginBottom: '18px',
  lineHeight: 1.7,
  fontSize: '14px',
};

const errorText = {
  color: '#fca5a5',
  marginBottom: '18px',
  fontSize: '14px',
};

const primaryLink = {
  background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  color: '#fff',
  padding: '11px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  display: 'inline-block',
  boxShadow: '0 12px 30px rgba(139,92,246,0.28)',
};

const primaryLinkSmall = {
  background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  color: '#fff',
  padding: '9px 14px',
  borderRadius: '10px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 800,
  boxShadow: '0 10px 24px rgba(139,92,246,0.18)',
};

const secondaryLink = {
  padding: '8px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#d1cae8',
  background: 'rgba(255,255,255,0.03)',
  fontSize: '13px',
  fontWeight: 700,
  textDecoration: 'none',
};

const spinner = {
  width: '34px',
  height: '34px',
  border: '3px solid rgba(167,139,250,0.18)',
  borderTop: '3px solid #a78bfa',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  margin: '0 auto',
};

const loadingText = {
  color: '#9f96bb',
  marginTop: '14px',
  fontSize: '14px',
};

const topHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(7,1,13,0.84)',
  backdropFilter: 'blur(12px)',
  position: 'sticky',
  top: 0,
  zIndex: 50,
  flexWrap: 'wrap',
  gap: '10px',
};

const brandLink = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  textDecoration: 'none',
};

const brandIcon = {
  color: '#b99cff',
  fontSize: '18px',
};

const brandText = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
};

const headerActions = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
};

const timeBadge = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  border: '1px solid',
  borderRadius: '999px',
  padding: '6px 12px',
  fontSize: '13px',
};

const ghostButton = {
  padding: '8px 14px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 700,
};

const smallCta = {
  background: 'rgba(167,139,250,0.14)',
  color: '#d8ccff',
  border: '1px solid rgba(167,139,250,0.28)',
  borderRadius: '999px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 800,
  textDecoration: 'none',
};

const topInfoGrid = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
  gap: '14px',
  marginBottom: '18px',
};

const topInfoCardWide = {
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '20px',
  padding: '18px',
  boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
};

const topInfoCard = {
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '20px',
  padding: '18px',
  boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
};

const topActionsCard = {
  background: 'rgba(255,255,255,0.035)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '20px',
  padding: '18px',
  boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const topInfoValue = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 900,
  marginTop: '8px',
};

const copyButtonStrong = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
};

const sectionLabel = {
  fontSize: '11px',
  color: '#7f7698',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontWeight: 800,
};

const addressText = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: '15px',
  color: '#c8b6ff',
  fontWeight: 800,
  wordBreak: 'break-all',
  marginTop: '8px',
  lineHeight: 1.6,
};

const contentWrap = {
  display: 'flex',
  gap: '18px',
  alignItems: 'stretch',
};

const sidebarPanel = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: '0 20px 46px rgba(0,0,0,0.18)',
  display: 'flex',
  flexDirection: 'column',
};

const viewerPanel = {
  flex: 1,
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: '0 20px 46px rgba(0,0,0,0.18)',
  minHeight: 'calc(100vh - 290px)',
};

const sidebarHeader = {
  padding: '18px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  background: 'rgba(10,2,18,0.94)',
};

const sidebarSubtext = {
  fontSize: '12px',
  color: '#9a91b5',
  marginTop: '6px',
};

const pillNeutral = {
  fontSize: '12px',
  color: '#d6cff1',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '999px',
  padding: '7px 10px',
  whiteSpace: 'nowrap',
};

const waitingWrap = {
  padding: '44px 18px',
  textAlign: 'center',
};

const waitingTitle = {
  color: '#fff',
  fontWeight: 800,
  margin: '0 0 8px',
  fontSize: '15px',
};

const waitingText = {
  color: '#958cab',
  fontSize: '13px',
  lineHeight: 1.7,
  margin: 0,
};

const waitingAddress = {
  color: '#c9b7ff',
  wordBreak: 'break-all',
};

const emailListWrap = {
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  overflowY: 'auto',
};

const emailRow = {
  width: '100%',
  padding: '16px',
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  gap: '12px',
};

const avatarCircle = {
  width: '42px',
  height: '42px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(167,139,250,0.25), rgba(139,92,246,0.16))',
  border: '1px solid rgba(167,139,250,0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#f5f3ff',
  fontWeight: 800,
  fontSize: '14px',
  flexShrink: 0,
};

const emailRowTop = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '5px',
};

const senderText = {
  fontSize: '13px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
};

const emailSubject = {
  fontSize: '13px',
  fontWeight: 700,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginBottom: '7px',
};

const emailPreviewRow = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const previewText = {
  fontSize: '12px',
  color: '#9289ab',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const unreadDot = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#a78bfa',
  boxShadow: '0 0 16px rgba(167,139,250,0.9)',
  flexShrink: 0,
};

const emailDate = {
  fontSize: '11px',
  color: '#7f7698',
  flexShrink: 0,
};

const lockedBox = {
  margin: '14px',
  padding: '18px',
  background: 'rgba(167,139,250,0.07)',
  border: '1px solid rgba(167,139,250,0.18)',
  borderRadius: '18px',
  textAlign: 'center',
  boxShadow: '0 16px 34px rgba(0,0,0,0.14)',
};

const lockedTitle = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#fff',
  marginBottom: '6px',
};

const lockedText = {
  fontSize: '12px',
  color: '#a095be',
  marginBottom: '14px',
  lineHeight: 1.6,
};

const viewerInner = {
  padding: '26px',
};

const messageHeader = {
  marginBottom: '22px',
};

const messageTitle = {
  color: '#fff',
  fontSize: 'clamp(24px, 3vw, 32px)',
  fontWeight: 900,
  margin: '0 0 18px',
  lineHeight: 1.22,
  wordBreak: 'break-word',
  letterSpacing: '-0.03em',
};

const messageMetaGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '14px',
};

const metaCard = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '18px',
  padding: '16px',
  boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
};

const metaValue = {
  fontSize: '14px',
  color: '#f1edff',
  marginTop: '6px',
  wordBreak: 'break-word',
  fontWeight: 700,
  lineHeight: 1.5,
};

const metaSubValue = {
  fontSize: '12px',
  color: '#9f96b8',
  marginTop: '6px',
  wordBreak: 'break-word',
};

const messageBodyWrap = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '22px',
  overflow: 'hidden',
  boxShadow: '0 24px 54px rgba(0,0,0,0.24), 0 0 28px rgba(167,139,250,0.05)',
};

const messageIframe = {
  width: '100%',
  height: '70vh',
  minHeight: '520px',
  border: 'none',
  background: '#0b0712',
  display: 'block',
};

const messagePre = {
  color: '#eee9ff',
  fontSize: '14px',
  lineHeight: 1.9,
  whiteSpace: 'pre-wrap',
  fontFamily: 'inherit',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  margin: 0,
  padding: '28px',
};

const noSelectionWrap = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '500px',
  textAlign: 'center',
  padding: '32px',
};

const noSelectionIcon = {
  fontSize: '3rem',
  marginBottom: '12px',
  opacity: 0.38,
};

const noSelectionTitle = {
  color: '#fff',
  fontWeight: 800,
  margin: '0 0 8px',
  fontSize: '16px',
};

const noSelectionText = {
  fontSize: '14px',
  color: '#9289ab',
  margin: 0,
};

const bottomPromo = {
  marginTop: '18px',
  borderTop: '1px solid rgba(167,139,250,0.14)',
  background: 'rgba(167,139,250,0.05)',
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '12px',
  borderRadius: '18px',
};

const promoText = {
  fontSize: '13px',
  color: '#b0a7c9',
  lineHeight: 1.6,
};

const footerWrap = {
  textAlign: 'center',
  padding: '16px',
  fontSize: '12px',
  color: '#6d6582',
};

const footerLink = {
  margin: '0 8px',
  color: '#7a728e',
  textDecoration: 'none',
};