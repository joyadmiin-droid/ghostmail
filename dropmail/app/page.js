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

        <div className={styles.navLinks}>
          <a href="/about">About</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a
            href={user ? '/dashboard' : '/login'}
            className={styles.navCta}
          >
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
          Generate <strong>temporary email addresses</strong> for QA testing,
          development workflows, and protecting your primary inbox during testing.
        </p>

        <p className={styles.trustLine}>
          GhostMail is designed for developers, QA teams, and individuals who need temporary email for testing workflows and privacy.
          Abuse, spam, fraudulent signups, and illegal activity are strictly prohibited.
        </p>

        <p className={styles.helperLine}>
          Built for responsible use with automatic expiration and abuse prevention.
        </p>

        {totalEmails !== null && (
          <p className={styles.liveStat}>
            {formatCount(totalEmails)} emails received today
          </p>
        )}

        <div className={styles.card}>
          {!mailbox ? (
            <div className={styles.cardInner}>
              <button
                className={styles.btnPrimary}
                onClick={generateMailbox}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Generating...
                  </>
                ) : (
                  'Generate My Address'
                )}
              </button>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <p className={styles.tokenNote}>
                Fast, temporary inboxes for development and testing.
              </p>
            </div>
          ) : (
            <div className={styles.cardInner}>
              <div className={styles.addressRow}>
                <span className={styles.addressLabel}>Your temporary inbox</span>

                <div className={styles.addressBox}>
                  <span className={styles.addressText}>{mailbox.address}</span>

                  <button
                    onClick={() => copyAddress(mailbox.address)}
                    className={`${styles.copyBtn} ${copied === mailbox.address ? styles.copied : ''}`}
                    type="button"
                  >
                    {copied === mailbox.address ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className={styles.metaRow}>
                <span className={styles.activePill}>● Active</span>
                <span className={styles.expiryText}>
                  {getExpiryLabel(mailbox.expires_at)}
                </span>
              </div>

              <div className={styles.actionRow}>
                <a
                  href={`/inbox?token=${mailbox.token}`}
                  className={`${styles.btnSecondary} ${styles.linkButton}`}
                >
                  Open Inbox
                </a>

                <button
                  onClick={generateMailbox}
                  className={styles.btnSecondary}
                  type="button"
                >
                  New Address
                </button>
              </div>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <p className={styles.tokenNote}>
                Bookmark your inbox link if you want quick access before expiry.
              </p>
            </div>
          )}
        </div>

        <section className={styles.responsibleSection}>
          <h3 className={styles.responsibleTitle}>Responsible Use</h3>
          <p className={styles.responsibleItem}>• Software testing and QA environments</p>
          <p className={styles.responsibleItem}>• Developer workflows and debugging email flows</p>
          <p className={styles.responsibleItem}>• Temporary inboxes for testing integrations</p>
          <p className={styles.responsibleNote}>
            GhostMail is not intended for bypassing platform restrictions, creating fake accounts, spam, or abusive activity.
          </p>
        </section>

        <p className={styles.bottomNote}>
          Built for developers and responsible use — not for abuse.
        </p>
      </section>

      <section className={styles.pricingSection}>
        <div className={styles.pricingInner}>
          <div className={styles.pricingTop}>
            <p className={styles.pricingEyebrow}>Plans</p>
            <h2 className={styles.pricingTitle}>Simple pricing for every workflow</h2>
            <p className={styles.pricingSub}>
              Start free, then upgrade when you need more inboxes, longer lifetimes, and a smoother workflow.
            </p>
          </div>

          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.planHeader}>
                <span className={styles.planIcon}>👻</span>
                <div>
                  <h3 className={styles.planName}>Ghost</h3>
                  <p className={styles.planDesc}>Free forever</p>
                </div>
              </div>

              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>$0</span>
                <span className={styles.planPeriod}>/ month</span>
              </div>

              <div className={styles.planFeatures}>
                <p>• 1 temporary inbox at a time</p>
                <p>• 10-minute expiry</p>
                <p>• Fast generation for testing</p>
                <p>• No account required</p>
              </div>

              <button
                className={styles.planButton}
                onClick={generateMailbox}
                type="button"
              >
                Start free
              </button>
            </div>

            <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
              <div className={styles.pricingBadge}>Most popular</div>

              <div className={styles.planHeader}>
                <span className={styles.planIcon}>⚡</span>
                <div>
                  <h3 className={styles.planName}>Phantom</h3>
                  <p className={styles.planDesc}>For heavier testing</p>
                </div>
              </div>

              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>$4.99</span>
                <span className={styles.planPeriod}>/ month</span>
              </div>

              <div className={styles.planFeatures}>
                <p>• Up to 5 active inboxes</p>
                <p>• 24-hour expiry window</p>
                <p>• Better workflow for QA sessions</p>
                <p>• Ideal for repeated testing</p>
              </div>

              <a href="/login" className={`${styles.planButton} ${styles.planButtonLink}`}>
                Get Phantom
              </a>
            </div>

            <div className={styles.pricingCard}>
              <div className={styles.planHeader}>
                <span className={styles.planIcon}>🚀</span>
                <div>
                  <h3 className={styles.planName}>Spectre</h3>
                  <p className={styles.planDesc}>For power users</p>
                </div>
              </div>

              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>$8.99</span>
                <span className={styles.planPeriod}>/ month</span>
              </div>

              <div className={styles.planFeatures}>
                <p>• Unlimited active inboxes</p>
                <p>• Long-lived testing workflow</p>
                <p>• Better for teams and daily usage</p>
                <p>• Designed for advanced users</p>
              </div>

              <a href="/login" className={`${styles.planButton} ${styles.planButtonLink}`}>
                Get Spectre
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>© 2026 GhostMail — Developer-focused email testing tool. Use responsibly.</p>
      </footer>
    </main>
  );
}