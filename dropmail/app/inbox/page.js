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
    const checkMobile = () => setIsMobile(window.innerWidth <= 900);
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

        setMailbox(data.mailbox || null);
        setEmails(data.emails || []);
        setError(null);

        setSelected(prev => {
          if (!prev) return (data.emails && data.emails[0]) || null;
          const stillExists = (data.emails || []).find(e => e.id === prev.id);
          return stillExists || ((data.emails && data.emails[0]) || null);
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

      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(m + ':' + s.toString().padStart(2, '0'));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [mailbox]);

  async function copyAddress() {
    if (!mailbox?.address) return;
    await navigator.clipboard.writeText(mailbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markRead(emailId) {
    try {
      await fetch('/api/mailbox/read?id=' + emailId, { method: 'POST' });
      setEmails(prev =>
        prev.map(e => (e.id === emailId ? { ...e, is_read: true } : e))
      );
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
    return d.toLocaleDateString();
  }

  function formatFullDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  const visibleEmails = isLoggedIn ? emails : emails.slice(0, 1);
  const hasHiddenEmails = !isLoggedIn && emails.length > 1;
  const isExpiringSoon =
    mailbox &&
    new Date(mailbox.expires_at) < new Date(Date.now() + 2 * 60 * 1000);

  if (!token) {
    return (
      <main style={centerWrap}>
        <div style={emptyCard}>
          <div style={emoji}>🔒</div>
          <h2 style={emptyTitle}>No inbox link found</h2>
          <p style={emptyText}>
            You need a valid inbox link to access this page.
          </p>
          <a href="/" style={primaryLink}>
            Generate a new address
          </a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={centerWrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={spinner} />
          <p style={{ color: '#7b7690', marginTop: '14px' }}>Loading your inbox...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={centerWrap}>
        <div style={emptyCard}>
          <div style={emoji}>📭</div>
          <h2 style={emptyTitle}>Inbox not found</h2>
          <p style={emptyText}>
            This inbox may have expired or the link is invalid.
          </p>
          <p style={{ color: '#f87171', marginBottom: '18px' }}>{error}</p>
          <a href="/" style={primaryLink}>
            Generate a new address
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.55} }
        * { box-sizing: border-box; }
      `}</style>

      <header style={topHeader}>
        <a href="/" style={brandLink}>
          <span style={{ color: '#a78bfa', fontSize: '18px' }}>&#10022;</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>GhostMail</span>
        </a>

        <div style={topActions}>
          {timeLeft && (
            <div
              style={{
                ...timeBadge,
                background: isExpiringSoon
                  ? 'rgba(248,113,113,0.10)'
                  : 'rgba(167,139,250,0.10)',
                borderColor: isExpiringSoon
                  ? 'rgba(248,113,113,0.30)'
                  : 'rgba(167,139,250,0.30)',
              }}
            >
              <span style={{ animation: isExpiringSoon ? 'pulse 1s infinite' : 'none' }}>⏳</span>
              <span
                style={{
                  color: isExpiringSoon ? '#f87171' : '#c4b5fd',
                  fontFamily: 'monospace',
                  fontWeight: '700',
                }}
              >
                {timeLeft}
              </span>
            </div>
          )}

          <button
            onClick={() => fetchEmails(true)}
            disabled={refreshing}
            style={ghostButton}
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

      <div style={addressBar}>
        <div style={{ minWidth: 0 }}>
          <div style={miniLabel}>Your address</div>
          <div style={addressText}>{mailbox?.address}</div>
        </div>

        <div style={topActions}>
          <button
            onClick={copyAddress}
            style={{
              ...ghostButton,
              borderColor: copied
                ? 'rgba(34,197,94,0.35)'
                : 'rgba(167,139,250,0.30)',
              color: copied ? '#22c55e' : '#a78bfa',
              background: copied
                ? 'rgba(34,197,94,0.10)'
                : 'rgba(167,139,250,0.10)',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>

          <a href="/" style={secondaryLink}>
            New address
          </a>
        </div>
      </div>

      <div
        style={{
          ...mainLayout,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <aside
          style={{
            ...sidebar,
            width: isMobile ? '100%' : '340px',
            maxHeight: isMobile ? '42vh' : 'none',
            borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
            borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <div style={sidebarHeader}>
            <span style={miniLabel}>Inbox</span>
            <span style={{ fontSize: '11px', color: '#6f6983' }}>
              {emails.length} email{emails.length !== 1 ? 's' : ''}
            </span>
          </div>

          {emails.length === 0 ? (
            <div style={waitingWrap}>
              <div style={{ fontSize: '2.4rem', marginBottom: '10px' }}>📭</div>
              <p style={{ color: '#fff', fontWeight: '700', marginBottom: '4px' }}>
                Waiting for emails...
              </p>
              <p style={{ color: '#7a748f', fontSize: '12px', lineHeight: 1.6 }}>
                Send something to{' '}
                <span style={{ color: '#a78bfa', wordBreak: 'break-all' }}>
                  {mailbox?.address}
                </span>{' '}
                and refresh.
              </p>
            </div>
          ) : (
            <>
              {visibleEmails.map(email => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email)}
                  style={{
                    ...emailRow,
                    background:
                      selected?.id === email.id
                        ? 'rgba(167,139,250,0.08)'
                        : 'transparent',
                    borderLeft:
                      selected?.id === email.id
                        ? '2px solid #a78bfa'
                        : '2px solid transparent',
                  }}
                >
                  <div style={emailRowTop}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: email.is_read ? 500 : 700,
                        color: email.is_read ? '#a09ab4' : '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '190px',
                        textAlign: 'left',
                      }}
                    >
                      {email.from_name || email.from_address}
                    </span>

                    {!email.is_read && <span style={unreadDot} />}
                  </div>

                  <div style={emailSubject}>
                    {email.subject || '(no subject)'}
                  </div>

                  <div style={emailDate}>
                    {formatTime(email.received_at)}
                  </div>
                </button>
              ))}

              {hasHiddenEmails && (
                <div style={lockedBox}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔐</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                    {emails.length - 1} more email{emails.length - 1 !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#7b7690', marginBottom: '12px', lineHeight: 1.5 }}>
                    Sign up free to unlock all emails, longer-lived inboxes, and better workflow tools.
                  </div>
                  <a href="/login" style={primaryLinkSmall}>
                    Sign up free
                  </a>
                </div>
              )}
            </>
          )}
        </aside>

        <section
          style={{
            ...viewer,
            minHeight: isMobile ? '58vh' : 'auto',
          }}
        >
          {selected ? (
            <div style={viewerInner}>
              <div style={messageHeader}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={messageTitle}>
                    {selected.subject || '(no subject)'}
                  </h2>

                  <div style={messageMetaWrap}>
                    <div>
                      <div style={miniLabel}>From</div>
                      <div style={metaValue}>
                        {selected.from_name || selected.from_address}
                      </div>
                    </div>

                    <div>
                      <div style={miniLabel}>Received</div>
                      <div style={metaValue}>
                        {formatFullDate(selected.received_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={messageBodyWrap}>
                {selected.body_html ? (
                  <iframe
                    srcDoc={
                      `<style>
                        html,body{
                          background:#0a0a0f !important;
                          color:#e8e6df !important;
                          font-family:Arial,sans-serif !important;
                          margin:0 !important;
                          padding:24px !important;
                          line-height:1.7 !important;
                          font-size:15px !important;
                        }
                        *{
                          max-width:100% !important;
                        }
                        a{ color:#a78bfa !important; }
                        img{
                          max-width:100% !important;
                          height:auto !important;
                          border-radius:8px !important;
                        }
                      </style>` + selected.body_html
                    }
                    style={messageIframe}
                    sandbox="allow-same-origin"
                    title="Email content"
                  />
                ) : (
                  <pre style={messagePre}>
                    {selected.body_text || '(empty email)'}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div style={noSelectionWrap}>
              <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.35 }}>✉️</div>
              <p style={{ fontSize: '14px', color: '#7b7690' }}>
                Select an email to read it
              </p>
            </div>
          )}
        </section>
      </div>

      {!isLoggedIn && (
        <div style={bottomPromo}>
          <div style={{ fontSize: '13px', color: '#9b96ad' }}>
            👻 <span style={{ color: '#c4b5fd', fontWeight: '700' }}>Free plan</span> — addresses expire in 10 minutes. Sign up for longer-lived inboxes.
          </div>

          <div style={topActions}>
            <a href="/login" style={primaryLinkSmall}>
              Sign up free
            </a>

            <a href="/login" style={secondaryLink}>
              Sign in
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <main style={fallbackMain}>
          <p style={{ color: '#6b6b7a', marginBottom: '20px' }}>Loading...</p>

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

/* shared styles */

const pageWrap = {
  minHeight: '100vh',
  background: '#080010',
  fontFamily: 'inherit',
  display: 'flex',
  flexDirection: 'column',
};

const fallbackMain = {
  minHeight: '100vh',
  background: '#080010',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'sans-serif',
};

const centerWrap = {
  minHeight: '100vh',
  background: '#080010',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'sans-serif',
  padding: '24px',
};

const emptyCard = {
  textAlign: 'center',
  maxWidth: '460px',
};

const emoji = {
  fontSize: '3rem',
  marginBottom: '1rem',
};

const emptyTitle = {
  color: '#fff',
  marginBottom: '0.5rem',
};

const emptyText = {
  color: '#777189',
  marginBottom: '1.5rem',
  lineHeight: 1.6,
};

const primaryLink = {
  background: '#a78bfa',
  color: '#fff',
  padding: '10px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: '700',
  display: 'inline-block',
};

const primaryLinkSmall = {
  background: '#a78bfa',
  color: '#fff',
  padding: '8px 14px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: '700',
};

const secondaryLink = {
  padding: '7px 16px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#9f9aae',
  fontSize: '13px',
  fontWeight: '600',
  textDecoration: 'none',
};

const spinner = {
  width: '32px',
  height: '32px',
  border: '3px solid rgba(167,139,250,0.2)',
  borderTop: '3px solid #a78bfa',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  margin: '0 auto',
};

const topHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem 1.25rem',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(8,0,16,0.85)',
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
  gap: '8px',
  textDecoration: 'none',
};

const topActions = {
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
  padding: '5px 12px',
};

const ghostButton = {
  padding: '8px 14px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#fff',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
};

const smallCta = {
  background: 'rgba(167,139,250,0.15)',
  color: '#a78bfa',
  border: '1px solid rgba(167,139,250,0.3)',
  borderRadius: '999px',
  padding: '7px 14px',
  fontSize: '13px',
  fontWeight: '700',
  textDecoration: 'none',
};

const addressBar = {
  padding: '1rem 1.25rem',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
};

const miniLabel = {
  fontSize: '11px',
  color: '#6f6983',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: '700',
};

const addressText = {
  fontFamily: 'monospace',
  fontSize: '15px',
  color: '#a78bfa',
  fontWeight: '700',
  wordBreak: 'break-all',
  marginTop: '4px',
};

const mainLayout = {
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
};

const sidebar = {
  flexShrink: 0,
  overflowY: 'auto',
  background: '#080010',
};

const sidebarHeader = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const waitingWrap = {
  padding: '2.5rem 1.25rem',
  textAlign: 'center',
};

const emailRow = {
  width: '100%',
  padding: '14px 16px',
  cursor: 'pointer',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  transition: 'all 0.15s',
  textAlign: 'left',
  borderTop: 'none',
  borderRight: 'none',
  borderBottomColor: 'rgba(255,255,255,0.04)',
  borderLeftWidth: '2px',
};

const emailRowTop = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '4px',
  gap: '10px',
};

const unreadDot = {
  width: '7px',
  height: '7px',
  borderRadius: '50%',
  background: '#a78bfa',
  flexShrink: 0,
};

const emailSubject = {
  fontSize: '12px',
  color: '#928ca5',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginBottom: '4px',
};

const emailDate = {
  fontSize: '11px',
  color: '#5f596f',
};

const lockedBox = {
  margin: '12px',
  padding: '16px',
  background: 'rgba(167,139,250,0.06)',
  border: '1px solid rgba(167,139,250,0.2)',
  borderRadius: '12px',
  textAlign: 'center',
};

const viewer = {
  flex: 1,
  overflowY: 'auto',
  background: '#080010',
};

const viewerInner = {
  padding: '1.5rem 2rem',
  maxWidth: '860px',
};

const messageHeader = {
  marginBottom: '1.5rem',
  paddingBottom: '1.5rem',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const messageTitle = {
  color: '#fff',
  fontSize: '1.45rem',
  fontWeight: '800',
  marginBottom: '1rem',
  lineHeight: '1.35',
  wordBreak: 'break-word',
};

const messageMetaWrap = {
  display: 'flex',
  gap: '2rem',
  flexWrap: 'wrap',
};

const metaValue = {
  fontSize: '13px',
  color: '#c6c0d8',
  marginTop: '4px',
  wordBreak: 'break-word',
};

const messageBodyWrap = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
  padding: '0',
  overflow: 'hidden',
};

const messageIframe = {
  width: '100%',
  height: '520px',
  border: 'none',
  background: '#0a0a0f',
};

const messagePre = {
  color: '#d6d1e2',
  fontSize: '14px',
  lineHeight: '1.8',
  whiteSpace: 'pre-wrap',
  fontFamily: 'inherit',
  wordBreak: 'break-word',
  margin: 0,
  padding: '24px',
};

const noSelectionWrap = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  textAlign: 'center',
  padding: '2rem',
};

const bottomPromo = {
  borderTop: '1px solid rgba(167,139,250,0.2)',
  background: 'rgba(167,139,250,0.05)',
  padding: '12px 1.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '12px',
};

const footerWrap = {
  textAlign: 'center',
  padding: '16px',
  fontSize: '12px',
  color: '#555',
};

const footerLink = {
  margin: '0 8px',
  color: '#666',
};