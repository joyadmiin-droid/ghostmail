export default function PrivacyPage() {
  return (
    <div style={{ background: '#0a0a12', minHeight: '100vh', color: '#e2e2f0', fontFamily: 'Georgia, serif' }}>
      {/* NAV */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 2rem', borderBottom: '1px solid #1a1a2e', background: '#0f0f1c' }}>
        <a href="/" style={{ fontWeight: '700', fontSize: '1rem', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#a78bfa' }}>✦</span> GhostMail
        </a>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="/terms" style={{ color: '#555', fontSize: '13px', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/login" style={{ color: '#a78bfa', fontSize: '13px', textDecoration: 'none' }}>Sign In</a>
        </div>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        {/* Badge */}
        <div style={{ display: 'inline-block', background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.25)', color: '#ec4899', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.3rem 0.9rem', borderRadius: '999px', marginBottom: '1.5rem', fontFamily: 'sans-serif' }}>
          Privacy
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: '800', fontFamily: 'sans-serif', marginBottom: '0.4rem', background: 'linear-gradient(135deg, #e2e2f0, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#555', fontSize: '0.85rem', fontFamily: 'sans-serif', marginBottom: '2rem' }}>
          Last updated: March 25, 2026
        </p>

        {/* Callout */}
        <div style={{ background: 'rgba(236,72,153,0.06)', borderLeft: '3px solid #ec4899', padding: '1rem 1.2rem', borderRadius: '0 8px 8px 0', marginBottom: '2.5rem', color: '#888', fontSize: '0.92rem' }}>
          TL;DR — We do not track you, sell your data, or store anything longer than necessary. Privacy is not a feature here — it is the foundation.
        </div>

        {/* Quick cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '3rem' }}>
          {[
            { icon: '📭', title: 'No persistent emails', desc: 'Deleted automatically on expiry.' },
            { icon: '🚫', title: 'No ad tracking', desc: 'Zero ad networks or cross-site trackers.' },
            { icon: '🤝', title: 'No data selling', desc: 'Your data is never sold or shared.' },
            { icon: '👻', title: 'No signup required', desc: 'Free users leave no personal data.' },
          ].map(card => (
            <div key={card.title} style={{ background: '#0f0f1c', border: '1px solid #1a1a2e', borderRadius: '10px', padding: '1.1rem', fontFamily: 'sans-serif' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>{card.icon}</div>
              <div style={{ fontWeight: '600', color: '#e2e2f0', fontSize: '0.88rem', marginBottom: '0.25rem' }}>{card.title}</div>
              <div style={{ color: '#555', fontSize: '0.8rem' }}>{card.desc}</div>
            </div>
          ))}
        </div>

        {[
          {
            title: '1. What We Collect',
            body: 'Free users: nothing personally identifiable. A temporary session is stored in your browser to link you to your generated address and wiped when the address expires. Paid users: we collect your email address for login and billing, and payment info processed securely by our payment provider — we never store card details.',
          },
          {
            title: '2. Email Content',
            body: 'Emails received to your temporary address are stored temporarily on our servers solely to display them to you. They are permanently deleted when your address expires. We do not read, scan, or analyze your email content for any purpose.',
          },
          {
            title: '3. Cookies & Local Storage',
            body: 'We use minimal, strictly necessary browser storage to maintain your session. We do not use advertising cookies, analytics cookies, or third-party tracking pixels.',
          },
          {
            title: '4. Analytics',
            body: 'We may collect anonymized, aggregate usage metrics (e.g. number of addresses generated per day) to understand how the service is used. This data contains no personally identifiable information.',
          },
          {
            title: '5. Third-Party Services',
            body: 'We use a third-party payment processor for paid plans. Their privacy policy governs data they collect. We do not share any other personal data with third parties.',
          },
          {
            title: '6. Data Retention',
            body: 'Temporary email addresses and their emails are deleted on expiry. Paid account data is retained while your account is active. Server logs are rotated and purged within 7 days.',
          },
          {
            title: '7. Your Rights',
            body: 'If you have a paid account, you may request deletion of your account and associated data at any time by emailing support@ghostmails.org. We will process requests within 14 days.',
          },
          {
            title: '8. Changes to This Policy',
            body: 'We may update this policy. Continued use after changes constitutes acceptance.',
          },
          {
            title: '9. Contact',
            body: 'Privacy questions? Email us at support@ghostmails.org',
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontFamily: 'sans-serif', fontWeight: '700', color: '#e2e2f0', marginBottom: '0.6rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1a1a2e' }}>
              {section.title}
            </h2>
            <p style={{ color: '#666', lineHeight: '1.8', fontSize: '0.95rem' }}>{section.body}</p>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <footer style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid #1a1a2e', color: '#444', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
        <p>✦ GhostMail — private by design &nbsp;·&nbsp;
          <a href="/terms" style={{ color: '#a78bfa', margin: '0 0.5rem', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ color: '#a78bfa', margin: '0 0.5rem', textDecoration: 'none' }}>Privacy</a>
          <a href="mailto:support@ghostmails.org" style={{ color: '#a78bfa', margin: '0 0.5rem', textDecoration: 'none' }}>Contact</a>
        </p>
      </footer>
    </div>
  );
}
