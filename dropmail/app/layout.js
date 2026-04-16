import './globals.css';
import Script from 'next/script';
import ThemeClient from './ThemeClient';

export const metadata = {
  title: 'GhostMail',
  description: 'Private email inbox for developers & testing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeClient />
        {children}

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-GEHF8M2703"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-GEHF8M2703');
          `}
        </Script>
      </body>
    </html>
  );
}