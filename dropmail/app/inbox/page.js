'use client';

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function GhostLogo({ style = {} }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <path
        d="M64 14C42.46 14 25 31.46 25 53V89.5C25 96.404 30.596 102 37.5 102C42.984 102 47.642 98.465 49.349 93.55C50.811 98.634 55.499 102.35 61.12 102.35C66.77 102.35 71.477 98.595 72.912 93.469C74.603 98.425 79.278 102 84.8 102C91.711 102 97.314 96.397 97.314 89.486V53C97.314 31.46 79.854 14 58.314 14H64Z"
        fill="white"
      />
      <path
        d="M64 14C42.46 14 25 31.46 25 53V89.5C25 96.404 30.596 102 37.5 102C42.984 102 47.642 98.465 49.349 93.55C50.811 98.634 55.499 102.35 61.12 102.35C66.77 102.35 71.477 98.595 72.912 93.469C74.603 98.425 79.278 102 84.8 102C91.711 102 97.314 96.397 97.314 89.486V53C97.314 31.46 79.854 14 58.314 14H64Z"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinejoin="round"
      />
      <circle cx="49.5" cy="50.5" r="5.8" fill="#1F1840" />
      <circle cx="77.5" cy="50.5" r="5.8" fill="#1F1840" />
      <path
        d="M52 69C58 75 69 75 75 69"
        stroke="#1F1840"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InboxContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [emails, setEmails] = useState([]);
  const [mailbox, setMailbox] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(0);
  const [mailboxExpired, setMailboxExpired] = useState(false);
  const [attachmentBlobUrls, setAttachmentBlobUrls] = useState({});

  const hasCleanedExpiredMailbox = useRef(false);
  const attachmentBlobUrlsRef = useRef({});
  const fetchInProgressRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const rateLimitedUntilRef = useRef(0);

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

  const revokeAttachmentUrls = useCallback((map) => {
    Object.values(map || {}).forEach((entry) => {
      if (entry?.objectUrl) {
        try {
          URL.revokeObjectURL(entry.objectUrl);
        } catch {}
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      revokeAttachmentUrls(attachmentBlobUrlsRef.current);
    };
  }, [revokeAttachmentUrls]);

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

  const fetchAttachmentBlob = useCallback(async (file) => {
    if (!file?.id || !file?.public_url) {
      throw new Error('Missing attachment URL');
    }

    const existing = attachmentBlobUrlsRef.current[file.id];
    if (existing?.objectUrl) return existing.objectUrl;

    setAttachmentBlobUrls((prev) => {
      const next = {
        ...prev,
        [file.id]: {
          ...prev[file.id],
          loading: true,
          error: null,
        },
      };
      attachmentBlobUrlsRef.current = next;
      return next;
    });

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error('Please log in again to open attachments.');
    }

    const response = await fetch(file.public_url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('Attachment fetch failed:', response.status, text);
      throw new Error('Failed to fetch attachment');
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);

    setAttachmentBlobUrls((prev) => {
      const next = {
        ...prev,
        [file.id]: {
          objectUrl,
          loading: false,
          error: null,
        },
      };
      attachmentBlobUrlsRef.current = next;
      return next;
    });

    return objectUrl;
  }, []);

  const openAttachment = useCallback(
    async (file) => {
      try {
        const objectUrl = await fetchAttachmentBlob(file);
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('Open attachment error:', err);
        alert(err.message || 'Failed to open attachment.');
      }
    },
    [fetchAttachmentBlob]
  );

  const downloadAttachment = useCallback(
    async (file) => {
      try {
        const objectUrl = await fetchAttachmentBlob(file);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = file.filename || 'download';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        console.error('Download attachment error:', err);
        alert(err.message || 'Failed to download attachment.');
      }
    },
    [fetchAttachmentBlob]
  );

  useEffect(() => {
    const previousMap = attachmentBlobUrlsRef.current;
    revokeAttachmentUrls(previousMap);
    attachmentBlobUrlsRef.current = {};
    setAttachmentBlobUrls({});

    const attachments = selected?.attachments || [];
    if (!attachments.length || !isLoggedIn) return;

    let cancelled = false;

    async function preloadAttachments() {
      for (const file of attachments) {
        const isPreviewable =
          file?.mime_type?.startsWith('image/') || file?.mime_type === 'application/pdf';

        if (!isPreviewable) continue;

        try {
          if (cancelled) return;
          await fetchAttachmentBlob(file);
        } catch (err) {
          if (cancelled) return;

          setAttachmentBlobUrls((prev) => {
            const next = {
              ...prev,
              [file.id]: {
                ...(prev[file.id] || {}),
                loading: false,
                error: 'Preview unavailable',
              },
            };
            attachmentBlobUrlsRef.current = next;
            return next;
          });
        }
      }
    }

    preloadAttachments();

    return () => {
      cancelled = true;
    };
  }, [selected?.id, isLoggedIn, fetchAttachmentBlob, revokeAttachmentUrls]);

  const fetchEmails = useCallback(
    async (showRefreshState = false) => {const fetchEmails = useCallback(
  async (showRefreshState = false) => {
    const now = Date.now();

    if (fetchInProgressRef.current) return;

    if (rateLimitedUntilRef.current && now < rateLimitedUntilRef.current) {
      setErrorType('rate_limit');
      setError('Please wait a bit before trying again.');
      setLoading(false);
      return;
    }

    if (showRefreshState && now - lastFetchAtRef.current < 10000) {
      showToast('Please wait 10 seconds before refreshing again');
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchAtRef.current = now;

    if (!token || !isLoggedIn) {
      setLoading(false);
      return;
    }
      if (!token || !isLoggedIn) {
        setLoading(false);
        return;
      }

      if (showRefreshState) setRefreshing(true);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers = {};
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

        const res = await fetch('/api/mailbox/inbox?token=' + encodeURIComponent(token), {
          headers,
        });

        const data = await res.json().catch(() => ({}));
        const message = data?.error || 'Failed to load inbox';

        if (!res.ok) {
          if (res.status === 404 && message.toLowerCase().includes('expired')) {
            setMailboxExpired(true);
            setErrorType('expired');
            setError('This inbox has expired.');
            if (mailbox?.id) await cleanupExpiredMailbox(mailbox.id);
            return;
          }

          if (res.status === 429) {
  rateLimitedUntilRef.current = Date.now() + 60 * 1000; // 1 min block
  setErrorType('rate_limit');
  setError('Too many refreshes. Please wait 1 minute.');
  return;
}

          if (res.status === 401) {
            setErrorType('auth');
            setError(message);
            return;
          }

          if (res.status === 404) {
            setErrorType('not_found');
            setError(message);
            return;
          }

          setErrorType('generic');
          setError(message);
          return;
        }

        const nextMailbox = data.mailbox || null;
        const nextEmails = data.emails || [];

        if (nextMailbox?.expires_at && new Date(nextMailbox.expires_at) <= new Date()) {
          setMailbox(nextMailbox);
          setEmails([]);
          setMailboxExpired(true);
          setErrorType('expired');
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
        setErrorType(null);

        setSelected((prev) => {
          if (!nextEmails.length) return null;
          if (!prev) return nextEmails[0];
          const stillExists = nextEmails.find((e) => e.id === prev.id);
          return stillExists || nextEmails[0];
        });
      } catch (err) {
        setErrorType('generic');
        setError(err.message || 'Failed to load inbox');
      } finally {
  fetchInProgressRef.current = false;
  setLoading(false);
  setRefreshing(false);
}
    },
    [token, isLoggedIn, cleanupExpiredMailbox, mailbox?.id]
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
        setErrorType('expired');
        setError('This inbox has expired.');
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {};
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      await fetch('/api/mailbox/read?id=' + emailId, {
        method: 'POST',
        headers,
      });

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
    if (!email.is_read) markRead(email.id);
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

  if (mailboxExpired || errorType === 'expired') {
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

  if (error && errorType) {
    return (
      <main style={centerWrap}>
        <div style={emptyCard}>
          <div style={emptyIcon}>
            {errorType === 'rate_limit' ? '⏳' : errorType === 'auth' ? '🔐' : '⚠️'}
          </div>
          <h2 style={emptyTitle}>
            {errorType === 'rate_limit'
              ? 'Too many requests'
              : errorType === 'auth'
              ? 'Authentication required'
              : errorType === 'not_found'
              ? 'Inbox not found'
              : 'Could not open inbox'}
          </h2>
          <p style={emptyText}>
            {errorType === 'rate_limit'
              ? 'Please wait a bit, then try again.'
              : errorType === 'auth'
              ? 'Please sign in again to continue.'
              : errorType === 'not_found'
              ? 'This inbox could not be found.'
              : 'Something went wrong while loading this inbox.'}
          </p>
          <p style={errorText}>{error}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fetchEmails(true)}
              style={{ ...primaryLink, border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
            <a href="/dashboard" style={secondaryLink}>Back to dashboard</a>
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
          background: #faf9ff !important;
          border-color: rgba(109,73,255,0.18) !important;
          box-shadow: 0 10px 24px rgba(109,73,255,0.08) !important;
        }

        .action-btn {
          transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(109,73,255,0.18) !important;
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
            <GhostLogo style={{ width: 28, height: 28, color: '#6d49ff', flexShrink: 0 }} />
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
                    : 'rgba(109,73,255,0.08)',
                  borderColor: isExpiringSoon
                    ? 'rgba(248,113,113,0.28)'
                    : 'rgba(109,73,255,0.20)',
                }}
              >
                <span style={{ animation: isExpiringSoon ? 'pulse 1s infinite' : 'none' }}>⏳</span>
                <span
                  style={{
                    color: isExpiringSoon ? '#dc2626' : '#1a1531',
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
                  if (!error) showToast('Inbox updated');
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
              <option value={60}>1 min</option>
              <option value={120}>2 min</option>
              <option value={300}>5 min</option> 
            </select>
          </div>

          <div style={topActionsCard}>
            <button
              type="button"
              onClick={copyAddress}
              className="action-btn"
              style={{
                ...copyButtonStrong,
                borderColor: copied ? 'rgba(34,197,94,0.24)' : 'rgba(15,23,42,0.10)',
                color: copied ? '#16a34a' : '#1a1531',
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

              {emails.length > 0 && <div style={pillNeutral}>{unreadCount} unread</div>}
            </div>

            {emails.length === 0 ? (
              <div style={waitingWrap}>
                <div style={emptyIconSmall}>📭</div>
                <p style={waitingTitle}>Waiting for emails...</p>
                <p style={waitingText}>
                  Send something to <span style={waitingAddress}>{mailbox?.address}</span> then press refresh.
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
                        background: active ? '#f3efff' : '#ffffff',
                        borderColor: active ? 'rgba(109,73,255,0.24)' : 'rgba(15,23,42,0.10)',
                        boxShadow: active
                          ? '0 0 0 1px rgba(109,73,255,0.05) inset, 0 10px 22px rgba(109,73,255,0.10)'
                          : '0 6px 16px rgba(15,23,42,0.05)',
                      }}
                    >
                      <div style={avatarCircle}>{getInitials(email)}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={emailRowTop}>
                          <span
                            style={{
                              ...senderText,
                              color: email.is_read ? '#475569' : '#1a1531',
                              fontWeight: email.is_read ? 700 : 800,
                            }}
                          >
                            {email.from_name || email.from_address}
                          </span>

                          <span style={emailDate}>{formatTime(email.received_at)}</span>
                        </div>

                        <div style={emailSubject}>{getDisplaySubject(email)}</div>

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
                        background: selected.is_read ? '#f8fafc' : 'rgba(34,197,94,0.10)',
                        borderColor: selected.is_read ? 'rgba(15,23,42,0.10)' : 'rgba(34,197,94,0.22)',
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
                        borderColor: detectedCode ? 'rgba(34,197,94,0.24)' : 'rgba(15,23,42,0.10)',
                        boxShadow: detectedCode
                          ? '0 10px 24px rgba(15,23,42,0.05), 0 0 0 1px rgba(34,197,94,0.04)'
                          : '0 8px 20px rgba(15,23,42,0.05)',
                      }}
                    >
                      <div style={sectionLabel}>Detected code</div>

                      {detectedCode ? (
                        <>
                          <div
                            style={{
                              ...metaValue,
                              fontFamily: 'monospace',
                              fontSize: '20px',
                              color: '#16a34a',
                            }}
                          >
                            {detectedCode}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyDetectedCode(detectedCode)}
                            className="action-btn"
                            style={{
                              ...codeCopyBtn,
                              color: copiedCode ? '#16a34a' : '#1a1531',
                              borderColor: copiedCode ? 'rgba(34,197,94,0.24)' : 'rgba(15,23,42,0.10)',
                              background: copiedCode ? 'rgba(34,197,94,0.08)' : '#ffffff',
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
                  <div style={attachmentsWrap}>
                    <div style={{ ...sectionLabel, marginBottom: '12px' }}>
                      Attachments ({selected.attachments.length})
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {selected.attachments.map((file) => {
                        const isImage = file.mime_type?.startsWith('image/');
                        const isPDF = file.mime_type === 'application/pdf';
                        const fileState = attachmentBlobUrls[file.id] || {};
                        const previewUrl = fileState.objectUrl;
                        const previewLoading = !!fileState.loading;
                        const previewError = fileState.error;

                        return (
                          <div key={file.id} style={attachmentCard}>
                            <div style={attachmentHeader}>
                              <span style={attachmentFileName}>📎 {file.filename}</span>

                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => openAttachment(file)}
                                  className="action-btn"
                                  style={attachmentActionBtn}
                                >
                                  Open
                                </button>

                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(file)}
                                  className="action-btn"
                                  style={attachmentActionBtn}
                                >
                                  Download
                                </button>
                              </div>
                            </div>

                            {previewLoading && (isImage || isPDF) && (
                              <div style={attachmentInfoText}>Loading preview...</div>
                            )}

                            {previewError && (isImage || isPDF) && (
                              <div style={{ ...attachmentInfoText, color: '#dc2626' }}>
                                {previewError}
                              </div>
                            )}

                            {isImage && previewUrl && (
                              <img
                                src={previewUrl}
                                alt={file.filename}
                                style={attachmentImage}
                              />
                            )}

                            {isPDF && previewUrl && (
                              <iframe
                                src={previewUrl}
                                style={attachmentPdf}
                              />
                            )}

                            {!isImage && !isPDF && (
                              <div style={attachmentInfoText}>
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
          border-left: 3px solid rgba(109,73,255,0.35) !important;
          color: #4b5563 !important;
        }
        a {
          color: #6d49ff !important;
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
  background: 'linear-gradient(180deg, rgba(109,73,255,0.04) 0%, rgba(109,73,255,0.015) 20%, transparent 46%), #f6f4ff',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: 'flex',
  flexDirection: 'column',
  color: '#1a1531',
};

const shell = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '22px 18px 30px',
};

const fallbackMain = {
  minHeight: '100vh',
  background: '#f6f4ff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const centerWrap = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, rgba(109,73,255,0.04) 0%, rgba(109,73,255,0.015) 20%, transparent 46%), #f6f4ff',
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
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '28px',
  padding: '34px 28px',
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
  color: '#14122b',
  margin: '0 0 10px',
  fontSize: '28px',
  fontWeight: 800,
};

const emptyText = {
  color: '#5d647a',
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
  background: 'linear-gradient(135deg, #6d49ff, #d946b2)',
  color: '#fff',
  padding: '12px 24px',
  borderRadius: '14px',
  textDecoration: 'none',
  fontWeight: 800,
  display: 'inline-block',
  boxShadow: '0 12px 26px rgba(109,73,255,0.18)',
};

const secondaryLink = {
  background: '#ffffff',
  color: '#14122b',
  padding: '12px 24px',
  borderRadius: '14px',
  textDecoration: 'none',
  fontWeight: 800,
  display: 'inline-block',
  border: '1px solid rgba(15,23,42,0.10)',
};

const spinner = {
  width: '34px',
  height: '34px',
  border: '3px solid rgba(109,73,255,0.18)',
  borderTop: '3px solid #6d49ff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  margin: '0 auto',
};

const loadingText = {
  color: '#5d647a',
  marginTop: '14px',
  fontSize: '14px',
};

const topHeader = {
  borderBottom: '1px solid rgba(15,23,42,0.08)',
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

const brandText = {
  color: '#14122b',
  fontSize: '18px',
  fontWeight: 800,
  letterSpacing: '-0.03em',
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
  padding: '7px 12px',
  fontSize: '13px',
};

const ghostButton = {
  padding: '10px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(15,23,42,0.10)',
  background: '#ffffff',
  color: '#14122b',
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
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '22px',
  padding: '18px',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
};

const topInfoCard = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '22px',
  padding: '18px',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
};

const topActionsCard = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '22px',
  padding: '18px',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const topInfoValue = {
  color: '#14122b',
  fontSize: '24px',
  fontWeight: 900,
  marginTop: '8px',
};

const autoRefreshSelect = {
  width: '100%',
  marginTop: '10px',
  padding: '11px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(15,23,42,0.10)',
  background: '#ffffff',
  color: '#14122b',
  fontSize: '14px',
  fontWeight: 700,
  outline: 'none',
  appearance: 'none',
};

const copyButtonStrong = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid rgba(15,23,42,0.10)',
  background: '#ffffff',
  color: '#14122b',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
};

const codeCopyBtn = {
  marginTop: '12px',
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(15,23,42,0.10)',
  background: '#ffffff',
  fontSize: '13px',
  fontWeight: 800,
  cursor: 'pointer',
};

const attachmentActionBtn = {
  padding: '8px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(15,23,42,0.10)',
  background: '#ffffff',
  color: '#4f46e5',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const attachmentInfoText = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '6px',
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
  color: '#14122b',
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
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '26px',
  overflow: 'hidden',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
  display: 'flex',
  flexDirection: 'column',
};

const viewerPanel = {
  flex: 1,
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '26px',
  overflow: 'hidden',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
  minHeight: 'calc(100vh - 290px)',
};

const sidebarHeader = {
  padding: '18px',
  borderBottom: '1px solid rgba(15,23,42,0.10)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  background: '#faf9ff',
};

const sidebarSubtext = {
  fontSize: '12px',
  color: '#64748b',
  marginTop: '6px',
};

const pillNeutral = {
  fontSize: '12px',
  color: '#14122b',
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '999px',
  padding: '7px 10px',
  whiteSpace: 'nowrap',
};

const waitingWrap = {
  padding: '44px 18px',
  textAlign: 'center',
};

const waitingTitle = {
  color: '#14122b',
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
  color: '#6d49ff',
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
  border: '1px solid rgba(15,23,42,0.10)',
  display: 'flex',
  gap: '12px',
};

const avatarCircle = {
  width: '42px',
  height: '42px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, rgba(109,73,255,0.14), rgba(217,70,178,0.08))',
  border: '1px solid rgba(109,73,255,0.16)',
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
  color: '#14122b',
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
  background: '#6d49ff',
  boxShadow: '0 0 10px rgba(109,73,255,0.25)',
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
  background: '#faf9ff',
  border: '1px solid rgba(15,23,42,0.10)',
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
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
  color: '#14122b',
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
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '18px',
  padding: '16px',
  boxShadow: '0 8px 20px rgba(15,23,42,0.05)',
};

const metaValue = {
  fontSize: '14px',
  color: '#14122b',
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

const attachmentsWrap = {
  marginBottom: '18px',
  padding: '16px',
  borderRadius: '20px',
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.10)',
  boxShadow: '0 8px 20px rgba(15,23,42,0.05)',
};

const attachmentCard = {
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '14px',
  padding: '12px',
  background: '#fafbff',
};

const attachmentHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '8px',
  flexWrap: 'wrap',
};

const attachmentFileName = {
  fontWeight: 700,
  fontSize: '13px',
  wordBreak: 'break-word',
};

const attachmentImage = {
  width: '100%',
  borderRadius: '10px',
  maxHeight: '420px',
  objectFit: 'contain',
  background: '#f1f5f9',
};

const attachmentPdf = {
  width: '100%',
  height: '300px',
  border: 'none',
  borderRadius: '10px',
};

const messageBodyWrap = {
  background: '#ffffff',
  border: '1px solid rgba(15,23,42,0.10)',
  borderRadius: '22px',
  overflow: 'hidden',
  boxShadow: '0 12px 28px rgba(15,23,42,0.05)',
};

const bodyTopBar = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px',
  borderBottom: '1px solid rgba(15,23,42,0.10)',
  background: '#faf9ff',
};

const bodyTopBarTitle = {
  color: '#14122b',
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
  color: '#14122b',
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
  color: '#14122b',
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
  border: '1px solid rgba(109,73,255,0.14)',
  color: '#14122b',
  padding: '12px 18px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 700,
  boxShadow: '0 10px 24px rgba(15,23,42,0.10)',
  zIndex: 9999,
};