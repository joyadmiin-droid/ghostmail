export default function TermsPage() {
  const headingStyle = {
    fontSize: '1.05rem',
    fontFamily: 'sans-serif',
    fontWeight: '700',
    color: '#e2e2f0',
    marginBottom: '0.6rem',
    paddingBottom: '0.4rem',
    borderBottom: '1px solid #1a1a2e',
  };

  const paraStyle = {
    color: '#666',
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
      body: 'You agree to use GhostMail only for lawful purposes such as software testing, QA environments, and development workflows. You may not use GhostMail to send or facilitate spam or phishing, conduct fraudulent activities, distribute malware, or harass or harm other individuals. We reserve the right to block addresses or IPs found in violation.',
    },
    {
      title: '3. Prohibited Use',
      body: 'You may NOT use GhostMail to bypass platform restrictions, create fake or abusive accounts, evade identity verification systems, send unsolicited spam, or engage in illegal or malicious activities. Any such use will result in immediate blocking of access.',
    },
    {
      title: '4. Temporary Nature of the Service',
      body: 'All email addresses are temporary by design. Free addresses expire after 10 minutes. Paid plan addresses expire per plan terms. Do not use GhostMail for anything requiring permanent email storage.',
    },
    {
      title: '5. No Account Required (Free Tier)',
      body: 'Free-tier users do not create accounts. Because no account is linked to your session, we cannot restore deleted addresses or emails under any circumstances.',
    },
    {
      title: '6. Paid Plans',
      body: 'Paid subscriptions (Phantom, Spectre) are billed monthly. All payments are processed securely by Paddle.com, our authorized reseller and Merchant of Record. We reserve the right to change pricing with 30 days notice.',
    },
  ];

  return (
    <div
      style={{
        background: '#0a0a12',
        minHeight: '100vh',
        color: '#e2e2f0',
        fontFamily: 'Georgia, serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.2rem 2rem',
          borderBottom: '1px solid #1a1a2e',
          background: '#0f0f1c',
        }}
      >
        <a
          href="/"
          style={{
            fontWeight: '700',
            fontSize: '1rem',
            color: '#fff',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          GhostMail
        </a>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="/privacy" style={linkStyle}>Privacy Policy</a>
          <a href="/login" style={linkStyle}>Sign In</a>
        </div>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        <div
          style={{
            display: 'inline-block',
            background: 'rgba(168,85,247,0.1)',
            border: '1px solid rgba(168,85,247,0.25)',
            color: '#a78bfa',
            fontSize: '0.72rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0.3rem 0.9rem',
            borderRadius: '999px',
            marginBottom: '1.5rem',
            fontFamily: 'sans-serif',
          }}
        >
          Legal
        </div>

        <h1
          style={{
            fontSize: '2.2rem',
            fontWeight: '800',
            fontFamily: 'sans-serif',
            color: '#e2e2f0',
            marginBottom: '0.4rem',
          }}
        >
          Terms of Service
        </h1>

        <p
          style={{
            color: '#555',
            fontSize: '0.85rem',
            fontFamily: 'sans-serif',
            marginBottom: '3rem',
          }}
        >
          Last updated: April 2026
        </p>

        <div
          style={{
            background: 'rgba(167,139,250,0.07)',
            borderLeft: '3px solid #a78bfa',
            padding: '1rem 1.2rem',
            borderRadius: '0 8px 8px 0',
            marginBottom: '2rem',
            color: '#888',
            fontSize: '0.92rem',
          }}
        >
          GhostMail is intended for developers, QA testing, and responsible use only.
        </div>

        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: '2rem' }}>
            <h2 style={headingStyle}>{section.title}</h2>
            <p style={paraStyle}>{section.body}</p>
          </div>
        ))}

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={headingStyle}>7. Refund Policy</h2>
          <p style={paraStyle}>
            You may request a full refund within 14 days of your initial purchase or renewal date.
          </p>
          <p style={{ ...paraStyle, marginTop: '0.75rem' }}>
            To request a refund, email us at{' '}
            <a href="mailto:support@ghostmails.org" style={linkStyle}>
              support@ghostmails.org
            </a>.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={headingStyle}>8. Disclaimer</h2>
          <p style={paraStyle}>
            GhostMail is provided as-is without warranties. We do not guarantee uptime or delivery.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={headingStyle}>9. Limitation of Liability</h2>
          <p style={paraStyle}>
            We are not liable for any damages resulting from use of the service.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h2 style={headingStyle}>10. Contact</h2>
          <p style={paraStyle}>support@ghostmails.org</p>
        </div>
      </div>

      <footer
        style={{
          textAlign: 'center',
          padding: '2rem',
          borderTop: '1px solid #1a1a2e',
          color: '#444',
          fontFamily: 'sans-serif',
          fontSize: '0.8rem',
        }}
      >
        <p>
          GhostMail — Developer-focused email testing tool &nbsp;|&nbsp;
          <a href="/terms" style={{ ...linkStyle, margin: '0 0.5rem' }}>Terms</a>
          <a href="/privacy" style={{ ...linkStyle, margin: '0 0.5rem' }}>Privacy</a>
          <a href="mailto:support@ghostmails.org" style={{ ...linkStyle, margin: '0 0.5rem' }}>Contact</a>
        </p>
      </footer>
    </div>
  );
}