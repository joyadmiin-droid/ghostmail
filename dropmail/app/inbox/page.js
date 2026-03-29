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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session?.user);
      } catch (e) {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  const fetchEmails = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/mailbox/inbox?token=' + token);
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
    if (!token) { setLoading(false); return; }
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
      setTimeLeft(m + ':' + s.toString().padStart(2, '0'));
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
    await fetch('/api/mailbox/read?id=' + emailId, { method: 'POST' });
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: true } : e));
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
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return d.toLocaleDateString();
  }

  // Free users only see 1 email
  const visibleEmails = isLoggedIn ? emails : emails.slice(0, 1);
  const hasHiddenEmails = !isLoggedIn && emails.length > 1;
  const isExpiringSoon = mailbox && new Date(mailbox.expires_at) < new Date(Date.now() + 2 * 60 * 1000);

  if (!token) return (
    <main style={{ minHeight: '100vh', background: '#080010', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128274;</div>
        <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>No inbox link found</h2>
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>You need a valid inbox link to access this page.</p>
        <a href="/" style={{ background: '#a78bfa', color: '#fff', padding: '10px 24px', borderRadius: '99px', textDecoration: 'none', fontWeight: '600' }}>Generate a new address</a>
      </div>
    </main>
  );

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#080010', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(167,139,250,0.2)', borderTop: '3px solid #a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: '#666' }}>Loading your inbox...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );

  if (error) return (
    <main style={{ minHeight: '100vh', background: '#080010', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128420;</div>
        <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Inbox not found</h2>
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>This inbox may have expired or the link is invalid.</p>
        <a href="/" style={{ background: '#a78bfa', color: '#fff', padding: '10px 24px', borderRadius: '99px', textDecoration: 'none', fontWeight: '600' }}>Generate a new address</a>
      </div>
    </main>
  );

  return (
    <main style={{ minHeight: '100vh', background: '#080010', fontFamily: 'inherit', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing: border-box; }
      `}</style>

      {/* HEADER */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,0,16,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ color: '#a78bfa', fontSize: '18px' }}>&#10022;</span>
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>GhostMail</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {timeLeft && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isExpiringSoon ? 'rgba(248,113,113,0.1)' : 'rgba(167,139,250,0.1)', border: '1px solid ' + (isExpiringSoon ? 'rgba(248,113,113,0.3)' : 'rgba(167,139,250,0.3)'), borderRadius: '999px', padding: '4px 12px' }}>
              <span style={{ fontSize: '12px', animation: isExpiringSoon ? 'pulse 1s infinite' : 'none' }}>&#9203;</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: isExpiringSoon ? '#f87171' : '#c4b5fd', fontFamily: 'monospace' }}>{timeLeft}</span>
            </div>
          )}
          {!isLoggedIn && (
            <a href="/login" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '6px 14px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Sign in</a>
          )}
        </div>
      </header>

      {/* ADDRESS BAR */}
      <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Your address</div>
          <div style={{ fontFamily: 'monospace', fontSize: '15px', color: '#a78bfa', fontWeight: '600' }}>{mailbox?.address}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={copyAddress} style={{ padding: '7px 16px', borderRadius: '8px', border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(167,139,250,0.3)', background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(167,139,250,0.1)', color: copied ? '#22c55e' : '#a78bfa', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            {copied ? '&#10003; Copied' : 'Copy'}
          </button>
          <a href="/" style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: '#888', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            New address
          </a>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 130px)' }}>

        {/* EMAIL LIST */}
        <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', background: '#080010' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600' }}>Inbox</span>
            <span style={{ fontSize: '11px', color: '#555' }}>{emails.length} email{emails.length !== 1 ? 's' : ''}</span>
          </div>

          {emails.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>&#128205;</div>
              <p style={{ color: '#fff', fontWeight: '600', marginBottom: '0.4rem', fontSize: '14px' }}>Waiting for emails...</p>
              <p style={{ color: '#555', fontSize: '12px', lineHeight: '1.6' }}>
                Send something to <span style={{ color: '#a78bfa' }}>{mailbox?.address}</span> and it will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              {visibleEmails.map(email => (
                <div
                  key={email.id}
                  onClick={() => openEmail(email)}
                  style={{
                    padding: '14px 16px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: selected?.id === email.id ? 'rgba(167,139,250,0.08)' : 'transparent',
                    borderLeft: selected?.id === email.id ? '2px solid #a78bfa' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: email.is_read ? '500' : '700', color: email.is_read ? '#888' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {email.from_name || email.from_address}
                    </span>
                    {!email.is_read && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#a78bfa', flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                    {email.subject || '(no subject)'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#444' }}>{formatTime(email.received_at)}</div>
                </div>
              ))}

              {/* ✅ UPSELL for free users with more than 1 email */}
              {hasHiddenEmails && (
                <div style={{ margin: '12px', padding: '16px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>&#128274;</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
                    {emails.length - 1} more email{emails.length - 1 !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px', lineHeight: '1.5' }}>
                    Sign up free to unlock all emails, longer addresses and more.
                  </div>
                  <a href="/login" style={{ display: 'block', background: '#a78bfa', color: '#fff', padding: '8px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '700' }}>
                    Sign up free &#8594;
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* EMAIL VIEWER */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#080010' }}>
          {selected ? (
            <div style={{ padding: '2rem', maxWidth: '760px' }}>
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h2 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: '700', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                  {selected.subject || '(no subject)'}
                </h2>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>From</span>
                    <div style={{ fontSize: '13px', color: '#a78bfa', marginTop: '2px' }}>{selected.from_name || selected.from_address}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Received</span>
                    <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>{formatTime(selected.received_at)}</div>
                  </div>
                </div>
              </div>
              <div>
                {selected.body_html ? (
                  <iframe
                    srcDoc={'<style>@import url(\'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap\');html,body,div,table,td,th,p,span,a,strong,em,h1,h2,h3,h4,h5,h6,ul,li,ol,blockquote,pre,center,*{background-color:#0a0a0f!important;color:#e8e6df!important;font-family:\'DM Sans\',sans-serif!important}body{padding:32px 40px!important;margin:0!important;line-height:1.8!important;font-size:16px!important;background:#0a0a0f!important}p{font-size:16px!important;line-height:1.8!important;margin-bottom:16px!important}h1,h2,h3{font-size:22px!important;font-weight:600!important;margin-bottom:16px!important;color:#ffffff!important}a{color:#a78bfa!important;text-decoration:underline!important}img{max-width:100%!important;height:auto!important;border-radius:8px!important}hr{border:none!important;border-top:1px solid rgba(255,255,255,0.08)!important;margin:24px 0!important}blockquote{border-left:3px solid #a78bfa!important;padding-left:16px!important;margin:16px 0!important;color:#9b99b0!important}</style>' + selected.body_html}
                    style={{ width: '100%', height: '500px', border: 'none', borderRadius: '12px', background: '#0a0a0f' }}
                    sandbox="allow-same-origin"
                    title="Email content"
                  />
                ) : (
                  <pre style={{ color: '#ccc', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {selected.body_text || '(empty email)'}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: '0.3' }}>&#9993;</div>
              <p style={{ fontSize: '14px' }}>Select an email to read it</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM UPSELL BAR for free users */}
      {!isLoggedIn && (
        <div style={{ borderTop: '1px solid rgba(167,139,250,0.2)', background: 'rgba(167,139,250,0.05)', padding: '12px 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: '#888' }}>
            &#128123; <span style={{ color: '#c4b5fd', fontWeight: '600' }}>Free plan</span> — addresses expire in 10 min. Sign up for 24hr or permanent addresses.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <a href="/login" style={{ background: '#a78bfa', color: '#fff', padding: '7px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
              Sign up free
            </a>
            <a href="/login" style={{ background: 'none', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', padding: '7px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
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
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#080010', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b6b7a', fontFamily: 'sans-serif' }}>Loading...</p>
      </main>
    }>
      <InboxContent />
    </Suspense>
  );
}
