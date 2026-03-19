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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('addresses');

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setPlan('free');
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

  const planLabel = plan === 'spectre' ? '🔥 Spectre' : plan === 'phantom' ? '⚡ Phantom' : '👻 Ghost';
  const planHint = plan === 'spectre' ? 'Unlimited everything' : plan === 'phantom' ? '$4.99/mo' : 'Free forever';

  // ─── DASHBOARD ───────────────────────────────────────────────
  if (user) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d14', fontFamily: 'inherit' }}>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#0a0a10', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#a78bfa', fontSize: '16px' }}>✦</span>
          <span style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>GhostMail</span>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#a78bfa', marginBottom: '8px' }}>
            {username?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{username}</div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{planLabel}</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {[
            { id: 'addresses', icon: '📬', label: 'Addresses' },
            { id: 'inbox', icon: '📥', label: 'Inbox' },
            { id: 'plan', icon: '⚡', label: 'Upgrade' },
            { id: 'settings', icon: '⚙️', label: 'Settings' },
          ].map(item => (
            <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: activeTab === item.id ? '#a78bfa' : '#666', background: activeTab === item.id ? 'rgba(167,139,250,0.08)' : 'transparent', borderLeft: activeTab === item.id ? '2px solid #a78bfa' : '2px solid transparent' }}>
              <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleSignOut} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>👋 Welcome back, {username}</div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{user?.email}</div>
          </div>
          <button onClick={generateMailbox} disabled={loading} style={{ padding: '8px 18px', borderRadius: '99px', border: 'none', background: '#a78bfa', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? '...' : '⚡ Generate address'}
          </button>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {/* ADDRESSES */}
          {activeTab === 'addresses' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Active addresses', value: mailbox ? '1' : '0', hint: plan === 'spectre' ? 'Unlimited' : plan === 'phantom' ? '5 max' : '1 max' },
                  { label: 'Emails received', value: '0', hint: 'today' },
                  { label: 'Plan', value: planLabel, hint: planHint },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: s.label === 'Plan' ? '16px' : '24px', fontWeight: '700', color: '#fff', marginTop: s.label === 'Plan' ? '4px' : '0' }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>{s.hint}</div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: '600' }}>Quick generate</div>
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '16px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>Create a throwaway address</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>Instant · No trace · Auto-deletes in 10 min</div>
                </div>
                <button onClick={generateMailbox} disabled={loading} style={{ padding: '10px 20px', borderRadius: '99px', border: 'none', background: '#a78bfa', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  ⚡ Generate now
                </button>
              </div>

              {mailbox && (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active address</span>
                    <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>⏱ Expires in {getExpiryMinutes()} min</span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#a78bfa', marginBottom: '12px' }}>{mailbox.address}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={copyAddress} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.3)', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <button onClick={goToInbox} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Open Inbox →
                    </button>
                  </div>
                </div>
              )}

              {!mailbox && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444', fontSize: '13px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px', opacity: '0.4' }}>👻</div>
                  No addresses yet — generate your first one above!
                </div>
              )}
            </div>
          )}

          {/* INBOX */}
          {activeTab === 'inbox' && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: '0.4' }}>📭</div>
              No emails yet. Use a generated address somewhere to receive emails here.
            </div>
          )}

          {/* PLAN */}
          {activeTab === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Current plan</div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>{planLabel}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{planHint}</div>
              </div>
              {plan !== 'spectre' && (
                <>
                  <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Upgrade</div>
                  {plan !== 'phantom' && (
                    <div style={{ background: 'rgba(167,139,250,0.08)', border: '2px solid rgba(167,139,250,0.3)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '99px', display: 'inline-block', marginBottom: '8px' }}>Most popular</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>⚡ Phantom — $4.99/mo</div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>5 addresses · 24hr lifespan · 100 emails</div>
                      <button onClick={() => handleUpgrade('phantom')} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', background: '#a78bfa', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Upgrade to Phantom ⚡
                      </button>
                    </div>
                  )}
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>🔥 Spectre — $8.99/mo</div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>Unlimited addresses · Forever · Unlimited emails</div>
                    <button onClick={() => handleUpgrade('spectre')} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'none', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Upgrade to Spectre 🔥
                    </button>
                  </div>
                </>
              )}
              {plan === 'spectre' && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔥</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>You're on Spectre!</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>You have the best plan. Enjoy unlimited everything!</div>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Account</div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
                {[
                  { label: 'Email', value: user?.email },
                  { label: 'Username', value: username },
                  { label: 'Password', value: '••••••••' },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{row.label}</div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{row.value}</div>
                    </div>
                    <button style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Danger zone</div>
              <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#f87171', fontWeight: '500' }}>Delete account</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>Permanently remove everything</div>
                </div>
                <button onClick={() => { if(confirm('Are you sure? This cannot be undone.')) handleSignOut(); }} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );

  // ─── HOMEPAGE ────────────────────────────────────────────────
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