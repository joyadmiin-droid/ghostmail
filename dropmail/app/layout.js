import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});
const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
  display: 'swap',
});
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata = {
  title: 'GhostMail — Instant Throwaway Email',
  description: 'Generate a real working email in one click. Use it anywhere. Vanishes automatically — no trace, no spam, no BS.',
  keywords: ['temp mail', 'throwaway email', 'disposable email', 'temporary email', 'fake email', 'anonymous email', 'ghostmail'],
  authors: [{ name: 'GhostMail' }],
  metadataBase: new URL('https://www.ghostmails.org'),
  openGraph: {
    title: 'GhostMail — Instant Throwaway Email',
    description: 'Generate a real working email in one click. Vanishes automatically — no trace, no spam, no BS.',
    url: 'https://www.ghostmails.org',
    siteName: 'GhostMail',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GhostMail — Instant Throwaway Email',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GhostMail — Instant Throwaway Email',
    description: 'Generate a real working email in one click. Vanishes automatically — no trace, no spam, no BS.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable + ' ' + dmSerif.variable + ' ' + dmMono.variable}>
      <body>{children}</body>
    </html>
  );
}
