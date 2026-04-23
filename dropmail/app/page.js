'use client';

import { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { createClient } from '@supabase/supabase-js';
import styles from './page.module.css';
import { PRICING } from './lib/pricing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const heroPreviewEmails = [
  { brand: 'Google', subject: 'Verify your Google account', time: '10:24 AM' },
  { brand: 'Slack', subject: 'Your code is 984321', time: '10:21 AM' },
  { brand: 'GitHub', subject: 'Please verify your email address', time: '10:15 AM' },
];

const featureCards = [
  {
    icon: '📭',
    title: 'Keep your real inbox clean',
    desc: 'Stop spam before it reaches your primary email.',
  },
  {
    icon: '</>',
    title: 'Test without limits',
    desc: 'Create inboxes fast for signups, OTP flows, and QA checks.',
  },
  {
    icon: '🛡️',
    title: 'Protect your privacy',
    desc: 'Use temporary inboxes without exposing your real identity.',
  },
  {
    icon: '⚡',
    title: 'Instant & simple',
    desc: 'Generate a working inbox in one click with no friction.',
  },
  {
    icon: '🕒',
    title: 'Save time',
    desc: 'Skip fake accounts and test email flows faster.',
  },
];

const useCasePills = ['Developers', 'QA Testers', 'Marketers', 'Students', 'Everyone'];

const stats = [
  { value: '50K+', label: 'Happy Users' },
  { value: '2M+', label: 'Emails Created' },
  { value: '99.9%', label: 'Uptime' },
  { value: '100%', label: 'Private & Secure' },
];

export default function Home() {
  const [plan, setPlan] = useState('free');
  const [theme, setTheme] = useState('light');
  const [billingCycle, setBillingCycle] = useState('monthly');
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

  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileWidgetId, setTurnstileWidgetId] = useState(null);

  const turnstileContainerRef = useRef(null);
  const pendingMailboxRequestRef = useRef(false);

  const phantomPricing = PRICING.phantom[billingCycle];
  const spectrePricing = PRICING.spectre[billingCycle];
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  function formatPlanPrice(value) {
    return `$${value.toFixed(2)}`;
  }

  function getBillingLabel(cycle) {
    if (cycle === 'monthly') return '/ month';
    if (cycle === '3m') return '/ 3 months';
    if (cycle === '6m') return '/ 6 months';
    return '/ year';
  }

  function resetTurnstileWidget() {
    try {
      if (
        typeof window !== 'undefined' &&
        window.turnstile &&
        turnstileWidgetId !== null
      ) {
        window.turnstile.reset(turnstileWidgetId);
      }
    } catch (err) {
      console.error('Turnstile reset error:', err);
    }
  }

  async function requestMailbox(turnstileToken) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {};

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const formData = new FormData();
      formData.append('turnstileToken', turnstileToken);

      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers,
        body: formData,
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
    } finally {
      pendingMailboxRequestRef.current = false;
      resetTurnstileWidget();
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    const savedTheme = localStorage.getItem('ghostmail-theme') || 'light';
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

  useEffect(() => {
    if (
      !turnstileReady ||
      !turnstileSiteKey ||
      !turnstileContainerRef.current ||
      typeof window === 'undefined' ||
      !window.turnstile ||
      turnstileWidgetId !== null
    ) {
      return;
    }

    try {
      const widgetId = window.turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        size: 'invisible',
        callback: async (token) => {
          try {
            if (!pendingMailboxRequestRef.current) return;
            await requestMailbox(token);
          } catch (err) {
            console.error('Generate mailbox error:', err);
            setError(err.message || 'Something went wrong');
            pendingMailboxRequestRef.current = false;
            setLoading(false);
            resetTurnstileWidget();
          }
        },
        'expired-callback': () => {
          if (pendingMailboxRequestRef.current) {
            setError('Security check expired. Please try again.');
            pendingMailboxRequestRef.current = false;
            setLoading(false);
          }
        },
        'error-callback': () => {
          setError('Security check failed. Please refresh and try again.');
          pendingMailboxRequestRef.current = false;
          setLoading(false);
        },
      });

      setTurnstileWidgetId(widgetId);
    } catch (err) {
      console.error('Turnstile render error:', err);
      setError('Security check failed to load.');
    }
  }, [turnstileReady, turnstileSiteKey, turnstileWidgetId]);

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
      if (!turnstileSiteKey) {
        throw new Error('Security check is not configured.');
      }

      if (!turnstileReady || turnstileWidgetId === null || !window.turnstile) {
        throw new Error('Security check is still loading. Please wait a second.');
      }

      pendingMailboxRequestRef.current = true;
      await window.turnstile.execute(turnstileWidgetId);
    } catch (err) {
      console.error('Generate mailbox error:', err);
      pendingMailboxRequestRef.current = false;
      setError(err.message || 'Something went wrong');
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
    const selectedPricing = PRICING?.[targetPlan]?.[billingCycle];

    if (!selectedPricing?.variantId) {
      return '#pricing';
    }

    const checkoutPath = `/checkout?plan=${encodeURIComponent(
      targetPlan
    )}&cycle=${encodeURIComponent(billingCycle)}`;

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
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
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

      if (feedbackImage) {
        formData.append('screenshot', feedbackImage);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Could not send feedback.');
      }

      setFeedbackSuccess('✅ Feedback submitted successfully.');
      setFeedbackText('');
      setFeedbackImage(null);
      setFeedbackImageName('');

      setTimeout(() => {
        resetFeedbackModal();
      }, 2200);
    } catch (err) {
      setFeedbackError(err?.message || 'Could not send feedback.');
    } finally {
      setFeedbackSending(false);
    }
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer
        onLoad={() => setTurnstileReady(true)}
      />

      <main className={styles.main}>
        <div className={styles.bg} />

        <header className={styles.header}>
          <div className={styles.brandSide}>
            <a href="/" className={styles.brand}>
              <GhostLogo className={styles.brandLogo} />
              <span className={styles.brandText}>GhostMail</span>
            </a>

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

          <nav className={styles.navCenter}>
  <a href="#features">Features</a>
  <a href="#how">How it works</a>
  <a href="#use-cases">Use cases</a>
  <a href="#pricing">Pricing</a>
  <a href="#faq">FAQ</a>
</nav>

<div className={styles.navRight}>
  <button
    type="button"
    onClick={toggleTheme}
    className={styles.themeToggle}
  >
    {theme === 'light' ? '🌙' : '☀️'}
  </button>

  <a href={user ? '/dashboard' : '/login'} className={styles.navGhostBtn}>
    {user ? 'Dashboard' : 'Log in'}
  </a>

  <a href={user ? '/dashboard' : '/login'} className={styles.navPrimaryBtn}>
    {user ? 'Open Dashboard' : 'Get Started Free'}
  </a>
</div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroBadge}>
              Trusted by developers & privacy-focused users
            </div>

            <h1 className={styles.heroTitle}>
  <span className={styles.line1}>Disposable Email.</span>
  <span className={styles.line2}>Real Privacy.</span>
</h1>

            <p className={styles.heroSub}>
              Create private inboxes in one click. No sign-ups. No spam. No tracking.
            </p>

            <div className={styles.heroActions}>
              <div
                ref={turnstileContainerRef}
                style={{ display: 'none' }}
                aria-hidden="true"
              />

              <button
                className={styles.primaryCta}
                onClick={generateMailbox}
                disabled={loading || !turnstileSiteKey}
              >
                {loading ? (
                  <>
                    <span className={styles.spinner}></span>
                    Generating...
                  </>
                ) : (
                  'Generate Email Now →'
                )}
              </button>

              <a href="#how" className={styles.secondaryCta}>
                How it Works
              </a>
            </div>

            {error ? <p className={styles.errorMsg}>{error}</p> : null}

            <div className={styles.trustRow}>
              <span>No registration</span>
              <span>Auto-delete</span>
              <span>100% private</span>
              <span>Instant inbox</span>
            </div>

            <div className={styles.liveRow}>
              <p className={styles.tokenNote}>
                Generate first. Login only when you want to open and manage inboxes.
              </p>

              {totalEmails !== null && (
                <p className={styles.liveStat}>
                  {formatCount(totalEmails)} emails received today
                </p>
              )}
            </div>
          </div>

          <div className={styles.heroRight}>
            <div className={styles.floatIconLeft}>✉️</div>
            <div className={styles.floatIconRight}>🛡️</div>

            <div className={styles.previewCard}>
              <div className={styles.ghostFloatWrap}>
                <GhostLogo className={styles.heroGhost} />
              </div>

              <div className={styles.previewTop}>
                <div>
                  <h3 className={styles.previewTitle}>Your inbox</h3>

                  <div className={styles.previewAddressRow}>
                    <span className={styles.previewAddress}>
                      {mailbox?.address || 'brave.panda@ghostmail.io'}
                    </span>

                    <button
                      type="button"
                      className={styles.copyMiniBtn}
                      onClick={() =>
                        copyAddress(mailbox?.address || 'brave.panda@ghostmail.io')
                      }
                    >
                      {copied === (mailbox?.address || 'brave.panda@ghostmail.io') ? '✓' : '⧉'}
                    </button>
                  </div>
                </div>

                <span className={styles.livePill}>Live</span>
              </div>

              <div className={styles.previewList}>
                {(mailbox
                  ? [
                      { brand: 'GhostMail', subject: 'Inbox ready to use', time: getExpiryLabel(mailbox.expires_at) },
                      { brand: 'Copy', subject: 'Use this inbox in any signup flow', time: 'Now' },
                      { brand: 'Open', subject: 'Open inbox to view incoming emails', time: 'Ready' },
                    ]
                  : heroPreviewEmails
                ).map((item) => (
                  <div key={`${item.brand}-${item.subject}`} className={styles.previewItem}>
                    <div className={styles.previewBrandMark}>
                      {item.brand[0]}
                    </div>

                    <div className={styles.previewItemText}>
                      <div className={styles.previewItemBrand}>{item.brand}</div>
                      <div className={styles.previewItemSubject}>{item.subject}</div>
                    </div>

                    <div className={styles.previewItemMeta}>
                      <span>{item.time}</span>
                      <i />
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.previewBottom}>
                {mailbox ? (
                  <div className={styles.previewActionRow}>
                    <button
                      type="button"
                      className={styles.previewPrimaryBtn}
                      onClick={handleOpenInbox}
                    >
                      Open Inbox
                    </button>

                    <button
                      type="button"
                      className={styles.previewSecondaryBtn}
                      onClick={generateMailbox}
                    >
                      New Address
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.viewAllBtn}
                    onClick={generateMailbox}
                  >
                    View all emails →
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.logoStrip}>
          <p>Used by developers, testers & privacy-focused people</p>
          <div className={styles.logoRow}>
            <span>Google</span>
            <span>Microsoft</span>
            <span>GitHub</span>
            <span>Airbnb</span>
            <span>Amazon</span>
            <span>Stripe</span>
          </div>
        </section>

        <section id="features" className={styles.featuresSection}>
          <div className={styles.sectionHeading}>
            <h2>
              Why developers & testers love <span>GhostMail</span>
            </h2>
          </div>

          <div className={styles.featureGrid}>
            {featureCards.map((card) => (
              <div key={card.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className={styles.howSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>How it works</p>
            <h2>Fast flow. Zero friction.</h2>
          </div>

          <div className={styles.howGrid}>
            <div className={styles.howCard}>
              <span>01</span>
              <h3>Generate an inbox</h3>
              <p>Create a new temporary address from the homepage in one click.</p>
            </div>

            <div className={styles.howCard}>
              <span>02</span>
              <h3>Use it anywhere</h3>
              <p>Sign up, test OTPs, receive password resets, and protect your real email.</p>
            </div>

            <div className={styles.howCard}>
              <span>03</span>
              <h3>Open only when needed</h3>
              <p>Login when you want to manage or open inboxes. Keep the flow fast.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.pricingSection}>
          <div className={styles.pricingTop}>
            <p className={styles.sectionEyebrow}>Plans</p>
            <h2>Simple pricing</h2>
            <p>Start free. Upgrade when you need more inboxes and longer lifetimes.</p>

            <div className={styles.billingToggle}>
              {[
                { key: 'monthly', label: 'Monthly' },
                { key: '3m', label: '3 Months' },
                { key: '6m', label: '6 Months' },
                { key: 'yearly', label: 'Yearly' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.billingToggleBtn} ${
                    billingCycle === option.key ? styles.billingToggleBtnActive : ''
                  }`}
                  onClick={() => setBillingCycle(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.planHeader}>
                <span className={styles.planIcon}>👻</span>
                <div>
                  <h3>Ghost</h3>
                  <p>Free forever</p>
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
                  <h3>Phantom</h3>
                  <p>For heavier testing</p>
                </div>
              </div>

              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>{formatPlanPrice(phantomPricing.price)}</span>
                <span className={styles.planPeriod}>{getBillingLabel(billingCycle)}</span>
              </div>

              <div className={styles.planFeatures}>
                <p>• Up to 5 active inboxes</p>
                <p>• 24-hour expiry window</p>
                <p>• Better QA workflow</p>
                <p>
                  • {billingCycle === 'monthly'
                    ? 'Flexible monthly billing'
                    : billingCycle === '3m'
                    ? '3 months upfront'
                    : billingCycle === '6m'
                    ? '6 months upfront'
                    : 'Best yearly value'}
                </p>
              </div>

              <a
                href={getPaidPlanHref('phantom')}
                className={styles.planButton}
              >
                Get Phantom
              </a>
            </div>

            <div className={styles.pricingCard}>
              <div className={styles.planHeader}>
                <span className={styles.planIcon}>🚀</span>
                <div>
                  <h3>Spectre</h3>
                  <p>For power users</p>
                </div>
              </div>

              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>{formatPlanPrice(spectrePricing.price)}</span>
                <span className={styles.planPeriod}>{getBillingLabel(billingCycle)}</span>
              </div>

              <div className={styles.planFeatures}>
                <p>• Unlimited active inboxes</p>
                <p>• Up to 1-year inbox expiry</p>
                <p>• High-volume workflows</p>
                <p>
                  • {billingCycle === 'monthly'
                    ? 'Flexible monthly billing'
                    : billingCycle === '3m'
                    ? '3 months upfront'
                    : billingCycle === '6m'
                    ? '6 months upfront'
                    : 'Best yearly value'}
                </p>
              </div>

              <a
                href={getPaidPlanHref('spectre')}
                className={styles.planButton}
              >
                Get Spectre
              </a>
            </div>
          </div>
        </section>

        <section id="faq" className={styles.faqSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>FAQ</p>
            <h2>Questions people ask first</h2>
          </div>

          <div className={styles.faqGrid}>
            <div className={styles.faqCard}>
              <h3>Do I need an account to generate an inbox?</h3>
              <p>No. Generate first. Login only when you want to open and manage inboxes.</p>
            </div>

            <div className={styles.faqCard}>
              <h3>Is GhostMail for real users or testing?</h3>
              <p>It’s built mainly for developers, QA workflows, and privacy-conscious signups.</p>
            </div>

            <div className={styles.faqCard}>
              <h3>How long do inboxes live?</h3>
              <p>That depends on your plan. Free is short-lived, paid plans unlock longer expiry windows.</p>
            </div>

            <div className={styles.faqCard}>
              <h3>Can I use it to protect my main inbox?</h3>
              <p>Yes. That’s one of the main reasons people use GhostMail.</p>
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
          <div className={styles.feedbackOverlay} onClick={resetFeedbackModal}>
            <div className={styles.feedbackModal} onClick={(e) => e.stopPropagation()}>
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
                    setFeedbackError('');
                    setFeedbackSuccess('');
                  }}
                />
                <span className={styles.feedbackUploadText}>
                  {feedbackImageName ? feedbackImageName : 'Upload screenshot'}
                </span>
              </label>

              {feedbackSuccess ? (
                <div className={styles.feedbackSuccess}>{feedbackSuccess}</div>
              ) : null}

              <textarea
                className={styles.feedbackTextarea}
                placeholder="Write your suggestion, fix, or issue here..."
                value={feedbackText}
                onChange={(e) => {
                  setFeedbackText(e.target.value);
                  setFeedbackError('');
                  setFeedbackSuccess('');
                }}
              />

              {feedbackError ? <p className={styles.feedbackError}>{feedbackError}</p> : null}

              <div className={styles.feedbackActions}>
                <button
                  type="button"
                  className={styles.feedbackCancel}
                  onClick={resetFeedbackModal}
                  disabled={feedbackSending}
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
    </>
  );
}

function GhostLogo({ className = '' }) {
  return (
    <svg
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M64 12C41.356 12 23 30.356 23 53V88.5C23 95.956 29.044 102 36.5 102C42.419 102 47.447 98.183 49.289 92.875C50.867 98.365 55.93 102.375 62 102.375C68.07 102.375 73.133 98.365 74.711 92.875C76.553 98.183 81.581 102 87.5 102C94.956 102 101 95.956 101 88.5V53C101 30.356 82.644 12 60 12H64Z"
        fill="none"
      />
      <path
        d="M64 12C86.644 12 105 30.356 105 53V88.5C105 95.956 98.956 102 91.5 102C85.581 102 80.553 98.183 78.711 92.875C77.133 98.365 72.07 102.375 66 102.375C59.93 102.375 54.867 98.365 53.289 92.875C51.447 98.183 46.419 102 40.5 102C33.044 102 27 95.956 27 88.5V53C27 30.356 45.356 12 68 12H64Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="49" cy="50" r="6" fill="#1e153a" />
      <circle cx="79" cy="50" r="6" fill="#1e153a" />
      <path
        d="M50 70C57 77 71 77 78 70"
        stroke="#1e153a"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}