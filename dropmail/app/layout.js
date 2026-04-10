'use client';

import './globals.css';
import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('ghostmail-theme') || 'dark';
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}