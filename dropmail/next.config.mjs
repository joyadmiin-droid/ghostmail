/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 🛡️ Content Security Policy (VERY IMPORTANT)
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval';
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: blob:;
              font-src 'self';
              connect-src 'self' https://*.supabase.co;
              frame-src 'self' blob:;
              object-src 'none';
              base-uri 'self';
              form-action 'self';
              frame-ancestors 'none';
              upgrade-insecure-requests;
            `.replace(/\s{2,}/g, ' ').trim(),
          },

          // 🛡️ Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },

          // 🛡️ Prevent MIME sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },

          // 🛡️ XSS protection (legacy but ok)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },

          // 🛡️ Hide referrer data
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },

          // 🛡️ Permissions lockdown
          {
            key: 'Permissions-Policy',
            value: `
              camera=(),
              microphone=(),
              geolocation=(),
              payment=()
            `.replace(/\s{2,}/g, ' ').trim(),
          },

          // 🛡️ HTTPS enforcement
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;