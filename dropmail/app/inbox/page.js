'use client';

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
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
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);
  const [mailboxExpired, setMailboxExpired] = useState(false);

  const hasCleanedExpiredMailbox = useRef(false);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  function getDisplaySubject(email) {
    const raw = email?.subject;
    if (typeof raw !== 'string') return '(no subject)';
    const clean = raw.replace(/\s+/g, ' ').trim();
    return clean || '(no subject)';
  }

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

        const loggedIn = !!session?.user;
        setIsLoggedIn(loggedIn);
        setAuthChecked(true);

        if (!loggedIn && token) {
          window.location.href = `/login?next=${encodeURIComponent(`/inbox?token=${token}`)}`;
        }
      } catch {
        if (!mounted) return;
        setIsLoggedIn(false);
        setAuthChecked(true);

        if (token) {
          window.location.href = `/login?next=${encodeURIComponent(`/inbox?token=${token}`)}`;
        }
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const loggedIn = !!session?.user;
      setIsLoggedIn(loggedIn);
      setAuthChecked(true);

      if (!loggedIn && token) {
        window.location.href = `/login?next=${encodeURIComponent(`/inbox?token=${token}`)}`;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [token]);

  const cleanupExpiredMailbox = useCallback(async (mailboxId) => {
    if (!mailboxId || hasCleanedExpiredMailbox.current) return;

    hasCleanedExpiredMailbox.current = true;

    try {
      const { error: deactivateError } = await supabase
        .from('mailboxes')
        .update({ is_active: false })
        .eq('id', mailboxId);

      if (deactivateError) {
        console.error('Failed to deactivate expired mailbox:', deactivateError);
      }
    } catch (err) {
      console.error('Expired mailbox cleanup failed:', err);
    }
  }, []);

  const fetchEmails = useCallback(
    async (showRefreshState = false) => {
      if (!token || !isLoggedIn) {
        setLoading(false);
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers = {};
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/mailbox/inbox?token=' + encodeURIComponent(token), {
          headers,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load inbox');
        }

        const nextMailbox = data.mailbox || null;
        const nextEmails = data.emails || [];

        if (nextMailbox?.expires_at && new Date(nextMailbox.expires_at) <= new Date()) {
          setMailbox(nextMailbox);
          setEmails([]);
          setMailboxExpired(true);
          await cleanupExpiredMailbox(nextMailbox.id);
          setError('This inbox has expired.');
          setLoading(false);
          setRefreshing(false);
          return;
        }

        setMailbox(nextMailbox);
        setEmails(nextEmails);
        setMailboxExpired(false);
        hasCleanedExpiredMailbox.current = false;
        setError(null);

        setSelected((prev) => {
          if (!nextEmails.length) return null;
          if (!prev) return nextEmails[0];
          const stillExists = nextEmails.find((e) => e.id === prev.id);
          return stillExists || nextEmails[0];
        });
      } catch (err) {
        setError(err.message || 'Failed to load inbox');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, isLoggedIn, cleanupExpiredMailbox]
  );

  useEffect(() => {
    if (!authChecked || !isLoggedIn) return;
    fetchEmails(false);
  }, [fetchEmails, authChecked, isLoggedIn]);

  useEffect(() => {
    if (!autoRefreshSeconds || !token || !isLoggedIn || mailboxExpired) return;

    const interval = setInterval(() => {
      fetchEmails(false);
    }, autoRefreshSeconds * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshSeconds, token, fetchEmails, isLoggedIn, mailboxExpired]);

  useEffect(() => {
    if (!mailbox?.expires_at) return;

    const tick = async () => {
      const diff = new Date(mailbox.expires_at) - new Date();

      if (diff <= 0) {
        setTimeLeft('Expired');
        setMailboxExpired(true);
        await cleanupExpiredMailbox(mailbox.id);
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
  }, [mailbox, cleanupExpiredMailbox]);

  async function copyAddress() {
    if (!mailbox?.address) return;

    try {
      await navigator.clipboard.writeText(mailbox.address);
      setCopied(true);
      showToast('Address copied');
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  async function copyDetectedCode(code) {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      showToast('Code copied');
      setTimeout(() => setCopiedCode(false), 1600);
    } catch (err) {
      console.error('Code copy failed:', err);
    }
  }

  async function markRead(emailId) {
    try {
      await fetch('/api/mailbox/read?id=' + emailId, { method: 'POST' });
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, is_read: true } : e))
      );
      setSelected((prev) => (prev?.id === emailId ? { ...prev, is_read: true } : prev));
    } catch (err) {
      console.error('Mark read failed:', err);
    }
  }

  function openEmail(email) {
    setSelected(email);
    setCopiedCode(false);
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

  function extractCode(email) {
    if (!email) return null;

    const text = [
      email.subject || '',
      email.body_text || '',
      typeof email.body_html === 'string' ? email.body_html.replace(/<[^>]+>/g, ' ') : '',
    ].join(' ');

    const labeledPatterns = [
      /(?:otp|code|verification code|verify code|security code|login code|passcode)[:\s-]*([0-9]{4,8})/i,
      /([0-9]{4,8})\s*(?:is your otp|is your code|is your verification code|is your login code)/i,
    ];

    for (const pattern of labeledPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1];
    }

    const genericMatches = text.match(/\b\d{4,8}\b/g) || [];
    if (!genericMatches.length) return null;

    const filtered = genericMatches.filter((code) => !/^\d{4}$/.test(code) || Number(code) > 1900);
    return filtered[0] || genericMatches[0] || null;
  }

  const detectedCode = useMemo(() => extractCode(selected), [selected]);
  const unreadCount = emails.filter((e) => !e.is_read).length;
  const isExpiringSoon =
    mailbox &&
    mailbox.expires_at &&
    new Date(mailbox.expires_at) < new Date(Date.now() + 2 * 60 * 1000) &&
    !mailboxExpired;

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

  if (!authChecked || loading) {
    return (
      <main style={centerWrap}>
        <div style={{ textAlign: 'center' }}>
          <div style={spinner} />
          <p style={loadingText}>Loading your inbox...</p>
        </div>
      </main>
    );
  }

  if (error || mailboxExpired) {
    return (
      <main style={centerWrap}>
        <div style={emptyCard}>
          <div style={emptyIcon}>📭</div>
          <h2 style={emptyTitle}>Inbox expired</h2>
          <p style={emptyText}>
            This inbox has expired and was removed automatically from your active inboxes.
          </p>
          <p style={errorText}>{error || 'Please generate a new address.'}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/dashboard" style={primaryLink}>Back to dashboard</a>
            <a href="/" style={secondaryLink}>Go home</a>
          </div>
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

        select option {
          background: #ffffff;
          color: #0f172a;
        }

        .mail-card:hover {
          transform: translateY(-1px);
          background: #f8fafc !important;
          border-color: rgba(15,23,42,0.22) !important;
          box-shadow: 0 10px 24px rgba(15,23,42,0.08) !important;
        }

        .action-btn {
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(15,23,42,0.18) !important;
          box-shadow: 0 8px 18px rgba(15,23,42,0.08);
          background: #ffffff !important;
        }

        .viewer-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148,163,184,0.55) transparent;
        }

        .viewer-scroll::-webkit-scrollbar,
        .email-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .viewer-scroll::-webkit-scrollbar-thumb,
        .email-scroll::-webkit-scrollbar-thumb {
          background: rgba(148,163,184,0.55);
          border-radius: 999px;
        }

        .viewer-scroll::-webkit-scrollbar-track,
        .email-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>

      <header style={topHeader}>
        <div
          style={{
            ...topHeaderInner,
            padding: isMobile ? '12px 14px' : '14px 18px',
          }}
        >
          <a href="/" style={brandLink}>
            <span style={brandIcon}>✦</span>
            <span style={brandText}>GhostMail</span>
          </a>

          <div
            style={{
              ...headerActions,
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'space-between' : 'flex-end',
            }}
          >
            {timeLeft && (
              <div
                style={{
                  ...timeBadge,
                  background: isExpiringSoon
                    ? 'rgba(248,113,113,0.10)'
                    : 'rgba(167,139,250,0.08)',
                  borderColor: isExpiringSoon
                    ? 'rgba(248,113,113,0.28)'
                    : 'rgba(167,139,250,0.25)',
                  boxShadow: isExpiringSoon
                    ? '0 4px 12px rgba(248,113,113,0.10)'
                    : '0 4px 12px rgba(167,139,250,0.08)',
                }}
              >
                <span style={{ animation: isExpiringSoon ? 'pulse 1s infinite' : 'none' }}>⏳</span>
                <span
                  style={{
                    color: isExpiringSoon ? '#dc2626' : '#0f172a',
                    fontFamily: 'monospace',
                    fontWeight: 800,
                  }}
                >
                  {timeLeft}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={async () => {
                  await fetchEmails(true);
                  showToast('Inbox updated');
                }}
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

              <a
                href="/dashboard"
                className="action-btn"
                style={{
                  ...ghostButton,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      <div
        style={{
          ...shell,
          padding: isMobile ? '16px 12px 24px' : '22px 18px 30px',
        }}
      >
        <section
          style={{
            ...topInfoGrid,
            gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr 1fr 1.2fr',
            gap: isMobile ? '12px' : '14px',
          }}
        >
          <div style={topInfoCardWide}>
            <div style={sectionLabel}>Your address</div>
            <div
              style={{
                ...addressText,
                fontSize: isMobile ? '14px' : '15px',
              }}
            >
              {mailbox?.address || '—'}
            </div>
          </div>

          <div style={topInfoCard}>
            <div style={sectionLabel}>Inbox status</div>
            <div style={{ ...topInfoValue, color: isExpiringSoon ? '#dc2626' : '#22c55e' }}>
              {timeLeft === 'Expired' ? 'Expired' : 'Active'}
            </div>
          </div>

          <div style={topInfoCard}>
            <div style={sectionLabel}>Unread</div>
            <div style={topInfoValue}>{unreadCount}</div>
          </div>

          <div style={topInfoCard}>
            <div style={sectionLabel}>Auto refresh</div>
            <select
              value={autoRefreshSeconds}
              onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
              style={autoRefreshSelect}
            >
              <option value={0}>Off</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={15}>15s</option>
            </select>
          </div>

          <div style={topActionsCard}>
            <button
              type="button"
              onClick={copyAddress}
              className="action-btn"
              style={{
                ...copyButtonStrong,
                borderColor: copied
                  ? 'rgba(34,197,94,0.28)'
                  : 'rgba(15,23,42,0.14)',
                color: copied ? '#16a34a' : '#0f172a',
                background: copied ? 'rgba(34,197,94,0.08)' : '#ffffff',
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
            gap: isMobile ? '14px' : '18px',
          }}
        >
          <aside
            style={{
              ...sidebarPanel,
              width: isMobile ? '100%' : '360px',
              maxHeight: isMobile ? '42vh' : 'calc(100vh - 290px)',
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
              <div className="email-scroll" style={emailListWrap}>
                {emails.map((email) => {
                  const active = selected?.id === email.id;

                  return (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => openEmail(email)}
                      className="mail-card"
                      style={{
                        ...emailRow,
                        padding: isMobile ? '14px' : '16px',
                        background: active ? '#eef2ff' : '#ffffff',
                        borderColor: active ? '#c7d2fe' : 'rgba(15,23,42,0.12)',
                        boxShadow: active
                          ? '0 0 0 1px rgba(99,102,241,0.06) inset, 0 10px 22px rgba(99,102,241,0.10)'
                          : '0 6px 16px rgba(15,23,42,0.05)',
                      }}
                    >
                      <div style={avatarCircle}>{getInitials(email)}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={emailRowTop}>
                          <span
                            style={{
                              ...senderText,
                              color: email.is_read ? '#475569' : '#0f172a',
                              fontWeight: email.is_read ? 700 : 800,
                            }}
                          >
                            {email.from_name || email.from_address}
                          </span>

                          <span style={emailDate}>{formatTime(email.received_at)}</span>
                        </div>

                        <div
                          style={{
                            ...emailSubject,
                            color: '#0f172a',
                          }}
                        >
                          {getDisplaySubject(email)}
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
            )}
          </aside>

          <section
            style={{
              ...viewerPanel,
              minHeight: isMobile ? 'auto' : 'calc(100vh - 290px)',
            }}
          >
            {selected ? (
              <div
                className="viewer-scroll"
                style={{
                  ...viewerInner,
                  padding: isMobile ? '18px 14px' : '26px',
                  height: '100%',
                  overflowY: 'auto',
                }}
              >
                <div style={messageHeaderCard}>
                  <div style={messageHeaderTop}>
                    <div style={{ minWidth: 0 }}>
                      <div style={sectionLabel}>Selected email</div>
                      <h1
                        style={{
                          ...messageTitle,
                          fontSize: isMobile ? '1.55rem' : 'clamp(26px, 3vw, 34px)',
                          marginBottom: '10px',
                        }}
                      >
                        {getDisplaySubject(selected)}
                      </h1>

                      <div style={messageSubline}>
                        <span>{selected.from_name || selected.from_address}</span>
                        <span style={sublineDot}>•</span>
                        <span>{formatFullDate(selected.received_at)}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        ...messageStatusBadge,
                        background: selected.is_read
                          ? '#f8fafc'
                          : 'rgba(34,197,94,0.10)',
                        borderColor: selected.is_read
                          ? 'rgba(15,23,42,0.12)'
                          : 'rgba(34,197,94,0.22)',
                        color: selected.is_read ? '#475569' : '#16a34a',
                      }}
                    >
                      {selected.is_read ? 'Read' : 'New'}
                    </div>
                  </div>

                  <div
                    style={{
                      ...messageMetaGrid,
                      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    }}
                  >
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

                    <div
                      style={{
                        ...metaCard,
                        borderColor: detectedCode
                          ? 'rgba(34,197,94,0.24)'
                          : 'rgba(15,23,42,0.12)',
                        boxShadow: detectedCode
                          ? '0 10px 24px rgba(15,23,42,0.06), 0 0 0 1px rgba(34,197,94,0.05)'
                          : '0 8px 20px rgba(15,23,42,0.05)',
                      }}
                    >
                      <div style={sectionLabel}>Detected code</div>

                      {detectedCode ? (
                        <>
                          <div style={{ ...metaValue, fontFamily: 'monospace', fontSize: '20px', color: '#16a34a' }}>
                            {detectedCode}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyDetectedCode(detectedCode)}
                            className="action-btn"
                            style={{
                              ...codeCopyBtn,
                              color: copiedCode ? '#16a34a' : '#0f172a',
                              borderColor: copiedCode
                                ? 'rgba(34,197,94,0.28)'
                                : 'rgba(15,23,42,0.14)',
                              background: copiedCode
                                ? 'rgba(34,197,94,0.08)'
                                : '#ffffff',
                            }}
                          >
                            {copiedCode ? '✓ Copied code' : 'Copy code'}
                          </button>
                        </>
                      ) : (
                        <div style={metaSubValue}>No OTP/code detected in this email.</div>
                      )}
                    </div>
                  </div>
                </div>
              {selected.attachments && selected.attachments.length > 0 && (
  <div
    style={{
      marginBottom: '18px',
      padding: '16px',
      borderRadius: '18px',
      background: '#ffffff',
      border: '1px solid rgba(15,23,42,0.12)',
      boxShadow: '0 8px 20px rgba(15,23,42,0.05)',
    }}
  >
    <div style={{ ...sectionLabel, marginBottom: '12px' }}>
      Attachments ({selected.attachments.length})
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {selected.attachments.map((file) => {
        const isImage = file.mime_type?.startsWith('image/');
        const isPDF = file.mime_type === 'application/pdf';

        return (
          <div
  key={file.id}
  style={{
    border: '1px solid rgba(15,23,42,0.12)',
    borderRadius: '14px',
    padding: '12px',
    background: '#f8fafc',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  }}
>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                📎 {file.filename}
              </span>

              <a
                href={file.public_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '12px',
                  textDecoration: 'none',
                  color: '#4f46e5',
                  fontWeight: 600,
                }}
              >
                Download
              </a>
            </div>

            {/* Preview */}
            {isImage && (
              <img
                src={file.public_url}
                alt={file.filename}
                style={{
                  width: '100%',
                  borderRadius: '10px',
                  maxHeight: '420px',
                  objectFit: 'contain',
                  background: '#f1f5f9'
                }}
              />
            )}

            {isPDF && (
              <iframe
                src={file.public_url}
                style={{
                  width: '100%',
                  height: '300px',
                  border: 'none',
                  borderRadius: '10px',
                }}
              />
            )}

            {!isImage && !isPDF && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                {(file.size_bytes / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
                <div style={messageBodyWrap}>
                  <div style={bodyTopBar}>
                    <div style={bodyTopBarTitle}>Email content</div>
                  </div>

                  {selected.body_html ? (
                    <iframe
  title={`Email content - ${getDisplaySubject(selected)}`}
  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      style={{
                        ...messageIframe,
                        height: isMobile ? '56vh' : '68vh',
                        minHeight: isMobile ? '420px' : '560px',
                      }}
                      srcDoc={`
  <html>
    <head>
      <base target="_blank" />
      <style>
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #111111 !important;
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
          color: #4b5563 !important;
        }
        a {
          color: #7c3aed !important;
          word-break: break-all !important;
        }
      </style>
    </head>
    <body>
      ${selected.body_html}
    </body>
  </html>
`}
                    />
                  ) : (
                    <pre
                      style={{
                        ...messagePre,
                        padding: isMobile ? '18px' : '28px',
                      }}
                    >
                      {selected.body_text || '(empty email)'}
                    </pre>
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
      </div>

      {toast && (
        <div
          style={{
            ...toastStyle,
            bottom: isMobile ? '16px' : '24px',
            width: isMobile ? 'calc(100% - 24px)' : 'auto',
            maxWidth: isMobile ? '420px' : 'none',
          }}
        >
          {toast}
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
          <p style={{ color: '#64748b', marginBottom: '18px' }}>Loading...</p>
          <div style={footerWrap}>
            <a href="/terms" style={footerLink}>Terms</a>
            <a href="/privacy" style={footerLink}>Privacy</a>
            <a href="mailto:support@ghostmails.org" style={footerLink}>Contact</a>
          </div>
        </main>
      }
    >
      <InboxContent />
    </Suspense>
  );
}

/* styles */

const pageWrap = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, rgba(91,33,182,0.08), transparent 24%), var(--bg)',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: 'flex',
  flexDirection: 'column',
  color: '#0f172a',
};

const shell = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '22px 18px 30px',
};

const fallbackMain = {
  minHeight: '100vh',
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const centerWrap = {
  minHeight: '100vh',
  background: 'radial-gradient(circle at top, rgba(91,33,182,0.08), transparent 24%), var(--bg)',
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
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '24px',
  padding: '32px 28px',
  boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
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
  color: '#0f172a',
  margin: '0 0 10px',
  fontSize: '28px',
  fontWeight: 800,
};

const emptyText = {
  color: '#64748b',
  marginBottom: '18px',
  lineHeight: 1.7,
  fontSize: '14px',
};

const errorText = {
  color: '#dc2626',
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
  boxShadow: '0 10px 24px rgba(139,92,246,0.18)',
};

const secondaryLink = {
  background: '#ffffff',
  color: '#0f172a',
  padding: '11px 24px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  display: 'inline-block',
  border: '1px solid rgba(15,23,42,0.14)',
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
  color: '#64748b',
  marginTop: '14px',
  fontSize: '14px',
};

const topHeader = {
  borderBottom: '1px solid rgba(15,23,42,0.12)',
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(12px)',
  position: 'sticky',
  top: 0,
  zIndex: 50,
  boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
};

const topHeaderInner = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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
  color: '#8b5cf6',
  fontSize: '18px',
};

const brandText = {
  color: '#0f172a',
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
  border: '1px solid rgba(15,23,42,0.14)',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '13px',
  fontWeight: 700,
};

const topInfoGrid = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr',
  gap: '14px',
  marginBottom: '18px',
};

const topInfoCardWide = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '20px',
  padding: '18px',
  boxShadow: '0 10px 25px rgba(15,23,42,0.06)',
};

const topInfoCard = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '20px',
  padding: '18px',
  boxShadow: '0 10px 25px rgba(15,23,42,0.06)',
};

const topActionsCard = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '20px',
  padding: '18px',
  boxShadow: '0 10px 25px rgba(15,23,42,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const topInfoValue = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 900,
  marginTop: '8px',
};

const autoRefreshSelect = {
  width: '100%',
  marginTop: '10px',
  padding: '11px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(15,23,42,0.14)',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
  appearance: 'none',
};

const copyButtonStrong = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(15,23,42,0.14)',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
};

const codeCopyBtn = {
  marginTop: '12px',
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(15,23,42,0.14)',
  background: '#ffffff',
  fontSize: '13px',
  fontWeight: 800,
  cursor: 'pointer',
};

const sectionLabel = {
  fontSize: '11px',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontWeight: 800,
};

const addressText = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: '15px',
  color: '#0f172a',
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
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: '0 10px 25px rgba(15,23,42,0.06)',
  display: 'flex',
  flexDirection: 'column',
};

const viewerPanel = {
  flex: 1,
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '24px',
  overflow: 'hidden',
  boxShadow: '0 10px 25px rgba(15,23,42,0.06)',
  minHeight: 'calc(100vh - 290px)',
};

const sidebarHeader = {
  padding: '18px',
  borderBottom: '1px solid rgba(15,23,42,0.12)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  background: '#f8fafc',
};

const sidebarSubtext = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '6px',
};

const pillNeutral = {
  fontSize: '12px',
  color: '#0f172a',
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  borderRadius: '999px',
  padding: '7px 10px',
  whiteSpace: 'nowrap',
};

const waitingWrap = {
  padding: '44px 18px',
  textAlign: 'center',
};

const waitingTitle = {
  color: '#0f172a',
  fontWeight: 800,
  margin: '0 0 8px',
  fontSize: '15px',
};

const waitingText = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
  margin: 0,
};

const waitingAddress = {
  color: '#7c3aed',
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
  border: '1px solid rgba(15,23,42,0.12)',
  display: 'flex',
  gap: '12px',
};

const avatarCircle = {
  width: '42px',
  height: '42px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(139,92,246,0.10))',
  border: '1px solid rgba(167,139,250,0.18)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6d28d9',
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
  color: '#64748b',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
};

const unreadDot = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#8b5cf6',
  boxShadow: '0 0 10px rgba(139,92,246,0.35)',
  flexShrink: 0,
};

const emailDate = {
  fontSize: '11px',
  color: '#64748b',
  flexShrink: 0,
};

const viewerInner = {
  padding: '26px',
};

const messageHeaderCard = {
  marginBottom: '20px',
  padding: '20px',
  borderRadius: '22px',
  background: '#f8fafc',
  border: '1px solid rgba(15,23,42,0.12)',
  boxShadow: '0 10px 25px rgba(15,23,42,0.05)',
};

const messageHeaderTop = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '18px',
  flexWrap: 'wrap',
};

const messageTitle = {
  color: '#0f172a',
  fontSize: 'clamp(24px, 3vw, 32px)',
  fontWeight: 900,
  margin: '0 0 18px',
  lineHeight: 1.22,
  wordBreak: 'break-word',
  letterSpacing: '-0.03em',
};

const messageSubline = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.6,
};

const sublineDot = {
  color: '#94a3b8',
};

const messageStatusBadge = {
  fontSize: '12px',
  fontWeight: 800,
  padding: '8px 12px',
  borderRadius: '999px',
  border: '1px solid',
  whiteSpace: 'nowrap',
};

const messageMetaGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '14px',
};

const metaCard = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.12)',
  borderRadius: '18px',
  padding: '16px',
  boxShadow: '0 8px 20px rgba(15,23,42,0.05)',
};

const metaValue = {
  fontSize: '14px',
  color: '#0f172a',
  marginTop: '6px',
  wordBreak: 'break-word',
  fontWeight: 700,
  lineHeight: 1.5,
};

const metaSubValue = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '6px',
  wordBreak: 'break-word',
};

const messageBodyWrap = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.12)',
  borderRadius: '22px',
  overflow: 'hidden',
  boxShadow: '0 12px 28px rgba(15,23,42,0.06)',
};

const bodyTopBar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  borderBottom: '1px solid rgba(15,23,42,0.12)',
  background: '#f8fafc',
};

const bodyTopBarTitle = {
  color: '#0f172a',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.01em',
};

const messageIframe = {
  width: '100%',
  height: '70vh',
  minHeight: '520px',
  border: 'none',
  background: '#ffffff',
  display: 'block',
};

const messagePre = {
  color: '#0f172a',
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
  color: '#0f172a',
  fontWeight: 800,
  margin: '0 0 8px',
  fontSize: '16px',
};

const noSelectionText = {
  fontSize: '14px',
  color: '#64748b',
  margin: 0,
};

const footerWrap = {
  textAlign: 'center',
  padding: '16px',
  fontSize: '12px',
  color: '#64748b',
};

const footerLink = {
  margin: '0 8px',
  color: '#64748b',
  textDecoration: 'none',
};

const toastStyle = {
  position: 'fixed',
  bottom: '24px',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.14)',
  color: '#0f172a',
  padding: '12px 18px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 700,
  boxShadow: '0 10px 24px rgba(15,23,42,0.10)',
  zIndex: 9999,
};