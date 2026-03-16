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
  title: 'DropMail — Instant Throwaway Email',
  description: 'Generate a temporary email address instantly. No signup. Self-destructs in 10 minutes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
