'use client';

import './globals.css';
import { useEffect } from 'react';
import Script from 'next/script';

export default function RootLayout({ children }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('ghostmail-theme') || 'dark';
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  return (
    <html lang="en">
      <body>
        {children}

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GEHF8M2703"
          strategy="afterInteractive"
        />

        <Script
          id="ga-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', 'G-GEHF8M2703', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </body>
    </html>
  );
}