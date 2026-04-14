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
  const [theme, setTheme] = useState('dark');
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [totalEmails, setTotalEmails] = useState(null);

  useEffect(() => {
    let mounted = true;

    const savedTheme = localStorage.getItem('ghostmail-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');

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
        } else {
          setPlan('free');
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

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('ghostmail-theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  async function generateMailbox() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers,
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

  async function handleOpenInbox() {
    if (!mailbox?.token) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      window.location.href = `/login?next=${encodeURIComponent(`/inbox?token=${mailbox.token}`)}`;
      return;
    }

    window.location.href = `/inbox?token=${mailbox.token}`;
  }

  function getPaidPlanHref(targetPlan) {
    const checkoutPath = `/checkout?plan=${encodeURIComponent(targetPlan)}`;

    if (user) return checkoutPath;

    return `/login?next=${encodeURIComponent(checkoutPath)}`;
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

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>&#10022;</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>

        <div className={styles.navLinks}>
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.themeToggleIcon}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

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
          PRIVATE EMAIL FOR DEVELOPERS & TESTING
        </div>

        <h1 className={styles.headline}>
          Private email inbox for
          <br />
          <span className={styles.accentLine}>testing & development.</span>
        </h1>

        <p className={styles.sub}>
          Create secure, <strong>short-lived email inboxes for QA testing,</strong> integrations, and protecting your primary email.
        </p>

        <p className={styles.trustLine}>
          GhostMail is designed for developers, QA testing, and privacy protection.
          We actively prevent abuse, spam, and misuse of the platform.
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
                Generate first. Sign in only when you want to open and manage the inbox.
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
                <button
                  onClick={handleOpenInbox}
                  className={`${styles.btnSecondary} ${styles.linkButton}`}
                  type="button"
                >
                  Open Inbox
                </button>

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
                Login only when you open the inbox.
                No signup needed to generate.
              </p>
            </div>
          )}
        </div>

        <section className={styles.howSection}>
          <h2 className={styles.howTitle}>How it works</h2>

          <div className={styles.howGrid}>
            <div className={styles.howCard}>
              <span className={styles.howStep}>01</span>
              <h3 className={styles.howCardTitle}>Generate</h3>
              <p className={styles.howCardText}>
                Create a private test inbox instantly from the homepage.
              </p>
            </div>

            <div className={styles.howCard}>
              <span className={styles.howStep}>02</span>
              <h3 className={styles.howCardTitle}>Open inbox when ready</h3>
              <p className={styles.howCardText}>
                Login is only required when you want to open and manage the inbox.
              </p>
            </div>

            <div className={styles.howCard}>
              <span className={styles.howStep}>03</span>
              <h3 className={styles.howCardTitle}>Auto-delete</h3>
              <p className={styles.howCardText}>
                The inbox expires automatically, keeping your workflow clean and short-lived.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.perfectSection}>
          <h2 className={styles.perfectTitle}>Perfect for</h2>

          <div className={styles.perfectGrid}>
            <div className={styles.perfectCard}>
              <h3 className={styles.perfectCardTitle}>QA testing</h3>
              <p className={styles.perfectCardText}>
                Test registration flows, password resets, OTPs, and welcome emails safely.
              </p>
            </div>

            <div className={styles.perfectCard}>
              <h3 className={styles.perfectCardTitle}>Developers</h3>
              <p className={styles.perfectCardText}>
                Verify integrations, debug email delivery, and test app notifications fast.
              </p>
            </div>

            <div className={styles.perfectCard}>
              <h3 className={styles.perfectCardTitle}>Privacy-conscious users</h3>
              <p className={styles.perfectCardText}>
                Protect your main inbox when you need a short-lived address for testing.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.responsibleSection}>
          <h3 className={styles.responsibleTitle}>Responsible Use</h3>
          <p className={styles.responsibleItem}>• Software testing and QA environments</p>
          <p className={styles.responsibleItem}>• Developer workflows and debugging email flows</p>
          <p className={styles.responsibleItem}>• Short-lived inboxes for testing integrations</p>
          <p className={styles.responsibleNote}>
            GhostMail is not intended for bypassing platform restrictions, creating fake accounts, spam, or abusive activity.
          </p>
        </section>

        <p className={styles.bottomNote}>
          Built for developers and responsible use — not for abuse.
        </p>
      </section>

      <section id="pricing" className={styles.pricingSection}>
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
                <p>• 1 private inbox at a time</p>
                <p>• 10-minute expiry</p>
                <p>• Fast generation for testing</p>
                <p>• Login only when opening inbox</p>
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

              <a
                href={getPaidPlanHref('phantom')}
                className={`${styles.planButton} ${styles.planButtonLink}`}
              >
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
                <p>Unlimited active inboxes</p>
                <p>Up to 1-year inbox expiry</p>
                <p>High-volume testing workflows</p>
                <p>Built for advanced workflows and teams</p>
              </div>

              <a
                href={getPaidPlanHref('spectre')}
                className={`${styles.planButton} ${styles.planButtonLink}`}
              >
                Get Spectre
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a href="/about">About</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="mailto:support@ghostmails.org">Contact</a>
        </div>

        <p>© 2026 GhostMail — Built for developers, QA, and email testing workflows.</p>
      </footer>
    </main>
  );
}