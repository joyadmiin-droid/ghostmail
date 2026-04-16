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
          id="ga-script-src"
          src="https://www.googletagmanager.com/gtag/js?id=G-GEHF8M2703"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GEHF8M2703');
          `}
        </Script>
      </body>
    </html>
  );
}