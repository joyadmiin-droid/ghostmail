'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './inbox.module.css';

function InboxContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [emails, setEmails] = useState([]);
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchEmails = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/mailbox/inbox?token=${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setMailbox(data.mailbox);
      setEmails(data.emails);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetchEmails();
    const interval = setInterval(fetchEmails, 5000);
    return () => clearInterval(interval);
  }, [fetchEmails, token]);

  useEffect(() => {
    if (!mailbox?.expires_at) return;
    const tick = () => {
      const diff = new Date(mailbox.expires_at) - new Date();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [mailbox]);

  async function copyAddress() {
    if (!mailbox) return;
    await navigator.clipboard.writeText(mailbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function markRead(emailId) {
    await fetch(`/api/mailbox/read?id=${emailId}`, { method: 'POST' });
    setEmails(prev => prev.map(e => (e.id === emailId ? { ...e, is_read: true } : e)));
  }

  function openEmail(email) {
    setSelected(email);
    if (!email.is_read) markRead(email.id);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  if (!token) return (
    <main className={styles.main}>
      <div className={styles.center}>
        <div className={styles.errorBox}>
          <h2>No token found</h2>
          <p>You need a valid inbox link to access this page.</p>
          <a href="/" className={styles.homeBtn}>← Generate a new address</a>
        </div>
      </div>
    </main>
  );

  if (loading) return (
    <main className={styles.main}>
      <div className={styles.center}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Loading your inbox...</p>
      </div>
    </main>
  );

  if (error) return (
    <main className={styles.main}>
      <div className={styles.center}>
        <div className={styles.errorBox}>
          <h2>Inbox not found</h2>
          <p>This inbox may have expired or the link is invalid.</p>
          <a href="/" className={styles.homeBtn}>← Generate a new address</a>
        </div>
      </div>
    </main>
  );

  return (
    <main className={styles.main}>
      <div className={styles.grid} aria-hidden="true" />
      <header className={styles.header}>
        <a href="/" className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          <span className={styles.logoText}>GhostMail</span>
        </a>
        <div className={styles.headerRight}>
          <span className={`${styles.expiry} ${timeLeft === 'Expired' ? styles.expired : ''}`}>
            ⏱ {timeLeft || '...'}
          </span>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <div className={styles.addressBar}>
            <div className={styles.addressInfo}>
              <span className={styles.addressLabel}>Your address</span>
              <span className={styles.addressText}>{mailbox?.address}</span>
            </div>
            <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={copyAddress}>
              {copied ? '✓' : 'Copy'}
            </button>
          </div>

          <div className={styles.emailList}>
            <div className={styles.listHeader}>
              <span>Inbox</span>
              <span className={styles.count}>{emails.length} email{emails.length !== 1 ? 's' : ''}</span>
            </div>

            {emails.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📭</div>
                <p className={styles.emptyTitle}>Waiting for emails...</p>
                <p className={styles.emptySub}>Send something to <strong>{mailbox?.address}</strong> and it will appear here automatically.</p>
              </div>
            ) : (
              emails.map(email => (
                <div
                  key={email.id}
                  className={`${styles.emailItem} ${selected?.id === email.id ? styles.active : ''} ${!email.is_read ? styles.unread : ''}`}
                  onClick={() => openEmail(email)}
                >
                  <div className={styles.emailFrom}>
                    <span className={styles.fromName}>{email.from_name || email.from_address}</span>
                    {!email.is_read && <span className={styles.unreadDot} />}
                  </div>
                  <div className={styles.emailSubject}>{email.subject || '(no subject)'}</div>
                  <div className={styles.emailTime}>{formatTime(email.received_at)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.viewer}>
          {selected ? (
            <div className={styles.emailView}>
              <div className={styles.emailHeader}>
                <h2 className={styles.emailTitle}>{selected.subject || '(no subject)'}</h2>
                <div className={styles.emailMeta}>
                  <span>From: <strong>{selected.from_name || selected.from_address}</strong></span>
                  <span>{formatTime(selected.received_at)}</span>
                </div>
              </div>
              <div className={styles.emailBody}>
                {selected.body_html ? (
                  <iframe
  srcDoc={`
    <style>
      html, body, div, table, td, th, p, span, a, strong, em, h1, h2, h3, h4, h5, h6, ul, li, ol, blockquote, pre, center * {
        background-color: #0a0a0f !important;
        color: #e8e6df !important;
      }
      * {
        box-sizing: border-box;
        background-color: #0a0a0f !important;
        color: #e8e6df !important;
      }
      body {
        font-family: 'DM Sans', sans-serif !important;
        padding: 24px !important;
        margin: 0 !important;
        line-height: 1.6 !important;
        background: #0a0a0f !important;
      }
      a { color: #a78bfa !important; }
      img { max-width: 100% !important; height: auto !important; }
    </style>
    ${selected.body_html}
  `}
  className={styles.emailFrame}
  sandbox="allow-same-origin"
  title="Email content"
/>
                ) : (
                  <pre className={styles.emailText}>{selected.body_text || '(empty email)'}</pre>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.viewerEmpty}>
              <div className={styles.viewerEmptyIcon}>✉️</div>
              <p>Select an email to read it</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <main style={{minHeight:'100vh',background:'#080010',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <p style={{color:'#6b6b7a',fontFamily:'sans-serif'}}>Loading...</p>
      </main>
    }>
      <InboxContent />
    </Suspense>
  );
}