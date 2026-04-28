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

function money(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '$0';
  return `$${num.toFixed(num % 1 === 0 ? 0 : 2)}`;
}

function countryCodeToFlag(code) {
  if (!code || code.length !== 2) return '🌍';
  return code
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt())
    );
}

function getEventCountry(event) {
  return event?.metadata?.country || event?.metadata?.countryName || null;
}

function getPaymentEmail(payment) {
  return (
    payment.email ||
    payment.user_email ||
    payment.customer_email ||
    payment.billing_email ||
    payment.meta?.email ||
    ''
  ).toLowerCase();
}

function getPaymentAmount(payment) {
  return (
    payment.amount ||
    payment.total ||
    payment.price ||
    payment.amount_total ||
    payment.total_usd ||
    0
  );
}

function getPaymentPlan(payment) {
  const raw =
    payment.plan ||
    payment.product_name ||
    payment.variant_name ||
    payment.product ||
    payment.name ||
    '';

  const value = String(raw).toLowerCase();

  if (value.includes('spectre')) return 'spectre';
  if (value.includes('phantom')) return 'phantom';
  if (value.includes('ghost')) return 'ghost';

  return raw || 'paid';
}

function daysSince(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '—';
  return Math.max(0, Math.floor(diff / 86400000));
}

function monthKey(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(count = 6) {
  const out = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleString(undefined, { month: 'short' }),
    });
  }

  return out;
}

function MiniLineChart({ data, theme }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data
    .map((d, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 90 - (d.value / max) * 72;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div style={chartWrap}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={chartSvg}>
        <polyline
          fill="none"
          stroke={theme === 'dark' ? '#78e08f' : '#6d49ff'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>

      <div style={chartLabels}>
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('ghostmail-analytics-theme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

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
        setProfiles(data.profiles || []);
        setPayments(data.payments || []);
      } catch (err) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ghostmail-analytics-theme', next);
  }

  const t = theme === 'dark' ? darkTheme : lightTheme;

  const stats = useMemo(() => {
    const pageViews = events.filter((e) => e.event === 'page_view').length;
    const logins = events.filter((e) => e.event === 'login_success').length;
    const signups = events.filter((e) => e.event === 'signup_success').length;
    const clicks = events.filter((e) => e.event === 'generate_email_click').length;

    const revenue = payments.reduce(
      (sum, p) => sum + Number(getPaymentAmount(p) || 0),
      0
    );

    const profileMap = {};
    profiles.forEach((p) => {
      if (p.email) profileMap[p.email.toLowerCase()] = p;
    });

    const paymentsByEmail = {};
    payments.forEach((p) => {
      const email = getPaymentEmail(p);
      if (!email) return;
      if (!paymentsByEmail[email]) paymentsByEmail[email] = [];
      paymentsByEmail[email].push(p);
    });

    Object.keys(paymentsByEmail).forEach((email) => {
      paymentsByEmail[email].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      );
    });

    const userGroups = events
      .filter((e) => e.user_email)
      .reduce((acc, e) => {
        const email = e.user_email.toLowerCase();
        if (!acc[email]) acc[email] = [];
        acc[email].push(e);
        return acc;
      }, {});

    const allEmails = new Set([
      ...Object.keys(userGroups),
      ...Object.keys(profileMap),
      ...Object.keys(paymentsByEmail),
    ]);

    const userJourneys = Array.from(allEmails)
      .map((email) => {
        const userEvents = (userGroups[email] || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        const userPayments = paymentsByEmail[email] || [];
        const profile = profileMap[email] || {};
        const latestPayment = userPayments[0];

        const paidTotal = userPayments.reduce(
          (sum, p) => sum + Number(getPaymentAmount(p) || 0),
          0
        );

        const country = getEventCountry(userEvents.find((e) => getEventCountry(e)));

        const plan = profile.plan || getPaymentPlan(latestPayment || {}) || 'ghost';
        const isPaid =
          plan === 'phantom' ||
          plan === 'spectre' ||
          userPayments.length > 0;

        const lastSeen =
          userEvents[0]?.created_at ||
          latestPayment?.created_at ||
          profile.created_at ||
          null;

        return {
          email,
          events: userEvents,
          payments: userPayments,
          profile,
          plan,
          isPaid,
          paidTotal,
          latestPayment,
          lastSeen,
          country,
        };
      })
      .sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));

    const paidUsers = userJourneys.filter((u) => u.isPaid).length;
    const churn = paidUsers ? Math.max(0, Math.round(((paidUsers - payments.length) / paidUsers) * 100)) : 0;

    const months = lastMonths(6);
    const revenueByMonth = months.map((m) => ({
      ...m,
      value: payments
        .filter((p) => monthKey(p.created_at) === m.key)
        .reduce((sum, p) => sum + Number(getPaymentAmount(p) || 0), 0),
    }));

    const eventTrend = months.map((m) => ({
      ...m,
      value: events.filter((e) => monthKey(e.created_at) === m.key).length,
    }));

    const topPages = Object.entries(
      events
        .filter((e) => e.path)
        .reduce((acc, e) => {
          acc[e.path] = (acc[e.path] || 0) + 1;
          return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    const topCountries = Object.entries(
      events.reduce((acc, e) => {
        const country = getEventCountry(e);
        if (!country) return acc;
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

    const funnel = [
      { label: 'Page Views', value: pageViews, rate: '100%' },
      { label: 'Logins', value: logins, rate: pct(logins, pageViews) },
      { label: 'Email Clicks', value: clicks, rate: pct(clicks, pageViews) },
      { label: 'Signups', value: signups, rate: pct(signups, pageViews) },
    ];

    return {
      pageViews,
      logins,
      signups,
      clicks,
      revenue,
      mrr: revenue,
      arr: revenue * 12,
      paidUsers,
      churn,
      topPages,
      topCountries,
      funnel,
      userJourneys,
      revenueByMonth,
      eventTrend,
    };
  }, [events, profiles, payments]);

  const filteredUsers = stats.userJourneys.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = stats.userJourneys.find((u) => u.email === selectedEmail);

  if (loading) {
    return (
      <main style={{ ...pageBase, background: t.pageBg, color: t.text }}>
        <div style={container}>Loading analytics...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ ...pageBase, background: t.pageBg, color: t.text }}>
        <div style={container}>Error: {error}</div>
      </main>
    );
  }

  return (
    <main style={{ ...pageBase, background: t.pageBg, color: t.text }}>
      <div style={container}>
        <div style={topNav}>
          <div style={brand}>
            <div style={{ ...logoBox, background: t.logoBg, color: t.logoText }}>G</div>
            <strong>GhostMail</strong>
            <span style={{ ...pill, background: t.softBg, color: t.muted }}>
              admin analytics
            </span>
          </div>

          <div style={navActions}>
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                ...iconButton,
                background: t.card,
                borderColor: t.border,
                color: t.text,
              }}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>

            <a href="/dashboard" style={primaryButton}>
              Back to dashboard
            </a>
          </div>
        </div>

        <header style={hero}>
          <div>
            <p style={eyebrow}>01 · Headline metrics</p>
            <h1 style={{ ...title, color: t.text }}>Analytics Dashboard</h1>
            <p style={{ ...subtitle, color: t.muted }}>
              Private product analytics, traffic, conversion funnel, countries and user journeys.
            </p>
          </div>

          <div style={{ ...statusPill, background: t.card, borderColor: t.border }}>
            <span style={liveDot} />
            Live data
          </div>
        </header>

        <div style={metricGrid}>
          <MetricCard t={t} title="Revenue" value={money(stats.revenue)} note="total tracked" />
          <MetricCard t={t} title="MRR" value={money(stats.mrr)} note="current estimate" />
          <MetricCard t={t} title="ARR" value={money(stats.arr)} note="MRR × 12" />
          <MetricCard t={t} title="Paid Users" value={stats.paidUsers} note="active paid" />
          <MetricCard t={t} title="Page Views" value={stats.pageViews} note="all events" />
          <MetricCard t={t} title="Known Users" value={stats.userJourneys.length} note="profiles + events" />
        </div>

        <section style={sectionHeader}>
          <p style={eyebrow}>02 · Trajectory</p>
        </section>

        <div style={trajectoryGrid}>
          <section style={{ ...panel(t), minHeight: 360 }}>
            <div style={panelTop}>
              <div>
                <p style={{ ...mutedText, color: t.muted }}>
                  Gross revenue tracked from payment records.
                </p>
                <h2 style={sectionTitle}>Revenue</h2>
              </div>
              <strong style={bigNumber}>{money(stats.revenue)}</strong>
            </div>

            <MiniLineChart data={stats.revenueByMonth} theme={theme} />
          </section>

          <section style={{ ...panel(t), minHeight: 360 }}>
            <SmallTrend t={t} label="MRR" value={money(stats.mrr)} data={stats.revenueByMonth} theme={theme} />
            <SmallTrend t={t} label="ARR" value={money(stats.arr)} data={stats.revenueByMonth} theme={theme} />
            <SmallTrend t={t} label="Events" value={events.length} data={stats.eventTrend} theme={theme} />
            <SmallTrend t={t} label="Churn" value={`${stats.churn}%`} data={stats.eventTrend} theme={theme} last />
          </section>
        </div>

        <div style={metricGrid}>
          <MetricCard t={t} title="Logins" value={stats.logins} note={pct(stats.logins, stats.pageViews)} />
          <MetricCard t={t} title="Signups" value={stats.signups} note={pct(stats.signups, stats.pageViews)} />
          <MetricCard t={t} title="Email Clicks" value={stats.clicks} note={pct(stats.clicks, stats.pageViews)} />
          <MetricCard t={t} title="Events" value={events.length} note="recent product actions" />
        </div>

        <section style={panel(t)}>
          <h2 style={sectionTitle}>Conversion Funnel</h2>
          <p style={{ ...mutedText, color: t.muted }}>
            Shows how users move from traffic into real product actions.
          </p>

          <div style={funnelWrap}>
            {stats.funnel.map((item) => (
              <div key={item.label} style={{ ...funnelItem, background: t.softBg, borderColor: t.border }}>
                <div style={funnelTop}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
                <div style={{ ...barTrack, background: t.track }}>
                  <div style={{ ...barFill, width: item.rate }} />
                </div>
                <div style={funnelRate}>{item.rate}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={twoCol}>
          <section style={panel(t)}>
            <h2 style={sectionTitle}>Top Countries</h2>
            <p style={{ ...mutedText, color: t.muted }}>
              Countries detected from analytics event metadata.
            </p>

            {stats.topCountries.length === 0 ? (
              <p style={{ color: t.muted }}>No country data yet.</p>
            ) : (
              stats.topCountries.map(([country, count]) => (
                <div key={country} style={{ ...row(t) }}>
                  <span>
                    {countryCodeToFlag(country)} {country}
                  </span>
                  <strong>{count}</strong>
                </div>
              ))
            )}
          </section>

          <section style={panel(t)}>
            <h2 style={sectionTitle}>Top Pages</h2>
            <p style={{ ...mutedText, color: t.muted }}>
              Most viewed pages and tracked paths.
            </p>

            {stats.topPages.length === 0 ? (
              <p style={{ color: t.muted }}>No page data yet.</p>
            ) : (
              stats.topPages.slice(0, 8).map(([path, count]) => (
                <div key={path} style={{ ...row(t) }}>
                  <span style={truncate}>{path}</span>
                  <strong>{count}</strong>
                </div>
              ))
            )}
          </section>
        </div>

        <section style={panel(t)}>
          <h2 style={sectionTitle}>Users</h2>
          <p style={{ ...mutedText, color: t.muted }}>
            Click a user to see their full journey and subscription info.
          </p>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user email..."
            style={{
              ...searchInput,
              background: t.input,
              color: t.text,
              borderColor: t.border,
            }}
          />

          {selectedUser && (
            <div style={{ ...selectedBox, background: t.softBg, borderColor: t.border }}>
              <h3 style={{ margin: '0 0 8px' }}>
                {selectedUser.country ? `${countryCodeToFlag(selectedUser.country)} ` : ''}
                {selectedUser.email}
              </h3>

              <div style={metricGridSmall}>
                <MetricCard t={t} title="Plan" value={selectedUser.plan || 'ghost'} note="current plan" />
                <MetricCard t={t} title="Status" value={selectedUser.isPaid ? 'Paid' : 'Free'} note="billing state" />
                <MetricCard t={t} title="Paid Total" value={money(selectedUser.paidTotal)} note="lifetime value" />
                <MetricCard
                  t={t}
                  title="Subscriber Days"
                  value={daysSince(
                    selectedUser.latestPayment?.created_at || selectedUser.profile?.created_at
                  )}
                  note="since first record"
                />
              </div>
            </div>
          )}

          <div style={userList}>
            {filteredUsers.map((user) => (
              <button
                key={user.email}
                type="button"
                style={{
                  ...userRow,
                  background: selectedEmail === user.email ? t.softBg : t.rowBg,
                  color: t.text,
                  borderColor:
                    selectedEmail === user.email
                      ? 'rgba(109,73,255,0.55)'
                      : t.border,
                }}
                onClick={() => setSelectedEmail(user.email)}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ ...truncateBlock, color: t.text }}>
                    {user.country ? `${countryCodeToFlag(user.country)} ` : ''}
                    {user.email}
                  </strong>
                  <div style={{ ...smallMuted, color: t.muted }}>
                    {user.events.length} events • last seen{' '}
                    {user.lastSeen ? new Date(user.lastSeen).toLocaleString() : '—'}
                  </div>
                </div>

                <div style={userBadges}>
                  <span style={planBadge}>{user.plan || 'ghost'}</span>
                  <span style={user.isPaid ? paidBadge : freeBadge}>
                    {user.isPaid ? 'paid' : 'free'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {selectedUser && (
          <section style={panel(t)}>
            <h2 style={{ ...sectionTitle, color: t.text }}>
              {selectedUser.country ? `${countryCodeToFlag(selectedUser.country)} ` : ''}
              {selectedUser.email}
            </h2>
            <p style={{ ...mutedText, color: t.muted }}>
              User stats, plan info, payments, and recent timeline.
            </p>

            <h3 style={miniTitle}>Payments</h3>
            {selectedUser.payments.length === 0 ? (
              <p style={{ color: t.muted }}>No payments found for this user.</p>
            ) : (
              selectedUser.payments.slice(0, 6).map((p) => (
                <div key={p.id || p.created_at} style={{ ...paymentRow, borderColor: t.border }}>
                  <span>{getPaymentPlan(p)}</span>
                  <strong>{money(getPaymentAmount(p))}</strong>
                  <span>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</span>
                </div>
              ))
            )}

            <h3 style={miniTitle}>Timeline</h3>
            {selectedUser.events.length === 0 ? (
              <p style={{ color: t.muted }}>No events found for this user.</p>
            ) : (
              selectedUser.events.map((e) => {
                const country = getEventCountry(e);

                return (
                  <div key={e.id} style={{ ...timelineRow, borderColor: t.border }}>
                    <div>
                      <strong>
                        {country ? `${countryCodeToFlag(country)} ` : ''}
                        {e.event}
                      </strong>
                      <div style={{ ...smallMuted, color: t.muted }}>
                        {e.path || '-'} {e.label ? `• ${e.label}` : ''}
                        {country ? ` • ${country}` : ''}
                      </div>
                    </div>
                    <span style={timeText}>
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        )}

        <section style={panel(t)}>
          <h2 style={sectionTitle}>Recent Events</h2>

          <div style={table}>
            <div style={{ ...thead, color: t.muted, borderColor: t.border }}>
              <span>Event</span>
              <span>Path</span>
              <span>Country</span>
              <span>Label</span>
              <span>User</span>
              <span>Time</span>
            </div>

            {events.map((e) => {
              const country = getEventCountry(e);

              return (
                <div key={e.id} style={{ ...trow, borderColor: t.border }}>
                  <span>{e.event}</span>
                  <span>{e.path || '-'}</span>
                  <span>{country ? `${countryCodeToFlag(country)} ${country}` : '-'}</span>
                  <span>{e.label || '-'}</span>
                  <span>{e.user_email || '-'}</span>
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ t, title, value, note }) {
  return (
    <div style={{ ...metricCard, background: t.card, borderColor: t.border }}>
      <p style={{ ...cardTitle, color: t.muted }}>{title}</p>
      <h2 style={{ ...cardValue, color: t.text }}>{value}</h2>
      <p style={{ ...cardNote, color: t.muted }}>{note}</p>
    </div>
  );
}

function SmallTrend({ t, label, value, data, theme, last }) {
  return (
    <div style={{ ...smallTrend, borderColor: t.border, borderBottom: last ? 'none' : `1px solid ${t.border}` }}>
      <div style={smallTrendTop}>
        <span style={{ color: t.muted }}>{label}</span>
        <strong style={{ color: t.text }}>{value}</strong>
      </div>
      <MiniLineChart data={data} theme={theme} />
    </div>
  );
}

const darkTheme = {
  pageBg: '#08090d',
  card: '#121319',
  softBg: 'rgba(120,224,143,0.07)',
  rowBg: 'rgba(255,255,255,0.025)',
  input: '#0f1015',
  border: 'rgba(255,255,255,0.08)',
  text: '#f5f7fb',
  muted: '#8d93a5',
  track: 'rgba(255,255,255,0.08)',
  logoBg: '#f5f7fb',
  logoText: '#08090d',
};

const lightTheme = {
  pageBg: 'linear-gradient(180deg, rgba(109,73,255,0.08), rgba(109,73,255,0.02)), #f6f4ff',
  card: '#ffffff',
  softBg: 'rgba(109,73,255,0.06)',
  rowBg: 'rgba(109,73,255,0.035)',
  input: '#ffffff',
  border: 'rgba(15,23,42,0.10)',
  text: '#111827',
  muted: '#5d647a',
  track: 'rgba(15,23,42,0.08)',
  logoBg: '#111827',
  logoText: '#ffffff',
};

const pageBase = {
  minHeight: '100vh',
  padding: '28px 18px 50px',
  fontFamily: 'Inter, system-ui, sans-serif',
};

const container = {
  maxWidth: 1220,
  margin: '0 auto',
};

const topNav = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  marginBottom: 34,
  flexWrap: 'wrap',
};

const brand = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const logoBox = {
  width: 30,
  height: 30,
  borderRadius: 9,
  display: 'grid',
  placeItems: 'center',
  fontWeight: 950,
};

const pill = {
  padding: '7px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const navActions = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const iconButton = {
  padding: '11px 14px',
  borderRadius: 13,
  border: '1px solid',
  cursor: 'pointer',
  fontWeight: 900,
};

const primaryButton = {
  padding: '12px 16px',
  borderRadius: 14,
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 900,
};

const hero = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 20,
  alignItems: 'flex-end',
  marginBottom: 24,
  flexWrap: 'wrap',
};

const eyebrow = {
  color: '#7c5cff',
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.13em',
  fontSize: 12,
  margin: 0,
};

const title = {
  fontSize: 48,
  lineHeight: 1,
  margin: '10px 0 8px',
  fontWeight: 950,
  letterSpacing: '-0.06em',
};

const subtitle = {
  margin: 0,
  maxWidth: 680,
};

const statusPill = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '11px 14px',
  borderRadius: 999,
  border: '1px solid',
  fontWeight: 900,
};

const liveDot = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: '#22c55e',
  boxShadow: '0 0 18px rgba(34,197,94,0.7)',
};

const metricGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 14,
  marginBottom: 26,
};

const metricGridSmall = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 14,
  marginTop: 14,
};

const metricCard = {
  border: '1px solid',
  borderRadius: 20,
  padding: 20,
  boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
};

const cardTitle = {
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.09em',
  margin: 0,
};

const cardValue = {
  fontSize: 30,
  margin: '10px 0 0',
  fontWeight: 950,
  letterSpacing: '-0.04em',
};

const cardNote = {
  margin: '6px 0 0',
  fontSize: 12,
};

const sectionHeader = {
  margin: '10px 0 14px',
};

const trajectoryGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(280px, 0.95fr)',
  gap: 14,
  marginBottom: 26,
};

const panel = (t) => ({
  background: t.card,
  border: `1px solid ${t.border}`,
  borderRadius: 22,
  padding: 22,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
});

const panelTop = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'flex-start',
  marginBottom: 18,
};

const sectionTitle = {
  margin: 0,
  fontSize: 22,
  fontWeight: 950,
  letterSpacing: '-0.03em',
  color: 'inherit',
};

const bigNumber = {
  fontSize: 34,
  letterSpacing: '-0.04em',
  color: 'inherit',
};

const mutedText = {
  margin: '0 0 8px',
  fontSize: 13,
};

const chartWrap = {
  width: '100%',
  minHeight: 120,
};

const chartSvg = {
  width: '100%',
  height: 120,
  display: 'block',
};

const chartLabels = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  color: 'inherit',
  opacity: 0.55,
};

const smallTrend = {
  padding: '0 0 18px',
  marginBottom: 18,
};

const smallTrendTop = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 8,
  fontSize: 13,
};

const funnelWrap = {
  display: 'grid',
  gap: 14,
};

const funnelItem = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid',
};

const funnelTop = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 10,
};

const barTrack = {
  height: 9,
  borderRadius: 999,
  overflow: 'hidden',
};

const barFill = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
};

const funnelRate = {
  marginTop: 8,
  fontSize: 12,
  fontWeight: 900,
  color: '#7c5cff',
};

const twoCol = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 14,
};

const row = (t) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '13px 0',
  borderBottom: `1px solid ${t.border}`,
});

const searchInput = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid',
  marginBottom: 16,
  fontSize: 15,
  outline: 'none',
};

const selectedBox = {
  marginBottom: 18,
  padding: 18,
  borderRadius: 20,
  border: '1px solid',
};

const userList = {
  display: 'grid',
  gap: 10,
};

const userRow = {
  width: '100%',
  textAlign: 'left',
  padding: 16,
  borderRadius: 16,
  border: '1px solid',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
};

const userBadges = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const planBadge = {
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(109,73,255,0.14)',
  color: '#8b5cf6',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
};

const paidBadge = {
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(34,197,94,0.14)',
  color: '#22c55e',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
};

const freeBadge = {
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(148,163,184,0.14)',
  color: '#94a3b8',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
};

const smallMuted = {
  marginTop: 4,
  fontSize: 13,
};

const miniTitle = {
  margin: '22px 0 12px',
  fontSize: 18,
  fontWeight: 950,
};

const paymentRow = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1.4fr',
  gap: 12,
  padding: '12px 0',
  borderBottom: '1px solid',
};

const timelineRow = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  padding: '13px 0',
  borderBottom: '1px solid',
};

const timeText = {
  color: '#7c5cff',
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const table = {
  overflowX: 'auto',
};

const thead = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr 1.4fr',
  gap: 12,
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
  paddingBottom: 12,
  borderBottom: '1px solid',
  minWidth: 900,
};

const trow = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr 1fr 1.5fr 1.4fr',
  gap: 12,
  padding: '13px 0',
  borderBottom: '1px solid',
  fontSize: 14,
  minWidth: 900,
};

const truncate = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const truncateBlock = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};