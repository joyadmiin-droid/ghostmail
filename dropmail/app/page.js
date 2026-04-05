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
  const [totalEmails, setTotalEmails] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);

          const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profile?.plan && mounted) {
            setPlan(profile.plan);
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('emails')
          .select('id', { count: 'exact', head: true })
          .gte('received_at', today.toISOString());

        if (mounted && count !== null) {
          setTotalEmails(count);
        }
      } catch (err) {
        console.error('Homepage init error:', err);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.plan && mounted) {
          setPlan(profile.plan);
        }
      } else {
        setPlan('free');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function generateMailbox() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const text = await res.text();
      let data = null;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned invalid JSON');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate address');
      }

      setMailbox(data);
    } catch (err) {
      console.error('Generate mailbox error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
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

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.grid} />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>&#10022;</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href={user ? '/dashboard' : '/login'} style={{ fontWeight: '500' }}>
            {user ? 'Dashboard' : 'Sign in'}
          </a>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.tagline}>
  Temporary Email for Developers & Testing
</div>

        <h1 className={styles.headline}>
          Your inbox.
          <br />
          <span className={styles.accentLine}>Gone in minutes.</span>
        </h1>

        <p className={styles.sub}>
  Generate <strong>temporary email addresses</strong> for QA testing, development workflows, and protecting your primary inbox during testing.
</p>

        {/* TRUST LINE */}
        <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '10px' }}>
  GhostMail is designed for developers, QA teams, and individuals who need temporary email for testing workflows and privacy.
  Abuse, spam, fraudulent signups, and illegal activity are strictly prohibited.
</p>

        <p style={{ fontSize: '13px', opacity: 0.7 }}>
  Built for responsible use with automatic expiration and abuse prevention.
</p>

        {totalEmails !== null && (
          <p style={{ color: '#22c55e' }}>
            {formatCount(totalEmails)} emails received today
          </p>
        )}

        <div className={styles.card}>
          {!mailbox ? (
            <div>
              <button
                className={styles.btnPrimary}
                onClick={generateMailbox}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Generate My Address'}
              </button>

              {error && (
                <p style={{ color: '#f87171', marginTop: '12px', textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p>{mailbox.address}</p>
              <p style={{ marginTop: '8px', opacity: 0.7 }}>
                {getExpiryLabel(mailbox.expires_at)}
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
                <button onClick={() => copyAddress(mailbox.address)}>
                  {copied === mailbox.address ? 'Copied' : 'Copy'}
                </button>

                <button
                  onClick={() =>
                    (window.location.href = '/inbox?token=' + mailbox.token)
                  }
                >
                  Open Inbox
                </button>
              </div>
            </div>
          )}
        </div>

        {/* HOW IT WORKS */}
        <section style={{ marginTop: '50px' }}>
  <h3 style={{ marginBottom: '10px' }}>Responsible Use</h3>
  <p>• Software testing and QA environments</p>
  <p>• Developer workflows and debugging email flows</p>
  <p>• Temporary inboxes for testing integrations</p>
  <br />
  <p>GhostMail is not intended for bypassing platform restrictions, creating fake accounts, spam, or abusive activity.</p>
</section>

        <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '20px' }}>
          Built for developers and responsible use — not for abuse.
        </p>
      </section>

      <footer className={styles.footer}>
  <p>© 2026 GhostMail — Developer-focused email testing tool. Use responsibly.</p>
</footer>
    </main>
  );
}