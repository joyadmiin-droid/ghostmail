'use client';

export default function SuccessPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#080010',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      color: '#fff',
      textAlign: 'center',
      padding: '24px'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
      <h1 style={{ fontSize: '36px', marginBottom: '12px' }}>You're in!</h1>
      <p style={{ color: '#6b6b7a', fontSize: '18px', marginBottom: '32px' }}>
        Payment successful! Welcome to the ghost world 👻
      </p>
      <a href="/" style={{
        background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
        color: '#fff',
        padding: '16px 32px',
        borderRadius: '14px',
        textDecoration: 'none',
        fontWeight: '700',
        fontSize: '16px'
      }}>
        Start using GhostMail →
      </a>
    </main>
  );
}