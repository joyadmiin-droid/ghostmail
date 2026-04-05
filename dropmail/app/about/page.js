export default function AboutPage() {
  return (
    <div style={{ background: '#0a0a12', minHeight: '100vh', color: '#e2e2f0', fontFamily: 'sans-serif' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
        <a href="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>
          GhostMail
        </a>
        <div>
          <a href="/terms" style={{ marginRight: '15px', color: '#888' }}>Terms</a>
          <a href="/privacy" style={{ marginRight: '15px', color: '#888' }}>Privacy</a>
        </div>
      </header>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 20px' }}>
        
        <h1 style={{ fontSize: '28px', marginBottom: '20px' }}>
          About GhostMail
        </h1>

        <p style={{ color: '#aaa', lineHeight: '1.7' }}>
          GhostMail is a developer-focused email testing tool designed to help engineers, QA teams, and builders test email workflows quickly and safely.
        </p>

        <br />

        <p style={{ color: '#aaa', lineHeight: '1.7' }}>
          It allows temporary email generation for testing signups, verifying email delivery systems, and protecting your primary inbox during development.
        </p>

        <br />

        <h2 style={{ marginTop: '30px' }}>Our Mission</h2>
        <p style={{ color: '#aaa', lineHeight: '1.7' }}>
          We aim to provide a simple and fast tool for testing email systems without compromising privacy or enabling abuse.
        </p>

        <br />

        <h2 style={{ marginTop: '30px' }}>Responsible Use</h2>
        <p style={{ color: '#aaa', lineHeight: '1.7' }}>
          GhostMail is built strictly for development and testing purposes. We actively prevent abuse, spam, and misuse of the service.
        </p>

      </div>

      <footer style={{ textAlign: 'center', padding: '20px', color: '#555' }}>
        GhostMail — Email testing tool for developers
      </footer>
    </div>
  );
}