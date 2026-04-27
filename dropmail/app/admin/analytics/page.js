'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ADMIN_EMAIL = 'erkan.iseni20@gmail.com';

export default function AnalyticsAdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        window.location.href = '/login?next=/admin/analytics';
        return;
      }

      if (session.user.email !== ADMIN_EMAIL) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      setAllowed(true);
      loadEvents();
    }

    init();
  }, []);

  async function loadEvents() {
    const { data } = await supabase
      .from('analytics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    setEvents(data || []);
    setLoading(false);
  }

  if (!allowed && !loading) {
    return <div style={{ padding: 40 }}>Access denied</div>;
  }

  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  // 📊 METRICS
  const pageViews = events.filter(e => e.event === 'page_view').length;
  const logins = events.filter(e => e.event === 'login_success').length;
  const signups = events.filter(e => e.event === 'signup_success').length;
  const clicks = events.filter(e => e.event === 'generate_email_click').length;

  return (
    <div style={{ padding: 40, color: 'white', background: '#0b0f19', minHeight: '100vh' }}>
      
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>📊 GhostMail Analytics</h1>

      {/* TOP CARDS */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 30 }}>
        <Card title="Page Views" value={pageViews} />
        <Card title="Logins" value={logins} />
        <Card title="Signups" value={signups} />
        <Card title="Clicks" value={clicks} />
      </div>

      {/* TABLE */}
      <div style={{ background: '#111827', padding: 20, borderRadius: 12 }}>
        <h2 style={{ marginBottom: 10 }}>Recent Events</h2>

        <table width="100%" style={{ fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#9ca3af' }}>
              <th>Event</th>
              <th>Path</th>
              <th>Label</th>
              <th>User</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderTop: '1px solid #1f2937' }}>
                <td>{e.event}</td>
                <td>{e.path}</td>
                <td>{e.label || '-'}</td>
                <td>{e.user_email || '-'}</td>
                <td>{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={{
      background: '#111827',
      padding: 20,
      borderRadius: 12,
      minWidth: 150
    }}>
      <p style={{ color: '#9ca3af', marginBottom: 5 }}>{title}</p>
      <h2 style={{ fontSize: 22 }}>{value}</h2>
    </div>
  );
}