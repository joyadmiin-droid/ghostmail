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

      // ✅ Social proof — count total emails received today
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
      console.error('Checkout error:', err);
      setUpgradeError(err.message);
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function generateMailbox() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = 'Bearer ' + session.access_token;
      }
      const res = await fetch('/api/mailbox/create', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setMailbox(data);
      if (totalEmails !== null) setTotalEmails(prev => prev + 1);
    } catch (err) {
      setError(err.message);
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

  const username = user?.email?.split('@')[0];

  const faqs = [
    { q: 'Is GhostMail really free?', a: 'Yes — the Ghost plan is completely free forever. No credit card, no signup, no catch. Generate an address in one click and use it immediately. Paid plans (Phantom and Spectre) unlock longer lifespans and more addresses.' },
    { q: 'How long does a temp email address last?', a: 'On the free Ghost plan, addresses last 10 minutes. Phantom plan addresses last 24 hours. Spectre plan addresses are saved forever and never expire.' },
    { q: 'Can I receive any email with GhostMail?', a: 'Yes — GhostMail generates a real working email address. You can use it to sign up for websites, receive verification codes, newsletters, and any other emails. Some services may block known temporary email domains, but most work fine.' },
    { q: 'Is GhostMail safe and private?', a: 'Absolutely. We store zero personal data for free users. No logs, no tracking, no ads. Emails are permanently deleted when your address expires. Paid users only share their login email which is never sold or shared.' },
    { q: 'Can I send emails from GhostMail?', a: 'No — GhostMail is receive-only. It is designed for receiving verification emails and avoiding spam, not for sending. If you need to send emails, use a regular email provider.' },
    { q: 'What happens when my address expires?', a: 'When your address expires, the address itself and all emails received to it are permanently and irreversibly deleted from our servers. There is no way to recover them — this is by design.' },
    { q: 'Can I get my money back?', a: 'Yes — we offer a full refund within 14 days of any purchase, no questions asked. Email support@ghostmails.org with your order details.' },
    { q: 'Do I need to create an account?', a: 'No account is needed for the free plan. Just click Generate and you have a working email address instantly. Creating an account is only required for paid plans.' },
  ];

  return (
    <main className={styles.main}>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>&#10022;</span>
          <span className={styles.logoText}>GhostMail</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/terms" style={{ color: '#555', fontSize: '13px', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ color: '#555', fontSize: '13px', textDecoration: 'none' }}>Privacy</a>
          {user ? (
            <a href="/dashboard" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Dashboard</a>
          ) : (
            <a href="/login" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Sign in</a>
          )}
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.tagline}>
          <span className={styles.taglineDot} />
          Instant throwaway email
        </div>
        <h1 className={styles.headline}>
          Your inbox.<br />
          <span className={styles.accentLine}>Gone in minutes.</span>
        </h1>
        <p className={styles.sub}>
          Generate a <strong>temporary email addresses</strong> instantly.
          Perfect for developers, QA testing, and protecting your primary inbox from spam. 
          Automatically deleted after expiration. Built with privacy and abuse prevention in mind.
        </p>

        {/* ✅ SOCIAL PROOF COUNTER */}
        {totalEmails !== null && totalEmails > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '999px', padding: '5px 14px', marginBottom: '1.5rem', fontFamily: 'sans-serif' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', color: '#86efac', fontWeight: '600' }}>
              {formatCount(totalEmails)} emails received today
            </span>
          </div>
        )}

        <div className={styles.card}>
          {!mailbox ? (
            <div className={styles.cardInner}>
              <button className={styles.btnPrimary} onClick={generateMailbox} disabled={loading}>
                {loading ? <span className={styles.spinner} /> : 'Generate My Address'}
              </button>
              {error && <p className={styles.errorMsg}>{error}</p>}
            </div>
          ) : (
            <div className={styles.cardInner}>
              <div className={styles.addressRow}>
                <span className={styles.addressLabel}>Your temp address</span>
                <div className={styles.addressBox}>
                  <span className={styles.addressText}>{mailbox.address}</span>
                  <button className={styles.copyBtn + (copied === mailbox.address ? ' ' + styles.copied : '')} onClick={() => copyAddress(mailbox.address)}>
                    {copied === mailbox.address ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.activePill}>Active</span>
                <span className={styles.expiryText}>{getExpiryLabel(mailbox.expires_at)}</span>
              </div>
              <div className={styles.actionRow}>
                <button className={styles.btnPrimary} onClick={() => window.location.href = '/inbox?token=' + mailbox.token}>Open Inbox</button>
                <button className={styles.btnSecondary} onClick={generateMailbox}>New Address</button>
              </div>
              <p className={styles.tokenNote}>Bookmark your inbox URL — it is your only way back in.</p>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS + PERFECT FOR */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem 5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '2rem' }}>
            <p style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.75rem' }}>The process</p>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem' }}>How it works</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { n: '01', title: 'Generate', desc: 'One click. Instant real email. No forms, no account needed.' },
                { n: '02', title: 'Use it anywhere', desc: 'Sign up for stuff, bypass spam, verify accounts.' },
                { n: '03', title: 'Emails arrive live', desc: 'Watch emails land in your inbox in real time.' },
                { n: '04', title: 'Self-destructs', desc: 'After 10 minutes — address and emails gone forever.' },
              ].map((s, i) => (
                <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(167,139,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '800', color: '#a78bfa', flexShrink: 0, fontFamily: 'monospace' }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff', marginBottom: '0.2rem' }}>{s.title}</div>
                    <div style={{ fontSize: '0.83rem', color: '#666', lineHeight: '1.5' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', padding: '2rem' }}>
            <p style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.75rem' }}>Use cases</p>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem' }}>Perfect for...</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              {[
                { emoji: '&#128717;', label: 'Online shopping' },
                { emoji: '&#127918;', label: 'Gaming accounts' },
                { emoji: '&#128104;&#8205;&#128187;', label: 'App testing' },
                { emoji: '&#128240;', label: 'Content access' },
                { emoji: '&#128272;', label: 'Staying private' },
                { emoji: '&#127891;', label: 'Free trials' },
                { emoji: '&#128188;', label: 'Competitor research' },
                { emoji: '&#128241;', label: 'App signups' },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.2rem' }} dangerouslySetInnerHTML={{ __html: item.emoji }} />
                  <span style={{ fontSize: '0.83rem', fontWeight: '500', color: '#ccc' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.stats} style={{ marginTop: '2rem' }}>
          <div className={styles.stat}><span className={styles.statNum}>10min</span><span className={styles.statLabel}>Auto-delete</span></div>
          <div className={styles.statDivider} />
          <div className={styles.stat}><span className={styles.statNum}>0</span><span className={styles.statLabel}>Data stored</span></div>
          <div className={styles.statDivider} />
          <div className={styles.stat}><span className={styles.statNum}>Free</span><span className={styles.statLabel}>Forever</span></div>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricingSection}>
        <div className={styles.howInner}>
          <h2 className={styles.howTitle}>Simple pricing</h2>
          <p className={styles.pricingSub}>No credit card games. Pick what you need.</p>
          <div className={styles.pricingGrid}>
            <div className={styles.pricingCard}>
              <div className={styles.planEmoji}>&#128123;</div>
              <h3 className={styles.planName}>Ghost</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>$0</span><span className={styles.planPer}>/forever</span></div>
              <ul className={styles.planFeatures}>
                <li>1 address at a time</li><li>10 minute lifespan</li><li>Up to 10 emails</li><li>No signup needed</li>
              </ul>
              <button className={styles.planBtnFree} onClick={generateMailbox}>Get started free</button>
            </div>
            <div className={styles.pricingCard}>
              <div className={styles.planEmoji}>&#9889;</div>
              <h3 className={styles.planName}>Phantom</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>$4.99</span><span className={styles.planPer}>/month</span></div>
              <ul className={styles.planFeatures}>
                <li>5 addresses at a time</li><li>24 hour lifespan</li><li>Up to 100 emails</li><li>Priority delivery</li>
              </ul>
              <button className={styles.planBtnPaid} onClick={() => handleUpgrade('phantom')}>Get Phantom</button>
            </div>
            <div className={styles.pricingCard + ' ' + styles.pricingCardFeatured}>
              <div className={styles.featuredBadge}>Most Popular</div>
              <div className={styles.planEmoji}>&#128293;</div>
              <h3 className={styles.planName}>Spectre</h3>
              <div className={styles.planPrice}><span className={styles.planAmount}>$8.99</span><span className={styles.planPer}>/month</span></div>
              <ul className={styles.planFeatures}>
                <li>Unlimited addresses</li><li>Emails saved forever</li><li>Unlimited emails</li><li>Priority support</li>
              </ul>
              <button className={styles.planBtnPaid} onClick={() => handleUpgrade('spectre')}>Get Spectre</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 2rem 6rem' }}>
        <p style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: '600', marginBottom: '0.75rem', textAlign: 'center' }}>Got questions</p>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', marginBottom: '0.5rem', textAlign: 'center' }}>Frequently asked</h2>
        <p style={{ color: '#555', fontSize: '0.9rem', textAlign: 'center', marginBottom: '2.5rem' }}>Everything you need to know about GhostMail</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid ' + (openFaq === i ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.07)'), borderRadius: '12px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '1rem' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#e2e2f0' }}>{faq.q}</span>
                <span style={{ color: '#a78bfa', fontSize: '1.1rem', flexShrink: 0, transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: '0 1.25rem 1.1rem', color: '#777', fontSize: '0.88rem', lineHeight: '1.7' }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <span>&#10022; GhostMail — private by design &nbsp;&#183;&nbsp; No logs. No tracking. No BS.</span>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <a href="/terms" style={{ color: '#555', fontSize: '12px', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/privacy" style={{ color: '#555', fontSize: '12px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="mailto:support@ghostmails.org" style={{ color: '#555', fontSize: '12px', textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>
    </main>
  );
}