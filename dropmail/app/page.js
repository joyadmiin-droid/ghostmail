'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import styles from './page.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [mailbox, setMailbox] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('addresses');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function handleUpgrade(plan) {
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
    }
  }

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

  const username = user?.email?.split('@')[0];

  const tabStyle = (tab) => ({
    padding: '8px 18px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    color: activeTab === tab ? '#fff' : '#888',
    borderBottom: activeTab === tab ? '2px solid #a78bfa' : '2px solid transparent',
    fontFamily: 'inherit',
    fontWeight: activeTab === tab ? '600' : '400',
    marginBottom: '-1px',
  });

  // DASHBOARD VIEW — shown when user is logged in
  if (user) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'inherit' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" onClick={(e) => { e.preventDefault(); handleSignOut(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#fff', fontSize: '18px', fontWeight: '700' }}>
          ✦ GhostMail
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#a78bfa' }}>👻 {username}</span>
          <button onClick={handleSignOut} style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>👋 Welcome back, {username}</h1>
          <p style={{ fontSize: '14px', color: '#888' }}>{user?.email} · Ghost plan (Free)</p>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', display: 'flex', gap: '4px' }}>
          {['addresses', 'inbox', 'plan', 'settings'].map(tab => (
            <button key={tab} style={tabStyle(tab)} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ADDRESSES TAB */}
        {activeTab === 'addresses' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
              {[
                { label: 'Active addresses', value: '0' },
                { label: 'Emails received', value: '0' },
                { label: 'Plan limit', value: '1 max' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '700' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
              No active addresses. <a href="/" onClick={(e) => { e.preventDefault(); setUser(null); }} style={{ color: '#a78bfa' }}>Generate one here!</a>
            </p>
          </div>
        )}

        {/* INBOX TAB */}
        {activeTab === 'inbox' && (
          <div>
            <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
              No emails yet. Generate an address and use it somewhere to receive emails!
            </p>
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current plan</div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>👻 Ghost</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>Free forever</div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>✓ 1 address at a time</li>
                <li>✓ 10 minute lifespan</li>
                <li>✓ Up to 10 emails</li>
              </ul>
            </div>
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '2px solid rgba(167,139,250,0.4)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '11px', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '99px', display: 'inline-block', marginBottom: '8px' }}>Most popular</div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>⚡ Phantom</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>$4.99 / month</div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <li>✓ 5 addresses at a time</li>
                <li>✓ 24 hour lifespan</li>
                <li>✓ Up to 100 emails</li>
                <li>✓ Priority delivery</li>
              </ul>
              <button onClick={() => handleUpgrade('phantom')} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Upgrade to Phantom ⚡
              </button>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>🔥 Spectre</div>
              <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>$8.99 / month</div>
              <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <li>✓ Unlimited addresses</li>
                <li>✓ Emails saved forever</li>
                <li>✓ Unlimited emails</li>
                <li>✓ Priority support</li>
              </ul>
              <button onClick={() => handleUpgrade('spectre')} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                Upgrade to Spectre 🔥
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              {[
                { label: 'Email', value: user?.email },
                { label: 'Username', value: username },
                { label: 'Password', value: '••••••••' },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{row.label}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{row.value}</div>
                  </div>
                  <button style={{ fontSize: '13px', padding: '5px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'none', color: '#aaa', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#f87171' }}>Delete account</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Permanently remove your account</div>
                </div>
                <button onClick={() => { if(confirm('Are you sure? This cannot be undone.')) handleSignOut(); }} style={{ fontSize: '13px', padding: '5px 14px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // HOMEPAGE — shown when user is NOT logged in
  return (
    <main className={styles.main}>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={styles.headerBadge}>Free · No signup · No tracking</div>
          <a href="/login" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            Sign in
          </a>
        </div>
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
            <div className={styles.stat}><span className={styles.statNum}>10min</span><span className={styles.statLabel}>Auto-delete</span></div>
            <div className={styles.statDivider} />
            <div className={styles.stat}><span className={styles.statNum}>0</span><span className={styles.statLabel}>Data stored</span></div>
            <div className={styles.statDivider} />
            <div className={styles.stat}><span className={styles.statNum}>Free</span><span className={styles.statLabel}>Forever</span></div>
          </div>
        </div>
      </section>

      {/* PERFECT FOR */}
      <section className={styles.forSection}>
        <div className={styles.howInner}>
          <h2 className={styles.howTitle}>Perfect for...</h2>
          <div className={styles.forGrid}>
            {[
              { emoji: '🛍️', label: 'Online shopping' },
              { emoji: '🎮', label: 'Gaming accounts' },
              { emoji: '👨‍💻', label: 'App testing' },
              { emoji: '📰', label: 'Content access' },
              { emoji: '🔐', label: 'Staying private' },
              { emoji: '🎓', label: 'Free trials' },
              { emoji: '💼', label: 'Competitor research' },
              { emoji: '📱', label: 'App signups' },
            ].map(item => (
              <div className={styles.forItem} key={item.label}>
                <span className={styles.forEmoji}>{item.emoji}</span>
                <span className={styles.forLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricingSection}>
        <div className={styles.howInner}>
          <h2 className={styles.howTitle}>Simple pricing</h2>
          <p className={styles.pricingSub}>No credit card games. Pick what you need.</p>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.planEmoji}>👻</div>
              <h3 className={styles.planName}>Ghost</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>$0</span><span className={styles.planPer}>/forever</span></div>
              <ul className={styles.planFeatures}>
                <li>✓ 1 address at a time</li>
                <li>✓ 10 minute lifespan</li>
                <li>✓ Up to 10 emails</li>
                <li>✓ No signup needed</li>
              </ul>
              <button className={styles.planBtnFree} onClick={generateMailbox}>Get started free</button>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.planEmoji}>⚡</div>
              <h3 className={styles.planName}>Phantom</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>$4.99</span><span className={styles.planPer}>/month</span></div>
              <ul className={styles.planFeatures}>
                <li>✓ 5 addresses at a time</li>
                <li>✓ 24 hour lifespan</li>
                <li>✓ Up to 100 emails</li>
                <li>✓ Priority delivery</li>
              </ul>
              <button className={styles.planBtnPaid} onClick={() => handleUpgrade('phantom')}>Get Phantom ⚡</button>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.featuredBadge}>Most Popular</div>
              <div className={styles.planEmoji}>🔥</div>
              <h3 className={styles.planName}>Spectre</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>$8.99</span><span className={styles.planPer}>/month</span></div>
              <ul className={styles.planFeatures}>
                <li>✓ Unlimited addresses</li>
                <li>✓ Emails saved forever</li>
                <li>✓ Unlimited emails</li>
                <li>✓ Priority support</li>
              </ul>
              <button className={styles.planBtnPaid} onClick={() => handleUpgrade('spectre')}>Get Spectre 🔥</button>
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