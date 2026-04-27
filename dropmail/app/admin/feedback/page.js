'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ADMIN_EMAIL = 'erkan.iseni20@gmail.com';

export default function FeedbackAdminPage() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [importantOnly, setImportantOnly] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const email = session?.user?.email || '';

        if (!session?.user) {
          window.location.href = '/login?next=/admin/feedback';
          return;
        }

        if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          setAllowed(false);
          setChecking(false);
          setLoading(false);
          return;
        }

        setAllowed(true);
        setChecking(false);
        await loadEntries();
      } catch (err) {
        setError(err?.message || 'Something went wrong.');
        setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadEntries() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/feedback/list');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Could not load feedback.');
      }

      setEntries(data.entries || []);
    } catch (err) {
      setError(err?.message || 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id, action, value = null) {
    setBusyId(id);
    setError('');

    try {
      const res = await fetch('/api/feedback/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, value }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Action failed.');
      }

      if (action === 'delete') {
        setEntries((prev) => prev.filter((item) => item.id !== id));
      } else {
        await loadEntries();
      }
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();

    return entries.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (importantOnly && !item.is_important) return false;

      if (!q) return true;

      return [
        item.message,
        item.email,
        item.page,
        item.user_id,
        item.admin_note,
        item.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [entries, search, statusFilter, importantOnly]);

  if (checking) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>Checking access...</div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Access denied</h1>
          <p style={textStyle}>This page is only available to the admin account.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ width: '100%', maxWidth: '1200px' }}>
        <div style={headerRow}>
          <div>
            <p style={eyebrowStyle}>Admin</p>
            <h1 style={titleStyle}>Feedback Dashboard</h1>
            <p style={textStyle}>
              Review what users want fixed, changed, or improved.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a href="/dashboard" style={backButtonStyle}>
              Back to dashboard
            </a>
            <button onClick={loadEntries} style={secondaryButtonStyle} type="button">
              Refresh
            </button>
          </div>
        </div>

        <div style={toolbarStyle}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search feedback..."
            style={inputStyle}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="fixed">Fixed</option>
            <option value="ignored">Ignored</option>
          </select>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={importantOnly}
              onChange={(e) => setImportantOnly(e.target.checked)}
            />
            Important only
          </label>
        </div>

        {error ? <div style={errorBoxStyle}>{error}</div> : null}

        {loading ? (
          <div style={cardStyle}>Loading feedback...</div>
        ) : filteredEntries.length === 0 ? (
          <div style={cardStyle}>No matching feedback found.</div>
        ) : (
          <div style={gridStyle}>
            {filteredEntries.map((item) => (
              <div key={item.id} style={feedbackCardStyle}>
                <div style={metaTopStyle}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={pillStyle}>#{item.id}</span>
                    <span style={statusPill(item.status)}>{item.status || 'open'}</span>
                    {item.is_important ? <span style={importantPillStyle}>Important</span> : null}
                  </div>

                  <span style={dateStyle}>{formatDate(item.created_at)}</span>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <p style={labelStyle}>Message</p>
                  <div style={messageBoxStyle}>{item.message}</div>
                </div>

                <div style={metaGridStyle}>
                  <div>
                    <p style={labelStyle}>Email</p>
                    <p style={valueStyle}>{item.email || '—'}</p>
                  </div>

                  <div>
                    <p style={labelStyle}>Page</p>
                    <p style={valueStyle}>{item.page || '—'}</p>
                  </div>

                  <div>
                    <p style={labelStyle}>User ID</p>
                    <p style={smallValueStyle}>{item.user_id || '—'}</p>
                  </div>

                  <div>
                    <p style={labelStyle}>Screenshot</p>
                    {item.screenshot_url ? (
                      <a
                        href={item.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        style={linkStyle}
                      >
                        Open screenshot
                      </a>
                    ) : (
                      <p style={valueStyle}>No screenshot</p>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <p style={labelStyle}>Admin note</p>
                  <textarea
                    defaultValue={item.admin_note || ''}
                    placeholder="Add your internal note..."
                    style={noteTextareaStyle}
                    onBlur={(e) => {
                      if ((item.admin_note || '') !== e.target.value) {
                        handleAction(item.id, 'set-note', e.target.value);
                      }
                    }}
                  />
                </div>

                <div style={actionsRowStyle}>
                  <button
                    type="button"
                    style={smallButtonStyle}
                    disabled={busyId === item.id}
                    onClick={() =>
                      handleAction(item.id, 'toggle-important', !item.is_important)
                    }
                  >
                    {item.is_important ? 'Unmark important' : 'Mark important'}
                  </button>

                  <button
                    type="button"
                    style={smallButtonStyle}
                    disabled={busyId === item.id}
                    onClick={() => handleAction(item.id, 'set-status', 'open')}
                  >
                    Mark open
                  </button>

                  <button
                    type="button"
                    style={smallButtonStyle}
                    disabled={busyId === item.id}
                    onClick={() => handleAction(item.id, 'set-status', 'fixed')}
                  >
                    Mark fixed
                  </button>

                  <button
                    type="button"
                    style={smallButtonStyle}
                    disabled={busyId === item.id}
                    onClick={() => handleAction(item.id, 'set-status', 'ignored')}
                  >
                    Ignore
                  </button>

                  <button
                    type="button"
                    style={dangerButtonStyle}
                    disabled={busyId === item.id}
                    onClick={() => {
                      const ok = window.confirm('Delete this feedback?');
                      if (ok) handleAction(item.id, 'delete');
                    }}
                  >
                    Delete
                  </button>
                </div>

                {item.screenshot_url ? (
                  <div style={{ marginTop: '16px' }}>
                    <img
                      src={item.screenshot_url}
                      alt="Feedback screenshot"
                      style={imageStyle}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: '100vh',
  padding: '32px',
  background:
    'radial-gradient(circle at top, rgba(124,58,237,0.18), transparent 35%), linear-gradient(135deg, #0b1020, #111827 55%, #050816)',
  color: '#fff',
  fontFamily: 'Inter, system-ui, sans-serif',
  display: 'flex',
  justifyContent: 'center',
};

const headerRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '20px',
  marginBottom: '24px',
  flexWrap: 'wrap',
};

const toolbarStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '18px',
};

const inputStyle = {
  flex: '1 1 280px',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(15, 23, 42, 0.9)',
  color: '#fff',
};

const selectStyle = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(15, 23, 42, 0.9)',
  color: '#fff',
};

const checkboxLabelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  color: '#cbd5e1',
  padding: '0 6px',
};

const cardStyle = {
  background: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '20px',
  padding: '24px',
};

const feedbackCardStyle = {
  background: 'rgba(15, 23, 42, 0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
};

const gridStyle = {
  display: 'grid',
  gap: '18px',
};

const titleStyle = {
  margin: '0 0 8px',
  fontSize: '34px',
  fontWeight: 800,
};

const eyebrowStyle = {
  margin: '0 0 8px',
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#a78bfa',
  fontWeight: 700,
};

const textStyle = {
  margin: 0,
  color: '#94a3b8',
  lineHeight: 1.6,
};

const backButtonStyle = {
  textDecoration: 'none',
  padding: '12px 16px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
  color: '#fff',
  fontWeight: 700,
};

const secondaryButtonStyle = {
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const errorBoxStyle = {
  marginBottom: '18px',
  padding: '14px 16px',
  borderRadius: '12px',
  background: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.28)',
  color: '#fca5a5',
};

const metaTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  marginBottom: '16px',
  flexWrap: 'wrap',
};

const pillStyle = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background: 'rgba(167,139,250,0.12)',
  border: '1px solid rgba(167,139,250,0.25)',
  color: '#c4b5fd',
  fontWeight: 700,
  fontSize: '12px',
};

const importantPillStyle = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background: 'rgba(250,204,21,0.14)',
  border: '1px solid rgba(250,204,21,0.28)',
  color: '#fde68a',
  fontWeight: 700,
  fontSize: '12px',
};

const statusPill = (status) => ({
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background:
    status === 'fixed'
      ? 'rgba(34,197,94,0.14)'
      : status === 'ignored'
      ? 'rgba(148,163,184,0.14)'
      : 'rgba(59,130,246,0.14)',
  border:
    status === 'fixed'
      ? '1px solid rgba(34,197,94,0.28)'
      : status === 'ignored'
      ? '1px solid rgba(148,163,184,0.22)'
      : '1px solid rgba(59,130,246,0.28)',
  color:
    status === 'fixed'
      ? '#86efac'
      : status === 'ignored'
      ? '#cbd5e1'
      : '#93c5fd',
  fontWeight: 700,
  fontSize: '12px',
});

const dateStyle = {
  color: '#94a3b8',
  fontSize: '13px',
};

const labelStyle = {
  margin: '0 0 6px',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#a78bfa',
  fontWeight: 700,
};

const valueStyle = {
  margin: 0,
  color: '#e2e8f0',
  lineHeight: 1.6,
};

const smallValueStyle = {
  margin: 0,
  color: '#cbd5e1',
  lineHeight: 1.6,
  wordBreak: 'break-all',
  fontSize: '13px',
};

const messageBoxStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '14px',
  padding: '14px',
  color: '#fff',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
};

const metaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
};

const linkStyle = {
  color: '#93c5fd',
  textDecoration: 'none',
  fontWeight: 700,
};

const noteTextareaStyle = {
  width: '100%',
  minHeight: '90px',
  resize: 'vertical',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  padding: '12px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const actionsRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '16px',
};

const smallButtonStyle = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const dangerButtonStyle = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid rgba(239,68,68,0.24)',
  background: 'rgba(239,68,68,0.12)',
  color: '#fca5a5',
  fontWeight: 700,
  cursor: 'pointer',
};

const imageStyle = {
  width: '100%',
  maxHeight: '420px',
  objectFit: 'contain',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
};