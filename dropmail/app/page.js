'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  async function generateMailbox() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/mailbox/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setMailbox(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyAddress() {
    if (!mailbox) return;
    await navigator.clipboard.writeText(mailbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function goToInbox() {
    window.location.href = `/inbox?token=${mailbox.token}`;
  }

  function getExpiryMinutes() {
    if (!mailbox) return 10;
    const diff = new Date(mailbox.expires_at) - new Date();
    return Math.max(0, Math.round(diff / 60000));
  }

  return (
    <main className={styles.main}>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>
        <div className={styles.headerBadge}>Free · No signup · No tracking</div>
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.tagline}>
          <span className={styles.taglineDot} />
          Instant throwaway email
        </div>

        <h1 className={styles.headline}>
          Your inbox.<br />
          <span className={styles.accentLine}>Gone in 10.</span>
        </h1>

        <p className={styles.sub}>
          Generate a <strong>real working email</strong> in one click.
          Use it anywhere. Vanishes automatically — no trace, no spam, no BS.
        </p>

        <div className={styles.card}>
          {!mailbox ? (
            <div className={styles.cardInner}>
              <button className={styles.btnPrimary} onClick={generateMailbox} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : <>⚡ Generate My Address</>}
              </button>
              {error && <p className={styles.errorMsg}>{error}</p>}
            </div>
          ) : (
            <div className={styles.cardInner}>
              <div className={styles.addressRow}>
                <span className={styles.addressLabel}>Your temp address</span>
                <div className={styles.addressBox}>
                  <span className={styles.addressText}>{mailbox.address}</span>
                  <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={copyAddress}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.activePill}>● Active</span>
                <span className={styles.expiryText}>⏱ Expires in {getExpiryMinutes()} min</span>
              </div>
              <div className={styles.actionRow}>
                <button className={styles.btnPrimary} onClick={goToInbox}>Open Inbox →</button>
                <button className={styles.btnSecondary} onClick={generateMailbox}>New Address</button>
              </div>
              <p className={styles.tokenNote}>Bookmark your inbox URL — it's your only way back in.</p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.howSection}>
        <div className={styles.howInner}>
          <h2 className={styles.howTitle}>How it works</h2>
          <div className={styles.stepsGrid}>
            {[
              { n: '01', emoji: '⚡', title: 'Generate', desc: 'One click. Instant real email. No forms, no account needed.' },
              { n: '02', emoji: '📋', title: 'Use it anywhere', desc: 'Sign up for stuff, bypass spam, verify accounts.' },
              { n: '03', emoji: '📬', title: 'Emails arrive live', desc: 'Watch emails land in your inbox in real time.' },
              { n: '04', emoji: '💨', title: 'Self-destructs', desc: 'After 10 minutes — address and emails gone forever.' },
            ].map(s => (
              <div className={styles.step} key={s.n}>
                <span className={styles.stepEmoji}>{s.emoji}</span>
                <span className={styles.stepNum}>{s.n}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNum}>10min</span>
              <span className={styles.statLabel}>Auto-delete</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>0</span>
              <span className={styles.statLabel}>Data stored</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statNum}>Free</span>
              <span className={styles.statLabel}>Forever</span>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section className={styles.pricingSection}>
        <div className={styles.howInner}>
          <h2 className={styles.howTitle}>Simple pricing</h2>
          <p className={styles.pricingSub}>No credit card games. Pick what you need.</p>
          <div className={styles.pricingGrid}>

            {/* Free */}
            <div className={styles.pricingCard}>
              <div className={styles.planEmoji}>👻</div>
              <h3 className={styles.planName}>Ghost</h3>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>$0</span>
                <span className={styles.planPer}>/forever</span>
              </div>
              <ul className={styles.planFeatures}>
                <li>✓ 1 address at a time</li>
                <li>✓ 10 minute lifespan</li>
                <li>✓ Up to 10 emails</li>
                <li>✓ No signup needed</li>
              </ul>
              <button className={styles.planBtnFree} onClick={generateMailbox}>
                Get started free
              </button>
            </div>

            {/* Phantom */}
            <div className={styles.pricingCard}>
              <div className={styles.planEmoji}>⚡</div>
              <h3 className={styles.planName}>Phantom</h3>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>$4.99</span>
                <span className={styles.planPer}>/month</span>
              </div>
              <ul className={styles.planFeatures}>
                <li>✓ 5 addresses at a time</li>
                <li>✓ 24 hour lifespan</li>
                <li>✓ Up to 100 emails</li>
                <li>✓ Priority delivery</li>
              </ul>
              <button className={styles.planBtnPaid}>
                Coming soon
              </button>
            </div>

            {/* Spectre */}
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.featuredBadge}>Most Popular</div>
              <div className={styles.planEmoji}>🔥</div>
              <h3 className={styles.planName}>Spectre</h3>
              <div className={styles.planPrice}>
                <span className={styles.planAmount}>$8.99</span>
                <span className={styles.planPer}>/month</span>
              </div>
              <ul className={styles.planFeatures}>
                <li>✓ Unlimited addresses</li>
                <li>✓ Emails saved forever</li>
                <li>✓ Unlimited emails</li>
                <li>✓ Priority support</li>
              </ul>
              <button className={styles.planBtnPaid}>
                Coming soon
              </button>
            </div>

          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>✦ GhostMail — private by design</span>
        <span>No logs. No tracking. No BS.</span>
      </footer>
    </main>
  );
}