'use client';

import { useState } from 'react';

export default function Home() {
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function generateMailbox() {
    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate address');
      }

      setMailbox(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyAddress() {
    if (!mailbox?.address) return;
    await navigator.clipboard.writeText(mailbox.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className={styles.main}>
      <div className={styles.bg} />
      <div className={styles.grid} />

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="/terms" style={{ color: '#888' }}>Terms</a>
          <a href="/privacy" style={{ color: '#888' }}>Privacy</a>
          <a href="/login" style={{ color: '#a78bfa' }}>Sign in</a>
        </div>
      </header>

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.tagline}>
          <span className={styles.taglineDot}></span>
          TEMPORARY EMAIL FOR DEVELOPERS & TESTING
        </div>

        <h1 className={styles.headline}>
          Your inbox.
          <span className={styles.accentLine}>Gone in minutes.</span>
        </h1>

        <p className={styles.sub}>
          Generate <strong>temporary email addresses</strong> for QA testing,
          development workflows, and protecting your inbox during testing.
        </p>

        {/* CARD */}
        <div className={styles.card}>
          <div className={styles.cardInner}>

            {/* BUTTON */}
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

            {/* RESULT */}
            {mailbox && (
              <>
                <div className={styles.addressRow}>
                  <span className={styles.addressLabel}>
                    YOUR TEMP EMAIL
                  </span>

                  <div className={styles.addressBox}>
                    <span className={styles.addressText}>
                      {mailbox.address}
                    </span>

                    <button
                      onClick={copyAddress}
                      className={`${styles.copyBtn} ${
                        copied ? styles.copied : ''
                      }`}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.activePill}>● Active</span>
                  <span className={styles.expiryText}>
                    Expires soon
                  </span>
                </div>

                <div className={styles.actionRow}>
                  <a
                    href={`/inbox?token=${mailbox.token}`}
                    className={styles.btnSecondary}
                  >
                    Open Inbox
                  </a>

                  <button
                    onClick={generateMailbox}
                    className={styles.btnSecondary}
                  >
                    New Address
                  </button>
                </div>
              </>
            )}

            {error && <p className={styles.errorMsg}>{error}</p>}

            <p className={styles.tokenNote}>
              Built for responsible use — not for abuse.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}