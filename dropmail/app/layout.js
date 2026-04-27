import './globals.css';
import Script from 'next/script';
import ThemeClient from './ThemeClient';
import { Analytics } from "@vercel/analytics/react";

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
return ( <html lang="en"> <head>
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
/> </head>

```
  <body>
    <ThemeClient />
    {children}

    <Analytics />

    {/* Google Analytics */}
    <Script
      src="https://www.googletagmanager.com/gtag/js?id=G-GEHF8MZ703"
      strategy="afterInteractive"
    />
    <Script id="google-analytics" strategy="afterInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-GEHF8MZ703');
      `}
    </Script>

  </body>
</html>
```

);
}
