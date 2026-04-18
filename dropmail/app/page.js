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

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackImage, setFeedbackImage] = useState(null);
  const [feedbackImageName, setFeedbackImageName] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

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

  function resetFeedbackModal() {
    setShowFeedback(false);
    setFeedbackText('');
    setFeedbackImage(null);
    setFeedbackImageName('');
    setFeedbackSending(false);
    setFeedbackError('');
    setFeedbackSuccess('');
  }

  async function handleFeedbackSubmit() {
  setFeedbackError('');
  setFeedbackSuccess('');

  if (!feedbackText.trim() && !feedbackImage) {
  setFeedbackError('Add a message or upload a screenshot.');
  return;
}

  setFeedbackSending(true);

  try {
    const formData = new FormData();
    formData.append('message', feedbackText.trim() || 'Screenshot feedback');
    formData.append('email', user?.email || '');
    formData.append('page', '/');
    formData.append('userId', user?.id || '');

    if (feedbackImage) {
      formData.append('screenshot', feedbackImage);
    }

    const res = await fetch('/api/feedback', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'Could not send feedback.');
    }

    setFeedbackSuccess('Feedback sent. Thanks.');

    setTimeout(() => {
      resetFeedbackModal();
    }, 1000);
  } catch (err) {
    setFeedbackError(err?.message || 'Could not send feedback.');
  } finally {
    setFeedbackSending(false);
  }
}

  return (
    <main className={styles.main}>
      <div className={styles.bg} />

      <header className={styles.header}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>&#10022;</span>
            <span className={styles.logoText}>GhostMail</span>
          </div>

          <button
            type="button"
            className={styles.feedbackBtn}
            onClick={() => {
              setFeedbackError('');
              setFeedbackSuccess('');
              setShowFeedback(true);
            }}
          >
            Feedback
          </button>
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
          PRIVATE EMAIL FOR TESTING
        </div>

        <h1 className={styles.headline}>
          Private inboxes for
          <br />
          <span className={styles.accentLine}>developers & QA.</span>
        </h1>

        <p className={styles.sub}>
          Generate short-lived email inboxes fast. Test flows, receive emails, protect your real inbox.
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
                Generate first. Login only when you want to open and manage inboxes.
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
                Fast for testing. Login only when needed.
              </p>
            </div>
          )}
        </div>

        <section className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <p className={styles.infoEyebrow}>What is GhostMail</p>
            <h3 className={styles.infoTitle}>A private inbox tool for testing.</h3>
            <p className={styles.infoText}>
              Generate temporary inboxes, receive emails, and keep your primary email out of test flows.
            </p>
          </div>

          <div className={styles.infoCard}>
            <p className={styles.infoEyebrow}>Problems it solves</p>
            <ul className={styles.infoList}>
              <li>Testing signup and password reset emails</li>
              <li>Protecting your real inbox from noise</li>
              <li>Checking integrations and transactional emails</li>
              <li>Running QA flows with fast disposable inboxes</li>
            </ul>
          </div>

          <div className={styles.infoCard}>
            <p className={styles.infoEyebrow}>Why it feels better</p>
            <ul className={styles.infoList}>
              <li>Generate inboxes from homepage</li>
              <li>Login only when needed</li>
              <li>Short-lived by default</li>
              <li>Built for dev and QA workflows</li>
            </ul>
          </div>
        </section>
      </section>

      <section id="pricing" className={styles.pricingSection}>
        <div className={styles.pricingInner}>
          <div className={styles.pricingTop}>
            <p className={styles.pricingEyebrow}>Plans</p>
            <h2 className={styles.pricingTitle}>Simple pricing</h2>
            <p className={styles.pricingSub}>
              Start free. Upgrade when you need more inboxes and longer lifetimes.
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
                <p>• Fast generation</p>
                <p>• Login only when opening inbox</p>
              </div>

              <button
                className={styles.planButton}
                onClick={() => {
                  window.location.href = '/login';
                }}
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
                <p>• Better QA workflow</p>
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
                <p>High-volume workflows</p>
                <p>Built for teams and advanced use</p>
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
          <button
            type="button"
            className={styles.footerFeedbackLink}
            onClick={() => {
              setFeedbackError('');
              setFeedbackSuccess('');
              setShowFeedback(true);
            }}
          >
            Feedback
          </button>
        </div>

        <p>© 2026 GhostMail — Built for developers, QA, and email testing workflows.</p>
      </footer>

      {showFeedback && (
        <div
          className={styles.feedbackOverlay}
          onClick={resetFeedbackModal}
        >
          <div
            className={styles.feedbackModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.feedbackHeader}>
              <div>
                <p className={styles.feedbackEyebrow}>Feedback</p>
                <h3 className={styles.feedbackTitle}>What should we improve?</h3>
              </div>

              <button
                type="button"
                className={styles.feedbackClose}
                onClick={resetFeedbackModal}
              >
                ×
              </button>
            </div>

            <p className={styles.feedbackHint}>
              Upload a screenshot if needed, then write what should be fixed, changed, or improved.
            </p>

            <label className={styles.feedbackUpload}>
              <input
                type="file"
                accept="image/*"
                className={styles.feedbackFileInput}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setFeedbackImage(file);
                  setFeedbackImageName(file ? file.name : '');
                }}
              />
              <span className={styles.feedbackUploadText}>
                {feedbackImageName ? feedbackImageName : 'Upload screenshot'}
              </span>
            </label>

            <textarea
              className={styles.feedbackTextarea}
              placeholder="Write your suggestion, fix, or issue here..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />

            {feedbackError ? <p className={styles.feedbackError}>{feedbackError}</p> : null}
            {feedbackSuccess ? <p className={styles.feedbackSuccess}>{feedbackSuccess}</p> : null}

            <div className={styles.feedbackActions}>
              <button
                type="button"
                className={styles.feedbackCancel}
                onClick={resetFeedbackModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.feedbackSubmit}
                onClick={handleFeedbackSubmit}
                disabled={feedbackSending}
              >
                {feedbackSending ? 'Sending...' : 'Submit feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}