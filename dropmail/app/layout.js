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

        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GEHF8M2703"
          strategy="afterInteractive"
        />
        <Script id="ga-script" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GEHF8M2703');
          `}
        </Script>
      </body>
    </html>
  );
}