'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('addresses');
  const [addresses, setAddresses] = useState([]);
  const [emailsCount, setEmailsCount] = useState(0);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [toasts, setToasts] = useState([]);
  const knownEmailIds = useRef(new Set());
  const initialized = useRef(false);

  function addToast(message) {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }

  async function checkForNewEmails(addrs) {
    if (!addrs || addrs.length === 0) return;
    const mailboxIds = addrs.map(m => m.id);
    const { data: emails } = await supabase
      .from('emails')
      .select('id, subject, from_address, mailbox_id')
      .in('mailbox_id', mailboxIds)
      .order('received_at', { ascending: false })
      .limit(20);
    if (!emails) return;
    emails.forEach(email => {
      if (!knownEmailIds.current.has(email.id)) {
        if (knownEmailIds.current.size > 0) {
          addToast('New email from ' + (email.from_address || 'Someone') + ': ' + (email.subject || '(no subject)'));
        }
        knownEmailIds.current.add(email.id);
      }
    });
  }

  async function loadUserData(userId) {
    if (initialized.current) return;
    initialized.current = true;

    const { data: profile } = await supabase
      .from('profiles').select('plan').eq('id', userId).single();
    if (profile) setPlan(profile.plan);

    const { data: addrs } = await supabase
      .from('mailboxes').select('*')
      .eq('user_id', userId).eq('is_active', true)
      .order('created_at', { ascending: false });

    if (addrs?.length) {
      setAddresses(addrs);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const mailboxIds = addrs.map(m => m.id);
      const { count } = await supabase.from('emails')
        .select('id', { count: 'exact' })
        .in('mailbox_id', mailboxIds)
        .gte('received_at', today.toISOString());
      setEmailsCount(count || 0);
      await checkForNewEmails(addrs);
    }
    setAuthChecked(true);
  }

  useEffect(() => {
    // ✅ THE FIX: Use onAuthStateChange as the single source of truth
    // This fires correctly after OAuth redirects, email logins, and page loads
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'User:', session?.user?.email);

      if (event === 'SIGNED_OUT') {
        window.location.href = '/login';
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await loadUserData(session.user.id);
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session on initial load — redirect to login
        window.location.href = '/login';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    const interval = setInterval(() => checkForNewEmails(addresses), 10000);
    return () => clearInterval(interval);
  }, [authChecked, addresses]);

  async function handleSignOut() {
    initialized.current = false;
    await supabase.auth.signOut();
    window.location.href = '/';
  }

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
      if (data.url) window.location.href = data.url;
      else throw new Error('No checkout URL received');
    } catch (err) {
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
      if (session?.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
      const res = await fetch('/api/mailbox/create', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setAddresses(prev => [data, ...prev]);
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

  async function deleteAddress(id) {
    if (!confirm('Delete this address? All emails will be gone forever.')) return;
    await supabase.from('mailboxes').update({ is_active: false }).eq('id', id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  }

  function getExpiryLabel(expiresAt) {
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Expired';
    const mins = Math.round(diff / 60000);
    if (mins > 60 * 24) return Math.round(mins / 60 / 24) + 'd left';
    if (mins > 60) return Math.round(mins / 60) + 'h left';
    return mins + 'm left';
  }

  const username = user?.email?.split('@')[0];
  const planLabel = plan === 'spectre' ? 'Spectre' : plan === 'phantom' ? 'Phantom' : 'Ghost';
  const planEmoji = plan === 'spectre' ? '\uD83D\uDD25' : plan === 'phantom' ? '\u26A1' : '\uD83D\uDC7B';
  const planHint = plan === 'spectre' ? 'Unlimited everything' : plan === 'phantom' ? '$4.99/mo' : 'Free forever';

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid rgba(167,139,250,0.2)', borderTop: '3px solid #a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ color: '#a78bfa', fontSize: '14px', fontFamily: 'sans-serif' }}>Loading your dashboard...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d14', fontFamily: 'inherit' }}>
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* TOASTS */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{ background: '#13131f', border: '1px solid rgba(167,139,250,0.4)', borderRadius: '12px', padding: '12px 16px', color: '#e2e2f0', fontSize: '13px', fontFamily: 'sans-serif', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', gap: '10px', animation: 'slideIn 0.3s ease' }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>&#128236;</span>
            <div>
              <div style={{ fontWeight: '600', color: '#a78bfa', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New email</div>
              <div style={{ color: '#aaa', fontSize: '12px', lineHeight: '1.4' }}>{toast.message}</div>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', marginLeft: 'auto', flexShrink: 0, padding: '0' }}>&#10005;</button>
          </div>
        ))}
      </div>

      {/* SIDEBAR */}
      <div style={{ width: '220px', background: '#0a0a10', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span style={{ color: '#a78bfa', fontSize: '16px' }}>&#10022;</span>
            <span style={{ color: '#fff', fontSize: '15px', fontWeight: '700' }}>GhostMail</span>
          </a>
        </div>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#a78bfa', marginBottom: '8px' }}>
            {username?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{username}</div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{planEmoji} {planLabel}</div>
        </div>
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {[
            { id: 'addresses', icon: '&#128236;', label: 'Addresses' },
            { id: 'inbox', icon: '&#128229;', label: 'Inbox' },
            { id: 'plan', icon: '&#9889;', label: 'Upgrade' },
            { id: 'settings', icon: '&#9881;', label: 'Settings' },
          ].map(item => (
            <div key={item.id} onClick={() => setActiveTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: activeTab === item.id ? '#a78bfa' : '#666', background: activeTab === item.id ? 'rgba(167,139,250,0.08)' : 'transparent', borderLeft: activeTab === item.id ? '2px solid #a78bfa' : '2px solid transparent' }}>
              <span style={{ fontSize: '14px', width: '18px', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: item.icon }} />
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
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>Welcome back, {username}</div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{user?.email}</div>
          </div>
          <button onClick={generateMailbox} disabled={loading} style={{ padding: '8px 18px', borderRadius: '99px', border: 'none', background: '#a78bfa', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
            {loading ? '...' : 'Generate address'}
          </button>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {activeTab === 'addresses' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                  { label: 'Active addresses', value: addresses.length, hint: plan === 'spectre' ? 'Unlimited' : plan === 'phantom' ? '5 max' : '1 max' },
                  { label: 'Emails received', value: emailsCount, hint: 'today' },
                  { label: 'Plan', value: planEmoji + ' ' + planLabel, hint: planHint },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: s.label === 'Plan' ? '16px' : '24px', fontWeight: '700', color: '#fff' }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>{s.hint}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '16px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>Create a throwaway address</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {plan === 'spectre' ? 'Instant · Saved forever' : plan === 'phantom' ? 'Instant · 24hr lifespan' : 'Instant · Auto-deletes in 10 min'}
                  </div>
                </div>
                <button onClick={generateMailbox} disabled={loading} style={{ padding: '10px 20px', borderRadius: '99px', border: 'none', background: '#a78bfa', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  {loading ? '...' : 'Generate now'}
                </button>
              </div>
              {addresses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {addresses.map(addr => {
                    const isExpiringSoon = new Date(addr.expires_at) < new Date(Date.now() + 30 * 60 * 1000);
                    const dotColor = isExpiringSoon ? '#f87171' : addr.email_count > 0 ? '#fbbf24' : '#22c55e';
                    const borderColor = isExpiringSoon ? 'rgba(248,113,113,0.35)' : 'rgba(34,197,94,0.25)';
                    const copyBorder = copied === addr.address ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(167,139,250,0.3)';
                    const copyBg = copied === addr.address ? 'rgba(34,197,94,0.1)' : 'rgba(167,139,250,0.1)';
                    const copyColor = copied === addr.address ? '#22c55e' : '#a78bfa';
                    return (
                      <div key={addr.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid ' + borderColor, borderRadius: '12px', padding: '16px', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '12px', right: '12px', width: '8px', height: '8px', borderRadius: '50%', background: dotColor }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</span>
                          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '600' }}>&#9203; {getExpiryLabel(addr.expires_at)}</span>
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#a78bfa', marginBottom: '12px' }}>{addr.address}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button onClick={() => copyAddress(addr.address)} style={{ padding: '7px 16px', borderRadius: '8px', border: copyBorder, background: copyBg, color: copyColor, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {copied === addr.address ? 'Copied' : 'Copy'}
                          </button>
                          <a href={'/inbox?token=' + addr.token} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: '#fff', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
                            Open Inbox
                          </a>
                          <button onClick={() => deleteAddress(addr.id)} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#444', fontSize: '13px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px', opacity: '0.4' }}>&#128123;</div>
                  No addresses yet — generate your first one above!
                </div>
              )}
              {error && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
            </div>
          )}

          {activeTab === 'inbox' && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px', opacity: '0.4' }}>&#128205;</div>
              No emails yet. Use a generated address somewhere to receive emails here.
            </div>
          )}

          {activeTab === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Current plan</div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>{planEmoji} {planLabel}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{planHint}</div>
              </div>
              {upgradeError && (
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>{upgradeError}</div>
              )}
              {plan !== 'spectre' && (
                <>
                  <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Upgrade</div>
                  {plan !== 'phantom' && (
                    <div style={{ background: 'rgba(167,139,250,0.08)', border: '2px solid rgba(167,139,250,0.3)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', background: 'rgba(167,139,250,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '99px', display: 'inline-block', marginBottom: '8px' }}>Most popular</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>Phantom — $4.99/mo</div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>5 addresses · 24hr lifespan · 100 emails</div>
                      <button onClick={() => handleUpgrade('phantom')} disabled={upgradeLoading} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', background: '#a78bfa', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: upgradeLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: upgradeLoading ? 0.7 : 1 }}>
                        {upgradeLoading ? 'Redirecting...' : 'Upgrade to Phantom'}
                      </button>
                    </div>
                  )}
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>Spectre — $8.99/mo</div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>Unlimited addresses · Forever · Unlimited emails</div>
                    <button onClick={() => handleUpgrade('spectre')} disabled={upgradeLoading} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'none', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: upgradeLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: upgradeLoading ? 0.7 : 1 }}>
                      {upgradeLoading ? 'Redirecting...' : 'Upgrade to Spectre'}
                    </button>
                  </div>
                </>
              )}
              {plan === 'spectre' && (
                <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>&#128293;</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>You are on Spectre!</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>You have the best plan. Enjoy unlimited everything!</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Account</div>
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
                {[
                  { label: 'Email', value: user?.email },
                  { label: 'Username', value: username },
                  { label: 'Plan', value: planEmoji + ' ' + planLabel },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>{row.label}</div>
                      <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{row.value}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontWeight: '600' }}>Danger zone</div>
              <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#f87171', fontWeight: '500' }}>Delete account</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>Permanently remove everything</div>
                </div>
                <button onClick={() => { if (confirm('Are you sure? This cannot be undone.')) handleSignOut(); }} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
