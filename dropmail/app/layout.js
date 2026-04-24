import './globals.css';
import Script from 'next/script';
import ThemeClient from './ThemeClient';

export const metadata = {
  title: 'GhostMail',
  description: 'Private email inbox for developers & testing',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'GhostMail',
              url: 'https://ghostmails.org',
              logo: 'https://ghostmails.org/favicon.png',
            }),
          }}
        />
      </head>

      <body>
        <ThemeClient />
        {children}

        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id="ea201a27-2a31-45d2-aebd-43bb4b067ee6"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}