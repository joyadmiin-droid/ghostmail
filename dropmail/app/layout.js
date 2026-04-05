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
  title: 'GhostMail - Email Testing Tool for Developers & QA',

description:
  'Create disposable email addresses for QA testing, development workflows, and protecting your primary inbox during testing. Built for responsible use with automatic expiration.',

keywords: [
  'temporary email',
  'temp mail',
  'disposable email',
  'email testing',
  'privacy email',
  'qa testing email'
],
  authors: [{ name: 'GhostMail' }],
  metadataBase: new URL('https://ghostmails.org'),
  openGraph: {
  title: 'GhostMail – Email Testing Tool for Developers & QA',
  description:
    'Create temporary email addresses for QA testing, development workflows, and protecting your primary inbox during testing. Built for responsible use with automatic expiration.',
  url: 'https://ghostmails.org',
  siteName: 'GhostMail',
  images: [
    {
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'GhostMail – Email testing tool for developers and QA',
    },
  ],
  locale: 'en_US',
  type: 'website',
},
twitter: {
  card: 'summary_large_image',
  title: 'GhostMail – Email Testing Tool for Developers & QA',
  description:
  'Create temporary email addresses for QA testing, development workflows, and protecting your primary inbox during testing. Built for responsible use with automatic expiration.',
  images: ['/og-image.png'],
},
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable + ' ' + dmSerif.variable + ' ' + dmMono.variable}>
      <body>{children}</body>
    </html>
  );
}
