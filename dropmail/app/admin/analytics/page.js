'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function pct(value, base) {
  if (!base) return '0%';
  return `${Math.round((value / base) * 100)}%`;
}

export default function AnalyticsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          window.location.href = '/login?next=/admin/analytics';
          return;
        }

        const res = await fetch('/api/admin/analytics', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load analytics');

        setEvents(data.events || []);
      } catch (err) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const stats = useMemo(() => {
    const pageViews = events.filter((e) => e.event === 'page_view').length;
    const logins = events.filter((e) => e.event === 'login_success').length;
    const signups = events.filter((e) => e.event === 'signup_success').length;
    const clicks = events.filter((e) => e.event === 'generate_email_click').length;

    const userGroups = events
      .filter((e) => e.user_email)
      .reduce((acc, e) => {
        const email = e.user_email.toLowerCase();
        if (!acc[email]) acc[email] = [];
        acc[email].push(e);
        return acc;
      }, {});

    const userJourneys = Object.entries(userGroups)
      .map(([email, userEvents]) => ({
        email,
        events: userEvents.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        ),
        lastSeen: userEvents[0]?.created_at,
      }))
      .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

    const topPages = Object.entries(
      events
        .filter((e) => e.path)
        .reduce((acc, e) => {
          acc[e.path] = (acc[e.path] || 0) + 1;
          return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    const funnel = [
      { label: 'Page Views', value: pageViews, rate: '100%' },
      { label: 'Logins', value: logins, rate: pct(logins, pageViews) },
      { label: 'Email Clicks', value: clicks, rate: pct(clicks, pageViews) },
      { label: 'Signups', value: signups, rate: pct(signups, pageViews) },
    ];

    return { pageViews, logins, signups, clicks, topPages, funnel, userJourneys };
  }, [events]);

  if (loading) return <main style={page}>Loading analytics...</main>;
  if (error) return <main style={page}>Error: {error}</main>;

  return (
    <main style={page}>
      <div style={container}>
        <div style={topbar}>
          <div>
            <p style={eyebrow}>GhostMail Admin</p>
            <h1 style={title}>Analytics Dashboard</h1>
            <p style={subtitle}>Your private product analytics hub.</p>
          </div>

          <a href="/dashboard" style={button}>Back to dashboard</a>
        </div>

        <div style={cards}>
          <Card title="Page Views" value={stats.pageViews} />
          <Card title="Logins" value={stats.logins} />
          <Card title="Signups" value={stats.signups} />
          <Card title="Email Clicks" value={stats.clicks} />
          <Card title="Known Users" value={stats.userJourneys.length} />
        </div>

        <section style={panel}>
          <h2 style={sectionTitle}>Conversion Funnel</h2>
          <p style={muted}>Shows how users move from traffic into real product actions.</p>

          <div style={funnelWrap}>
            {stats.funnel.map((item) => (
              <div key={item.label} style={funnelItem}>
                <div style={funnelTop}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>

                <div style={barTrack}>
                  <div style={{ ...barFill, width: item.rate }} />
                </div>

                <div style={funnelRate}>{item.rate}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>User Journeys</h2>
          <p style={muted}>See what each known user did recently.</p>

          {stats.userJourneys.length === 0 ? (
            <p style={muted}>No user-linked events yet.</p>
          ) : (
            <div style={journeyGrid}>
              {stats.userJourneys.map((user) => (
                <div key={user.email} style={journeyCard}>
                  <h3 style={journeyEmail}>{user.email}</h3>

                  {user.events.slice(0, 8).map((e) => (
                    <div key={e.id} style={journeyEvent}>
                      <div>
                        <strong>{e.event}</strong>
                        <div style={journeyMeta}>
                          {e.path || '-'} {e.label ? `• ${e.label}` : ''}
                        </div>
                      </div>
                      <span style={journeyTime}>
                        {new Date(e.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Top Pages</h2>
          {stats.topPages.map(([path, count]) => (
            <div key={path} style={row}>
              <span>{path}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Recent Events</h2>

          <div style={table}>
            <div style={thead}>
              <span>Event</span>
              <span>Path</span>
              <span>Label</span>
              <span>User</span>
              <span>Time</span>
            </div>

            {events.map((e) => (
              <div key={e.id} style={trow}>
                <span>{e.event}</span>
                <span>{e.path || '-'}</span>
                <span>{e.label || '-'}</span>
                <span>{e.user_email || '-'}</span>
                <span>{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }) {
  return (
    <div style={card}>
      <p style={cardTitle}>{title}</p>
      <h2 style={cardValue}>{value}</h2>
    </div>
  );
}

const page = {
  minHeight: '100vh',
  padding: '40px 24px',
  background:
    'linear-gradient(180deg, rgba(109,73,255,0.08), rgba(109,73,255,0.02)), #f6f4ff',
  color: '#14122b',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const container = { maxWidth: 1180, margin: '0 auto' };

const topbar = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  alignItems: 'flex-start',
  marginBottom: 28,
  flexWrap: 'wrap',
};

const eyebrow = {
  color: '#6d49ff',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontSize: 12,
  margin: 0,
};

const title = {
  fontSize: 48,
  lineHeight: 1,
  margin: '8px 0',
  fontWeight: 900,
  letterSpacing: '-0.05em',
};

const subtitle = { color: '#5d647a', margin: 0 };

const button = {
  padding: '13px 18px',
  borderRadius: 14,
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 800,
};

const cards = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

const card = {
  background: '#fff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 22,
  padding: 22,
  boxShadow: '0 14px 34px rgba(15,23,42,0.06)',
};

const cardTitle = {
  color: '#5d647a',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
};

const cardValue = {
  fontSize: 36,
  margin: '10px 0 0',
  fontWeight: 900,
};

const panel = {
  background: '#fff',
  border: '1px solid rgba(15,23,42,0.08)',
  borderRadius: 24,
  padding: 22,
  marginBottom: 24,
  boxShadow: '0 14px 34px rgba(15,23,42,0.06)',
};

const sectionTitle = { margin: '0 0 8px', fontSize: 22 };
const muted = { margin: '0 0 18px', color: '#5d647a' };

const funnelWrap = { display: 'grid', gap: 16 };

const funnelItem = {
  padding: 16,
  borderRadius: 18,
  background: 'rgba(109,73,255,0.04)',
  border: '1px solid rgba(109,73,255,0.10)',
};

const funnelTop = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 10,
};

const barTrack = {
  height: 10,
  borderRadius: 999,
  background: 'rgba(15,23,42,0.08)',
  overflow: 'hidden',
};

const barFill = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
};

const funnelRate = {
  marginTop: 8,
  fontSize: 13,
  fontWeight: 800,
  color: '#6d49ff',
};

const journeyGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
};

const journeyCard = {
  padding: 18,
  borderRadius: 18,
  background: 'rgba(109,73,255,0.04)',
  border: '1px solid rgba(109,73,255,0.10)',
};

const journeyEmail = {
  margin: '0 0 14px',
  fontSize: 16,
  wordBreak: 'break-word',
};

const journeyEvent = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 0',
  borderTop: '1px solid rgba(15,23,42,0.06)',
};

const journeyMeta = {
  color: '#5d647a',
  fontSize: 13,
  marginTop: 3,
};

const journeyTime = {
  color: '#6d49ff',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: '1px solid rgba(15,23,42,0.06)',
};

const table = { overflowX: 'auto' };

const thead = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1.4fr',
  gap: 12,
  color: '#5d647a',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  paddingBottom: 12,
  borderBottom: '1px solid rgba(15,23,42,0.08)',
};

const trow = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1.5fr 1.4fr',
  gap: 12,
  padding: '13px 0',
  borderBottom: '1px solid rgba(15,23,42,0.06)',
  fontSize: 14,
};