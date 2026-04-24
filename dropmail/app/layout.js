import './globals.css';
import Script from 'next/script';
import ThemeClient from './ThemeClient';
import Script from 'next/script';

export const metadata = {
  title: 'GhostMail',
  description: 'Private email inbox for developers & testing',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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