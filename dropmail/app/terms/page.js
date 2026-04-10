export default function TermsPage() {
  const headingStyle = {
    fontSize: '1.05rem',
    fontFamily: 'sans-serif',
    fontWeight: '700',
    color: 'var(--text)', // ✅ FIXED
    marginBottom: '0.6rem',
    paddingBottom: '0.4rem',
    borderBottom: '1px solid var(--border)', // ✅ FIXED
  };

  const paraStyle = {
    color: 'var(--muted)',
    lineHeight: '1.8',
    fontSize: '0.95rem',
  };

  const linkStyle = {
    color: '#a78bfa',
    textDecoration: 'none',
  };

  const sections = [
    {
      title: '1. What GhostMail Is',
      body: 'GhostMail (ghostmails.org) is a developer-focused email testing service that generates temporary email addresses for QA testing, development workflows, and inbox protection. Email addresses and their contents are automatically deleted after a set period depending on your plan.',
    },
    {
      title: '2. Acceptable Use',
      body: 'You agree to use GhostMail only for lawful purposes such as software testing, QA environments, and development workflows. You may not use GhostMail to send or facilitate spam or phishing, conduct fraudulent activities, distribute malware, or harass or harm other individuals.',
    },
  ];

  return (
    <div
      style={{
        background: 'var(--bg)',
        minHeight: '100vh',
        color: 'var(--text)',
        fontFamily: 'Georgia, serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.2rem 2rem',
          borderBottom: '1px solid var(--border)', // ✅ FIXED
          background: 'var(--bg)',
        }}
      >
        <a
          href="/"
          style={{
            fontWeight: '700',
            fontSize: '1rem',
            color: 'var(--text)', // ✅ FIXED
            textDecoration: 'none',
          }}
        >
          GhostMail
        </a>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="/privacy" style={linkStyle}>Privacy</a>
          <a href="/login" style={linkStyle}>Sign In</a>
        </div>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        
        <div
          style={{
            background: 'var(--surface-strong)', // ✅ FIXED
            borderLeft: '3px solid #a78bfa',
            padding: '1rem 1.2rem',
            borderRadius: '0 8px 8px 0',
            marginBottom: '2rem',
            color: 'var(--text)', // ✅ FIXED
            fontSize: '0.92rem',
          }}
        >
          GhostMail is intended for developers, QA testing, and responsible use only.
        </div>

        <h1
          style={{
            fontSize: '2.2rem',
            fontWeight: '800',
            fontFamily: 'sans-serif',
            color: 'var(--text)', // ✅ FIXED
            marginBottom: '0.4rem',
          }}
        >
          Terms of Service
        </h1>

        <p
          style={{
            color: 'var(--muted)',
            fontSize: '0.85rem',
            marginBottom: '3rem',
          }}
        >
          Last updated: April 2026
        </p>

        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: '2rem' }}>
            <h2 style={headingStyle}>{section.title}</h2>
            <p style={paraStyle}>{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}