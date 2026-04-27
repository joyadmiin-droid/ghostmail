'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
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

    const topPages = Object.entries(
      events
        .filter((e) => e.path)
        .reduce((acc, e) => {
          acc[e.path] = (acc[e.path] || 0) + 1;
          return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    return { pageViews, logins, signups, clicks, topPages };
  }, [events]);

  if (loading) {
    return <main style={page}>Loading analytics...</main>;
  }

  if (error) {
    return <main style={page}>Error: {error}</main>;
  }

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
        </div>

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

const container = {
  maxWidth: 1180,
  margin: '0 auto',
};

const topbar = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  alignItems: 'flex-start',
  marginBottom: 28,
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

const subtitle = {
  color: '#5d647a',
  margin: 0,
};

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

const sectionTitle = {
  margin: '0 0 16px',
  fontSize: 22,
};

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: '1px solid rgba(15,23,42,0.06)',
};

const table = {
  overflowX: 'auto',
};

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