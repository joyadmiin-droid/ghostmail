'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

import {
  normalizePlan,
  getPlanMrr,
} from '../../lib/plans'

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
  if (!code || String(code).length !== 2) return '🌍';
  return String(code)
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));
}

function getEventCountry(event) {
  const raw =
    event?.metadata?.country ||
    event?.metadata?.countryCode ||
    event?.metadata?.countryName ||
    null;

  if (!raw) return null;
  return String(raw).toUpperCase().slice(0, 2);
}

function getReferrer(event) {
  const raw =
    event?.metadata?.referrer ||
    event?.metadata?.referer ||
    event?.metadata?.source ||
    '';

  if (!raw) return 'Direct';

  try {
    const url = new URL(raw);
    return url.hostname.replace('www.', '');
  } catch {
    return String(raw).replace('www.', '') || 'Direct';
  }
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

function dateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function lastDays(count = 14) {
  const out = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleString(undefined, { month: 'short', day: 'numeric' }),
    });
  }

  return out;
}

function inRange(item, range) {
  if (range === 'all') return true;
  const created = new Date(item.created_at || item.createdAt || 0).getTime();
  if (!created) return false;

  const now = Date.now();
  const days =
    range === '24h' ? 1 :
    range === '7d' ? 7 :
    range === '30d' ? 30 :
    range === '90d' ? 90 :
    99999;

  return created >= now - days * 86400000;
}

function exportCSV(rows, filename) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function LineChart({ data, theme, height = 170 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const points = data
    .map((d, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 90 - (d.value / max) * 72;
      return `${x},${y}`;
    })
    .join(' ');

  const fillPoints = `0,100 ${points} 100,100`;

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height }}>
        <polygon
          points={fillPoints}
          fill={theme === 'dark' ? 'rgba(120,224,143,0.12)' : 'rgba(109,73,255,0.10)'}
        />
        <polyline
          fill="none"
          stroke={theme === 'dark' ? '#78e08f' : '#6d49ff'}
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>

      <div style={chartLabels}>
        {data.map((d, i) => {
          const showLabel = i === 0 || i === data.length - 1 || i % 5 === 0;

          return (
            <span key={`${d.label}-${i}`}>
              {showLabel ? d.label : ''}
            </span>
          );
        })}
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
  const [range, setRange] = useState('30d');
  const [eventFilter, setEventFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
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

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const country = getEventCountry(e);
      const matchesRange = inRange(e, range);
      const matchesEvent = eventFilter === 'all' || e.event === eventFilter;
      const matchesCountry = countryFilter === 'all' || country === countryFilter;
      const q = search.trim().toLowerCase();

      const matchesSearch =
        !q ||
        String(e.event || '').toLowerCase().includes(q) ||
        String(e.path || '').toLowerCase().includes(q) ||
        String(e.label || '').toLowerCase().includes(q) ||
        String(e.user_email || '').toLowerCase().includes(q);

      return matchesRange && matchesEvent && matchesCountry && matchesSearch;
    });
  }, [events, range, eventFilter, countryFilter, search]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => inRange(p, range));
  }, [payments, range]);

  const stats = useMemo(() => {
    const pageViews = filteredEvents.filter((e) => e.event === 'page_view').length;
    const logins = filteredEvents.filter((e) => e.event === 'login_success').length;
    const signups = filteredEvents.filter((e) => e.event === 'signup_success').length;
    const clicks = filteredEvents.filter((e) => e.event === 'generate_email_click').length;

    const revenue = filteredPayments.reduce(
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

        const rawPlan = profile.plan || getPaymentPlan(latestPayment || {}) || 'ghost';
        const plan = normalizePlan(rawPlan);

        const isPaid =
          plan === 'phantom' ||
          plan === 'spectre' ||
          userPayments.length > 0;

        const lastSeen =
          userEvents[0]?.created_at ||
          latestPayment?.created_at ||
          profile.created_at ||
          null;

        const firstSeen =
          [...userEvents]
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]?.created_at ||
          profile.created_at ||
          latestPayment?.created_at ||
          null;

        const pagesVisited = new Set(userEvents.map((e) => e.path).filter(Boolean)).size;
        const sessions = new Set(userEvents.map((e) => dateKey(e.created_at)).filter(Boolean)).size;

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
          firstSeen,
          country,
          pagesVisited,
          sessions,
        };
      })
      .sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));

    const paidUsers = userJourneys.filter((u) => u.isPaid).length;
    const ghostUsers = userJourneys.filter((u) => !u.isPaid).length;
    const phantomUsers = userJourneys.filter((u) => u.plan === 'phantom').length;
    const spectreUsers = userJourneys.filter((u) => u.plan === 'spectre').length;

    const estimatedMrr = userJourneys.reduce((sum, u) => {
      const userPlan = normalizePlan(u.plan);
      return sum + (u.isPaid ? getPlanMrr(userPlan) : 0);
    }, 0);

    const conversionRate = pct(signups || clicks, pageViews);

    const todayEvents = events.filter((e) => {
      const d = new Date(e.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;

    const liveEvents = events.filter((e) => {
      const created = new Date(e.created_at).getTime();
      return created && Date.now() - created <= 5 * 60 * 1000;
    });

    const liveEmails = new Set(liveEvents.map((e) => e.user_email).filter(Boolean));
    const liveVisitors = liveEmails.size || liveEvents.length;

    const livePages = Object.entries(
      liveEvents.reduce((acc, e) => {
        const path = e.path || 'unknown';
        acc[path] = (acc[path] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

    const days = lastDays(range === '90d' ? 30 : range === '30d' ? 30 : range === '7d' ? 7 : 14);

    const revenueTrend = days.map((d) => ({
      ...d,
      value: filteredPayments
        .filter((p) => dateKey(p.created_at) === d.key)
        .reduce((sum, p) => sum + Number(getPaymentAmount(p) || 0), 0),
    }));

    const eventTrend = days.map((d) => ({
      ...d,
      value: filteredEvents.filter((e) => dateKey(e.created_at) === d.key).length,
    }));

    const signupTrend = days.map((d) => ({
      ...d,
      value: filteredEvents.filter(
        (e) => dateKey(e.created_at) === d.key && e.event === 'signup_success'
      ).length,
    }));

    const topPages = Object.entries(
      filteredEvents
        .filter((e) => e.path)
        .reduce((acc, e) => {
          acc[e.path] = (acc[e.path] || 0) + 1;
          return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    const topCountries = Object.entries(
      filteredEvents.reduce((acc, e) => {
        const country = getEventCountry(e);
        if (!country) return acc;
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

    const topReferrers = Object.entries(
      filteredEvents.reduce((acc, e) => {
        const ref = getReferrer(e);
        acc[ref] = (acc[ref] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

    const eventTypes = Object.entries(
      events.reduce((acc, e) => {
        acc[e.event] = (acc[e.event] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]);

    const countries = Object.keys(
      events.reduce((acc, e) => {
        const country = getEventCountry(e);
        if (country) acc[country] = true;
        return acc;
      }, {})
    ).sort();

    const funnel = [
      { label: 'Page Views', value: pageViews, rate: '100%' },
      { label: 'Email Clicks', value: clicks, rate: pct(clicks, pageViews) },
      { label: 'Logins', value: logins, rate: pct(logins, pageViews) },
      { label: 'Signups', value: signups, rate: pct(signups, pageViews) },
      { label: 'Paid Users', value: paidUsers, rate: pct(paidUsers, pageViews) },
    ];

    return {
      pageViews,
      logins,
      signups,
      clicks,
      revenue,
      estimatedMrr,
      arr: estimatedMrr * 12,
      paidUsers,
      ghostUsers,
      phantomUsers,
      spectreUsers,
      conversionRate,
      todayEvents,
      liveVisitors,
      livePages,
      topPages,
      topCountries,
      topReferrers,
      eventTypes,
      countries,
      funnel,
      userJourneys,
      revenueTrend,
      eventTrend,
      signupTrend,
    };
  }, [events, filteredEvents, filteredPayments, payments, profiles, range]);

  const filteredUsers = stats.userJourneys.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || u.email.toLowerCase().includes(q);
    const matchesCountry = countryFilter === 'all' || u.country === countryFilter;
    return matchesSearch && matchesCountry;
  });

  const selectedUser = stats.userJourneys.find((u) => u.email === selectedEmail);

  function downloadEvents() {
    exportCSV(
      [
        ['event', 'path', 'country', 'label', 'user_email', 'created_at'],
        ...filteredEvents.map((e) => [
          e.event,
          e.path || '',
          getEventCountry(e) || '',
          e.label || '',
          e.user_email || '',
          e.created_at || '',
        ]),
      ],
      'ghostmail-events.csv'
    );
  }

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
      <div style={glowOne} />
      <div style={glowTwo} />

      <div style={container}>
        <div style={topNav}>
          <div style={brand}>
            <div style={{ ...logoBox, background: t.logoBg, color: t.logoText }}>G</div>
            <strong>GhostMail</strong>
            <span style={{ ...pill, background: t.softBg, color: t.muted }}>
              v2 analytics
            </span>
          </div>

          <div style={navActions}>
            <button type="button" onClick={toggleTheme} style={ghostButton(t)}>
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>

            <button type="button" onClick={downloadEvents} style={ghostButton(t)}>
              Export CSV
            </button>

            <a href="/dashboard" style={primaryButton}>
              Back to dashboard
            </a>
          </div>
        </div>

        <header style={hero}>
          <div>
            <p style={eyebrow}>GhostMail Command Center</p>
            <h1 style={{ ...title, color: t.text }}>Analytics Dashboard</h1>
            <p style={{ ...subtitle, color: t.muted }}>
              Traffic, countries, user journeys, conversion, live visitors and revenue signals.
            </p>
          </div>

          <div style={{ ...liveBox, background: t.card, borderColor: t.border }}>
            <span style={liveDot} />
            <strong>{stats.liveVisitors}</strong>
            <span style={{ color: t.muted }}>live now</span>
          </div>
        </header>

        <section style={{ ...panel(t), padding: 16 }}>
          <div style={filters}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, event, path..."
              style={{ ...searchInput, background: t.input, color: t.text, borderColor: t.border }}
            />

            <select value={range} onChange={(e) => setRange(e.target.value)} style={selectBox(t)}>
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
              <option value="90d">Last 90d</option>
              <option value="all">All time</option>
            </select>

            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} style={selectBox(t)}>
              <option value="all">All events</option>
              {stats.eventTypes.map(([event]) => (
                <option key={event} value={event}>{event}</option>
              ))}
            </select>

            <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} style={selectBox(t)}>
              <option value="all">All countries</option>
              {stats.countries.map((country) => (
                <option key={country} value={country}>
                  {countryCodeToFlag(country)} {country}
                </option>
              ))}
            </select>
          </div>
        </section>

        <div style={metricGrid}>
          <MetricCard t={t} title="Revenue" value={money(stats.revenue)} note="tracked payments in range" accent />
          <MetricCard t={t} title="Est. MRR" value={money(stats.estimatedMrr)} note="paid plan estimate" accent />
          <MetricCard t={t} title="ARR" value={money(stats.arr)} note="MRR × 12" />
          <MetricCard t={t} title="Live Now" value={stats.liveVisitors} note="last 5 minutes" accent />
          <MetricCard t={t} title="Page Views" value={stats.pageViews} note="filtered traffic" />
          <MetricCard t={t} title="Conversion" value={stats.conversionRate} note="signup/click rate" />
        </div>

        <div style={trajectoryGrid}>
          <section style={{ ...panel(t), minHeight: 410 }}>
            <div style={panelTop}>
              <div>
                <p style={{ ...eyebrow, marginBottom: 8 }}>Trajectory</p>
                <h2 style={sectionTitle}>Traffic Trend</h2>
                <p style={{ ...mutedText, color: t.muted }}>
                  Product activity for the selected time range.
                </p>
              </div>
              <strong style={bigNumber}>{filteredEvents.length}</strong>
            </div>

            <LineChart data={stats.eventTrend} theme={theme} height={230} />
          </section>

          <section style={{ ...panel(t), minHeight: 410 }}>
            <SmallTrend t={t} label="Revenue" value={money(stats.revenue)} data={stats.revenueTrend} theme={theme} />
            <SmallTrend t={t} label="Signups" value={stats.signups} data={stats.signupTrend} theme={theme} />
            <SmallTrend t={t} label="Email Clicks" value={stats.clicks} data={stats.eventTrend} theme={theme} />
          </section>
        </div>

        <div style={metricGrid}>
          <MetricCard t={t} title="Logins" value={stats.logins} note={pct(stats.logins, stats.pageViews)} />
          <MetricCard t={t} title="Signups" value={stats.signups} note={pct(stats.signups, stats.pageViews)} />
          <MetricCard t={t} title="Email Clicks" value={stats.clicks} note={pct(stats.clicks, stats.pageViews)} />
          <MetricCard t={t} title="Ghost Users" value={stats.ghostUsers} note="free users" />
          <MetricCard t={t} title="Phantom" value={stats.phantomUsers} note="phantom plan" />
          <MetricCard t={t} title="Spectre" value={stats.spectreUsers} note="spectre plan" />
        </div>

        <div style={threeCol}>
          <section style={panel(t)}>
            <h2 style={sectionTitle}>Live Pages</h2>
            <p style={{ ...mutedText, color: t.muted }}>Activity from the last 5 minutes.</p>

            {stats.livePages.length === 0 ? (
              <p style={{ color: t.muted }}>No live activity right now.</p>
            ) : (
              stats.livePages.slice(0, 6).map(([path, count]) => (
                <div key={path} style={row(t)}>
                  <span style={{ ...truncate, color: t.text }}>{path}</span>
                  <strong>{count}</strong>
                </div>
              ))
            )}
          </section>

          <section style={panel(t)}>
            <h2 style={sectionTitle}>Top Referrers</h2>
            <p style={{ ...mutedText, color: t.muted }}>Where traffic is coming from.</p>

            {stats.topReferrers.slice(0, 6).map(([ref, count]) => (
              <div key={ref} style={row(t)}>
                <span style={{ ...truncate, color: t.text }}>{ref}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </section>

          <section style={panel(t)}>
            <h2 style={sectionTitle}>Event Mix</h2>
            <p style={{ ...mutedText, color: t.muted }}>Top tracked actions.</p>

            {stats.eventTypes.slice(0, 6).map(([event, count]) => (
              <div key={event} style={row(t)}>
                <span style={{ ...truncate, color: t.text }}>{event}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </section>
        </div>

        <section style={panel(t)}>
          <h2 style={sectionTitle}>Conversion Funnel</h2>
          <p style={{ ...mutedText, color: t.muted }}>
            Shows how users move from traffic into product actions.
          </p>

          <div style={funnelWrap}>
            {stats.funnel.map((item) => (
              <div key={item.label} style={{ ...funnelItem, background: t.softBg, borderColor: t.border }}>
                <div style={funnelTop}>
                  <strong style={{ color: t.text }}>{item.label}</strong>
                  <span style={{ color: t.text }}>{item.value}</span>
                </div>
                <div style={{ ...barTrack, background: t.track }}>
                  <div style={{ ...barFill, width: item.rate }} />
                </div>
                <div style={{ ...funnelRate, color: t.accent }}>{item.rate}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={twoCol}>
          <section style={panel(t)}>
            <h2 style={sectionTitle}>Top Countries</h2>
            <p style={{ ...mutedText, color: t.muted }}>
              Countries detected from analytics metadata.
            </p>

            {stats.topCountries.length === 0 ? (
              <p style={{ color: t.muted }}>No country data yet.</p>
            ) : (
              stats.topCountries.slice(0, 10).map(([country, count]) => (
                <CountryRow
                  key={country}
                  t={t}
                  country={country}
                  count={count}
                  total={stats.topCountries.reduce((sum, [, value]) => sum + value, 0)}
                />
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
              stats.topPages.slice(0, 10).map(([path, count]) => (
                <div key={path} style={row(t)}>
                  <span style={{ ...truncate, color: t.text }}>{path}</span>
                  <strong style={{ color: t.text }}>{count}</strong>
                </div>
              ))
            )}
          </section>
        </div>

        <section style={panel(t)}>
          <div style={panelTop}>
            <div>
              <h2 style={sectionTitle}>Users</h2>
              <p style={{ ...mutedText, color: t.muted }}>
                Click a user to inspect plan, payments, sessions and journey.
              </p>
            </div>
            <strong style={{ color: t.accent }}>{filteredUsers.length} users</strong>
          </div>

          {selectedUser && (
            <div style={{ ...selectedBox, background: t.softBg, borderColor: t.border }}>
              <h3 style={{ margin: '0 0 12px', color: t.text }}>
                {selectedUser.country ? `${countryCodeToFlag(selectedUser.country)} ` : ''}
                {selectedUser.email}
              </h3>

              <div style={metricGridSmall}>
                <MetricCard t={t} title="Plan" value={selectedUser.plan || 'ghost'} note="current plan" />
                <MetricCard t={t} title="Status" value={selectedUser.isPaid ? 'Paid' : 'Free'} note="billing state" />
                <MetricCard t={t} title="Paid Total" value={money(selectedUser.paidTotal)} note="lifetime value" />
                <MetricCard t={t} title="Sessions" value={selectedUser.sessions} note="active days" />
                <MetricCard t={t} title="Pages" value={selectedUser.pagesVisited} note="unique paths" />
                <MetricCard
                  t={t}
                  title="Age"
                  value={daysSince(selectedUser.firstSeen)}
                  note="days since first seen"
                />
              </div>
            </div>
          )}

          <div style={userList}>
            {filteredUsers.slice(0, 100).map((user) => (
              <button
                key={user.email}
                type="button"
                style={{
                  ...userRow,
                  background: selectedEmail === user.email ? t.softBg : t.rowBg,
                  color: t.text,
                  borderColor: selectedEmail === user.email ? 'rgba(109,73,255,0.55)' : t.border,
                }}
                onClick={() => setSelectedEmail(user.email)}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ ...truncateBlock, color: t.text }}>
                    {user.country ? `${countryCodeToFlag(user.country)} ` : ''}
                    {user.email}
                  </strong>
                  <div style={{ ...smallMuted, color: t.muted }}>
                    {user.events.length} events · {user.sessions} sessions · last seen{' '}
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
            <h2 style={sectionTitle}>
              {selectedUser.country ? `${countryCodeToFlag(selectedUser.country)} ` : ''}
              {selectedUser.email}
            </h2>
            <p style={{ ...mutedText, color: t.muted }}>
              First seen: {selectedUser.firstSeen ? new Date(selectedUser.firstSeen).toLocaleString() : '—'} · Last seen:{' '}
              {selectedUser.lastSeen ? new Date(selectedUser.lastSeen).toLocaleString() : '—'}
            </p>

            <h3 style={{ ...miniTitle, color: t.text }}>Payments</h3>
            {selectedUser.payments.length === 0 ? (
              <p style={{ color: t.muted }}>No payments found for this user.</p>
            ) : (
              selectedUser.payments.slice(0, 8).map((p) => (
                <div key={p.id || p.created_at} style={{ ...paymentRow, borderColor: t.border, color: t.text }}>
                  <span>{getPaymentPlan(p)}</span>
                  <strong>{money(getPaymentAmount(p))}</strong>
                  <span>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</span>
                </div>
              ))
            )}

            <h3 style={{ ...miniTitle, color: t.text }}>Timeline</h3>
            {selectedUser.events.length === 0 ? (
              <p style={{ color: t.muted }}>No events found for this user.</p>
            ) : (
              selectedUser.events.slice(0, 50).map((e) => {
                const country = getEventCountry(e);

                return (
                  <div key={e.id} style={{ ...timelineRow, borderColor: t.border, color: t.text }}>
                    <div>
                      <strong>
                        {country ? `${countryCodeToFlag(country)} ` : ''}
                        {e.event}
                      </strong>
                      <div style={{ ...smallMuted, color: t.muted }}>
                        {e.path || '-'} {e.label ? `· ${e.label}` : ''}
                        {country ? ` · ${country}` : ''}
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

            {filteredEvents.slice(0, 140).map((e) => {
              const country = getEventCountry(e);

              return (
                <div key={e.id} style={{ ...trow, borderColor: t.border, color: t.text }}>
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

function MetricCard({ t, title, value, note, accent }) {
  return (
    <div style={{ ...metricCard, background: t.card, borderColor: t.border }}>
      <p style={{ ...cardTitle, color: t.muted }}>{title}</p>
      <h2 style={{ ...cardValue, color: accent ? t.accent : t.text }}>{value}</h2>
      <p style={{ ...cardNote, color: t.muted }}>{note}</p>
    </div>
  );
}

function SmallTrend({ t, label, value, data, theme }) {
  return (
    <div style={{ ...smallTrend, borderColor: t.border }}>
      <div style={smallTrendTop}>
        <span style={{ color: t.muted }}>{label}</span>
        <strong style={{ color: t.text }}>{value}</strong>
      </div>
      <LineChart data={data} theme={theme} height={82} />
    </div>
  );
}

function CountryRow({ t, country, count, total }) {
  const width = total ? `${Math.max(4, Math.round((count / total) * 100))}%` : '0%';

  return (
    <div style={countryRow}>
      <div style={countryTop}>
        <span style={{ color: t.text }}>
          {countryCodeToFlag(country)} {country}
        </span>
        <strong style={{ color: t.text }}>{count}</strong>
      </div>
      <div style={{ ...countryBarTrack, background: t.track }}>
        <div style={{ ...countryBarFill, width }} />
      </div>
    </div>
  );
}

const darkTheme = {
  pageBg: '#08090d',
  card: 'rgba(18,19,25,0.92)',
  softBg: 'rgba(120,224,143,0.07)',
  rowBg: 'rgba(255,255,255,0.025)',
  input: '#0f1015',
  border: 'rgba(255,255,255,0.09)',
  text: '#f8fafc',
  muted: '#9aa4b8',
  track: 'rgba(255,255,255,0.09)',
  accent: '#78e08f',
  logoBg: '#f5f7fb',
  logoText: '#08090d',
};

const lightTheme = {
  pageBg: 'linear-gradient(180deg, rgba(109,73,255,0.10), rgba(109,73,255,0.02)), #f6f4ff',
  card: '#ffffff',
  softBg: 'rgba(109,73,255,0.06)',
  rowBg: 'rgba(109,73,255,0.035)',
  input: '#ffffff',
  border: 'rgba(15,23,42,0.10)',
  text: '#071022',
  muted: '#5d647a',
  track: 'rgba(15,23,42,0.08)',
  accent: '#6d49ff',
  logoBg: '#111827',
  logoText: '#ffffff',
};

const pageBase = {
  minHeight: '100vh',
  padding: '28px 18px 50px',
  fontFamily: 'Inter, system-ui, sans-serif',
  position: 'relative',
  overflow: 'hidden',
};

const glowOne = {
  position: 'fixed',
  top: -180,
  right: -160,
  width: 360,
  height: 360,
  borderRadius: 999,
  background: 'rgba(109,73,255,0.20)',
  filter: 'blur(80px)',
  pointerEvents: 'none',
};

const glowTwo = {
  position: 'fixed',
  bottom: -180,
  left: -160,
  width: 360,
  height: 360,
  borderRadius: 999,
  background: 'rgba(217,70,178,0.14)',
  filter: 'blur(90px)',
  pointerEvents: 'none',
};

const container = {
  maxWidth: 1240,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
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

const ghostButton = (t) => ({
  padding: '11px 14px',
  borderRadius: 13,
  border: `1px solid ${t.border}`,
  background: t.card,
  color: t.text,
  cursor: 'pointer',
  fontWeight: 900,
});

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
  fontSize: 50,
  lineHeight: 1,
  margin: '10px 0 8px',
  fontWeight: 950,
  letterSpacing: '-0.06em',
};

const subtitle = {
  margin: 0,
  maxWidth: 760,
};

const liveBox = {
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

const filters = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1fr) 140px 180px 160px',
  gap: 10,
};

const searchInput = {
  width: '100%',
  padding: '13px 15px',
  borderRadius: 14,
  border: '1px solid',
  fontSize: 14,
  outline: 'none',
};

const selectBox = (t) => ({
  padding: '13px 12px',
  borderRadius: 14,
  border: `1px solid ${t.border}`,
  background: t.input,
  color: t.text,
  fontWeight: 800,
  outline: 'none',
});

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
  fontSize: 31,
  margin: '10px 0 0',
  fontWeight: 950,
  letterSpacing: '-0.04em',
};

const cardNote = {
  margin: '6px 0 0',
  fontSize: 12,
};

const trajectoryGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.9fr)',
  gap: 14,
  marginBottom: 26,
};

const twoCol = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 14,
};

const threeCol = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 14,
};

const panel = (t) => ({
  background: t.card,
  border: `1px solid ${t.border}`,
  borderRadius: 22,
  padding: 22,
  marginBottom: 24,
  boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
  backdropFilter: 'blur(16px)',
  color: t.text,
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
  fontSize: 36,
  letterSpacing: '-0.04em',
  color: 'inherit',
};

const mutedText = {
  margin: '0 0 8px',
  fontSize: 13,
};

const chartLabels = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 9,
  color: 'inherit',
  opacity: 0.55,
  gap: 4,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

const smallTrend = {
  padding: '0 0 18px',
  marginBottom: 18,
  borderBottom: '1px solid',
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
  color: 'inherit',
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
};

const row = (t) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '13px 0',
  borderBottom: `1px solid ${t.border}`,
  color: t.text,
});

const countryRow = {
  padding: '13px 0',
};

const countryTop = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 8,
};

const countryBarTrack = {
  height: 8,
  borderRadius: 999,
  overflow: 'hidden',
};

const countryBarFill = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(135deg,#6d49ff,#d946b2)',
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
  background: 'rgba(109,73,255,0.16)',
  color: '#8b5cf6',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
};

const paidBadge = {
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(34,197,94,0.16)',
  color: '#22c55e',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
};

const freeBadge = {
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(148,163,184,0.16)',
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