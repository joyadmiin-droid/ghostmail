'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [emails, setEmails] = useState([]);
  const [activeTab, setActiveTab] = useState('addresses');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);

      // Fetch profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(prof);

      // Fetch addresses
      await fetchAddresses(session.user.id);
      setLoading(false);
    });
  }, []);

  async function fetchAddresses(userId) {
    const { data } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    setAddresses(data || []);

    // Fetch all emails for these mailboxes
    if (data?.length) {
      const mailboxIds = data.map(m => m.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: emailData } = await supabase
        .from('emails')
        .select('*')
        .in('mailbox_id', mailboxIds)
        .gte('received_at', today.toISOString())
        .order('received_at', { ascending: false });
      setEmails(emailData || []);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/mailbox/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (data.address) await fetchAddresses(user.id);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  async function copyAddress(address) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff' }}>
      Loading...
    </div>
  );

  const username = user?.email?.split('@')[0];
  const planName = profile?.plan || 'free';
  const planEmoji = planName === 'spectre' ? '🔥' : planName === 'phantom' ? '⚡' : '👻';
  const planLabel = planName.charAt(0).toUpperCase() + planName.slice(1);

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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'inherit' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#fff', fontSize: '18px', fontWeight: '700' }}>
          ✦ GhostMail
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#a78bfa' }}>👻 {username}</span>
          <button onClick={handleSignOut} style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '99px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>👋 Welcome back, {username}</h1>
            <p style={{ fontSize: '14px', color: '#888' }}>{user?.email} · {planEmoji} {planLabel} plan</p>
          </div>
          <button onClick={handleGenerate} disabled={generating} style={{
            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
            color: '#fff', border: 'none', borderRadius: '12px',
            padding: '10px 20px', fontSize: '14px', fontWeight: '700',
            cursor: 'pointer', fontFamily: 'inherit', opacity: generating ? 0.7 : 1
          }}>
            {generating ? '...' : '⚡ Generate address'}
          </button>
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
                { label: 'Active addresses', value: addresses.length },
                { label: 'Emails today', value: emails.length },
                { label: 'Plan', value: `${planEmoji} ${planLabel}` },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '700' }}>{s.value}</div>
                </div>
              ))}
            </div>

            {addresses.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
                No active addresses yet — click "Generate address" above!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {addresses.map(addr => (
                  <div key={addr.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '15px', color: '#f5f3ee', marginBottom: '4px' }}>{addr.address}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        Expires: {new Date(addr.expires_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => copyAddress(addr.address)} style={{
                        background: copied === addr.address ? 'rgba(34,197,94,0.15)' : 'rgba(167,139,250,0.15)',
                        color: copied === addr.address ? '#22c55e' : '#a78bfa',
                        border: `1px solid ${copied === addr.address ? 'rgba(34,197,94,0.3)' : 'rgba(167,139,250,0.3)'}`,
                        borderRadius: '8px', padding: '6px 14px', fontSize: '13px',
                        fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit'
                      }}>
                        {copied === addr.address ? '✓' : 'Copy'}
                      </button>
                      <a href={`/inbox?token=${addr.token}`} style={{
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px', padding: '6px 14px', fontSize: '13px',
                        fontWeight: '600', textDecoration: 'none'
                      }}>
                        Open →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INBOX TAB */}
        {activeTab === 'inbox' && (
          <div>
            {emails.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
                No emails yet today!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {emails.map(email => (
                  <div key={email.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>{email.subject || '(no subject)'}</span>
                      <span style={{ fontSize: '12px', color: '#888' }}>{new Date(email.received_at).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>From: {email.from_name || email.from_address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PLAN TAB */}
        {activeTab === 'plan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current plan</div>
              <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>{planEmoji} {planLabel}</div>
              <div style={{ fontSize: '14px', color: '#888' }}>
                {planName === 'free' ? 'Free forever' : planName === 'phantom' ? '$4.99/month' : '$8.99/month'}
              </div>
            </div>

            {planName === 'free' && (
              <>
                <div style={{ background: 'rgba(167,139,250,0.08)', border: '2px solid rgba(167,139,250,0.4)', borderRadius: '16px', padding: '20px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>⚡ Phantom</div>
                  <div style={{ fontSize: '14px', color: '#888', marginBottom: '16px' }}>$4.99 / month</div>
                  <ul style={{ listStyle: 'none', fontSize: '13px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    <li>✓ 5 addresses at a time</li>
                    <li>✓ 24 hour lifespan</li>
                    <li>✓ Up to 100 emails</li>
                  </ul>
                  <button onClick={() => window.location.href = '/'} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.4)', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
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
                  </ul>
                  <button onClick={() => window.location.href = '/'} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Upgrade to Spectre 🔥
                  </button>
                </div>
              </>
            )}

            {planName !== 'free' && (
              <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#22c55e' }}>You're on {planLabel}!</div>
                <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Enjoying all premium features</div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
              {[
                { label: 'Email', value: user?.email },
                { label: 'Username', value: username },
                { label: 'Plan', value: `${planEmoji} ${planLabel}` },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>{row.label}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{row.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '16px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#f87171' }}>Delete account</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>Permanently remove your account</div>
                </div>
                <button onClick={handleDeleteAccount} style={{ fontSize: '13px', padding: '5px 14px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}