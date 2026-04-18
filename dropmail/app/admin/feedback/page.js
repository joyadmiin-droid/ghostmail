'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ADMIN_EMAIL = 'joyadmin@gmail.com';

export default function FeedbackAdminPage() {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        const res = await fetch('/api/feedback/list');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || 'Could not load feedback.');
        }

        setEntries(data.entries || []);
      } catch (err) {
        setError(err?.message || 'Something went wrong.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

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
      <div style={{ width: '100%', maxWidth: '1100px' }}>
        <div style={headerRow}>
          <div>
            <p style={eyebrowStyle}>Admin</p>
            <h1 style={titleStyle}>Feedback Dashboard</h1>
            <p style={textStyle}>
              Review what users want fixed, changed, or improved.
            </p>
          </div>

          <a href="/dashboard" style={backButtonStyle}>
            Back to dashboard
          </a>
        </div>

        {error ? (
          <div style={errorBoxStyle}>{error}</div>
        ) : null}

        {loading ? (
          <div style={cardStyle}>Loading feedback...</div>
        ) : entries.length === 0 ? (
          <div style={cardStyle}>No feedback yet.</div>
        ) : (
          <div style={gridStyle}>
            {entries.map((item) => (
              <div key={item.id} style={feedbackCardStyle}>
                <div style={metaTopStyle}>
                  <span style={pillStyle}>#{item.id}</span>
                  <span style={dateStyle}>{formatDate(item.created_at)}</span>
                </div>

                <div style={{ marginBottom: '12px' }}>
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

const imageStyle = {
  width: '100%',
  maxHeight: '420px',
  objectFit: 'contain',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
};