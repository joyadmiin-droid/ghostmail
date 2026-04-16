'use client';

import { useEffect } from 'react';

export default function ThemeClient() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('ghostmail-theme') || 'dark';
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  return null;
}