'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import styles from './page.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [plan, setPlan] = useState('free');
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [totalEmails, setTotalEmails] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .single();
        if (profile) setPlan(profile.plan);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('emails')
        .select('id', { count: 'exact' })
        .gte('received_at', today.toISOString());
      if (count !== null) setTotalEmails(count);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .single();
        if (profile) setPlan(profile.plan);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleUpgrade(planName) {
    setUpgradeLoading(true);
    setUpgradeError('');
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      setUpgradeError(err.message);
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function generateMailbox() {
  setLoading(true);
  setError(null);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const { data: { session } } = await supabase.auth.getSession();

    const headers = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = 'Bearer ' + session.access_token;
    }

    const res = await fetch('/api/mailbox/create', {
      method: 'POST',
      headers,
      signal: controller.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate address');
    }

    setMailbox(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      setError('Request timed out. Please try again.');
    } else {
      setError(err.message || 'Something went wrong');
    }
  } finally {
    clearTimeout(timeout);
    setLoading(false);
  }
}

  async function copyAddress(addr) {
    await navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  }

  function getExpiryLabel(expiresAt) {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const mins = Math.round(diff / 60000);
    if (mins > 60 * 24) return Math.round(mins / 60 / 24) + 'd left';
    if (mins > 60) return Math.round(mins / 60) + 'h left';
    return mins + 'm left';
  }

  function formatCount(n) {
    if (n === null) return '...';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  const faqs = [
    { q: 'Is GhostMail really free?', a: 'Yes — the Ghost plan is free. Paid plans unlock longer lifespans and more addresses.' },
    { q: 'How long does a temp email address last?', a: 'Free plan: 10 minutes. Paid plans extend lifespan.' },
    { q: 'Can I receive emails?', a: 'Yes — real working email addresses for testing and verification.' },
    { q: 'Is GhostMail safe?', a: 'Yes. Designed for privacy and responsible use with abuse prevention systems.' },
  ];

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.grid} />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>&#10022;</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/dashboard">Dashboard</a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.tagline}>
          Temporary email for testing & privacy
        </div>

        <h1 className={styles.headline}>
          Your inbox.<br />
          <span className={styles.accentLine}>Gone in minutes.</span>
        </h1>

        <p className={styles.sub}>
          Generate <strong>temporary email addresses</strong> instantly.
          Perfect for developers, QA testing, and protecting your inbox from spam.
          <br /><br />
          Automatically deleted after expiration. Built for responsible use with abuse prevention.
        </p>

        {totalEmails && (
          <p style={{ color: '#22c55e' }}>
            {formatCount(totalEmails)} emails received today
          </p>
        )}

        <div className={styles.card}>
          {!mailbox ? (
            <button className={styles.btnPrimary} onClick={generateMailbox}>
              {loading ? 'Loading...' : 'Generate My Address'}
            </button>
          ) : (
            <div>
              <p>{mailbox.address}</p>
              <button onClick={() => copyAddress(mailbox.address)}>Copy</button>
              <button onClick={() => window.location.href = '/inbox?token=' + mailbox.token}>
                Open Inbox
              </button>
            </div>
          )}
        </div>

        <p style={{ fontSize: '12px', opacity: 0.6 }}>
          Built for developers and responsible use — not for abuse.
        </p>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 GhostMail — Privacy-focused. Secure. Responsible use.</p>
      </footer>
    </main>
  );
}