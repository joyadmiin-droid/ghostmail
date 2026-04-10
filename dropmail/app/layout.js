'use client';

import './globals.css';
import { useEffect, useState } from 'react';

export default function RootLayout({ children }) {
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('ghostmail-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('ghostmail-theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme, mounted]);

  return (
    <html lang="en">
      <body>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          style={{
            position: 'fixed',
            top: 98,
            right: 240,
            zIndex: 99999,
            padding: '10px 14px',
            borderRadius: '999px',
            border:
              theme === 'dark'
                ? '1px solid rgba(255,255,255,0.14)'
                : '1px solid rgba(17,17,17,0.14)',
            background:
              theme === 'dark' ? 'rgba(15,10,30,0.95)' : 'rgba(255,255,255,0.96)',
            color: theme === 'dark' ? '#ffffff' : '#111111',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: 14,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            transition:
              'background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {theme === 'dark' ? 'Light ☀️' : 'Dark 🌙'}
        </button>

        {children}
      </body>
    </html>
  );
}