export default function BillingSuccess() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: 'white',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 30,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>
          You are now Spectre 🚀
        </h1>

        <p style={{ marginTop: 10, color: '#aaa' }}>
          Your premium access is active. Enjoy unlimited inboxes and extended lifetime.
        </p>

        <a
          href="/dashboard"
          style={{
            marginTop: 20,
            display: 'inline-block',
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            background: 'linear-gradient(to right, #9333ea, #ec4899)',
            color: 'white',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go to dashboard
        </a>
      </div>
    </div>
  );
}