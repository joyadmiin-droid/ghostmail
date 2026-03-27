export default function TermsPage() {
  return (
    <div style={{ background: '#0a0a12', minHeight: '100vh', color: '#e2e2f0', fontFamily: 'Georgia, serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 2rem', borderBottom: '1px solid #1a1a2e', background: '#0f0f1c' }}>
        <a href="/" style={{ fontWeight: '700', fontSize: '1rem', color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#a78bfa' }}>&#10022;</span> GhostMail
        </a>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="/privacy" style={{ color: '#555', fontSize: '13px', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/login" style={{ color: '#a78bfa',a fontSize: '13px', textDecoration: 'none' }}>Sign In</a>
        </div>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>
        <div style={{ display: 'inline-block', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)', color: '#a78bfa', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.3rem 0.9rem', borderRadius: '999px', marginBottom: '1.5rem', fontFamily: 'sans-serif' }}>
          Legal
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: '800', fontFamily: 'sans-serif', marginBottom: '0.4rem', background: 'linear-gradient(135deg, #e2e2f0, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Terms of Service
        </h1>
        <p style={{ color: '#555', fontSize: '0.85rem', fontFamily: 'sans-serif', marginBottom: '3rem' }}>
          Last updated: March 27, 2026
        </p>

        <div style={{ background: 'rgba(167,139,250,0.07)', borderLeft: '3px solid #a78bfa', padding: '1rem 1.2rem', borderRadius: '0 8px 8px 0', marginBottom: '2rem', color: '#888', fontSize: '0.92rem' }}>
          By using GhostMail, you agree to these terms. They are short, plain English, and we hide nothing.
        </div>

        {[
          {
            title: '1. What GhostMail Is',
            body: 'GhostMail (ghostmails.org) is a disposable email service that generates temporary email addresses for short-term use. Email addresses and their contents are automatically deleted after a set period depending on your plan.',
          },
          {
            title: '2. Acceptable Use',
            body: 'You agree to use GhostMail only for lawful purposes. You may not use GhostMail to send or facilitate spam or phishing, conduct fraudulent activities, distribute malware, or harass or harm other individuals. We reserve the right to block addresses or IPs found in violation.',
          },
          {
            title: '3. Temporary Nature of the Service',
            body: 'All email addresses are temporary by design. Free addresses expire after 10 minutes. Paid plan addresses expire per plan terms. Do not use GhostMail for anything requiring permanent email storage.',
          },
          {
            title: '4. No Account Required (Free Tier)',
            body: 'Free-tier users do not create accounts. Because no account is linked to your session, we cannot restore deleted addresses or emails under any circumstances.',
          },
          {
            title: '5. Paid Plans',
            body: 'Paid subscriptions (Phantom, Spectre) are billed monthly. All payments are processed securely by Paddle.com, our authorized reseller and Merchant of Record. By subscribing, you agree to our pricing as listed on the website. We reserve the right to change pricing with 30 days notice.',
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontFamily: 'sans-serif', fontWeight: '700', color: '#e2e2f0', marginBottom: '0.6rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1a1a2e' }}>
              {section.title}
            </h2>
            <p style={{ color: '#666', lineHeight: '1.8', fontSize: '0.95rem' }}>{section.body}</p>
          </div>
        ))}

        {/* PADDLE-COMPLIANT REFUND POLICY */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontFamily: 'sans-serif', fontWeight: '700', color: '#e2e2f0', marginBottom: '0.6rem', paddingBottom: '0.4rem', borderBottom: '1px solid #1a1a2e' }}>
            6. Refund Policy
          </h2>
          <p style={{ color: '#666', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '1rem' }}>
            You may request a full refund within <strong style={{ color: '#e2e2f0' }}>14 days</strong> of your initial purchase or renewal date. Refund requests must be submitted within this 14-day window with no exceptions.
          </p>
          <p style={{ color: '#666', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '1rem' }}>
            To request a refund, email us at <a href="mailto:support@ghostmails.org" style={{ color: '#a78bfa', textDecoration: 'none' }}>support@ghostmails.org</a> with your order details. Refunds are processed within 5-10 business days to your original payment method.
          </p>
          <p style={{ color: '#666', lineHeight: '1.8', fontSize: '0.95rem' }}>
            All refund requests are handled by Paddle.com as our Merchant of Record. You may also contact Paddle directly at <a href="https://www.paddle.com/legal/buyer-terms" target="_blank" rel="noreferrer" style={{ color: '#a78bfa', textDecoration: 'none' }}>paddle.com/legal/buyer-terms</a>.
          </p>
        </div>

        {[
          {
            title: '7. Disclaimer of Warranties',
            body: 'GhostMail is provided "as is" without warranties of any kind. We do not guarantee uptime, email delivery speed, or that the service will be error-free.',
          },
          {
            title: '8. Limitation of Liability',
            body: 'To the maximum extent permitted by law, GhostMail and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.',
          },
          {
            title: '9. Changes to These Terms',
            body: 'We may update these Terms at any time. Continued use after changes constitutes acceptance.',
          },
          {
            title: '10. Contact',
            body: 'Questions? Email us at support@ghostmails.org',
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

      <footer style={{ textAlign: 'center', padding: '2rem', borderTop: '1px solid #1a1a2e', color: '#444', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
        <p>&#10022; GhostMail — private by design &nbsp;&#183;&nbsp;
          <a href="/terms" style={{ color: '#a78bfa', margin: '0 0.5rem', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ color: '#a78bfa', margin: '0 0.5rem', textDecoration: 'none' }}>Privacy</a>
          <a href="mailto:support@ghostmails.org" style={{ color: '#a78bfa', margin: '0 0.5rem', textDecoration: 'none' }}>Contact</a>
        </p>
      </footer>
    </div>
  );
}
